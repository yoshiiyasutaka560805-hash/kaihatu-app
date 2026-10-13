'use strict';

const { api, stop, start } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert');
const { getDb } = require('../database/db');
const { importRows } = require('../services/postingStore');
const { todayJst, addDays, addMonths, addYears } = require('../utils/dates');
const { purgeExpired } = require('../services/retention');

const today = todayJst();
const future = addDays(today, 60);
test.after(stop);

test('防御：独自ヘッダなし・外部Host・外部Originは拒否', async () => {
  assert.equal((await api('GET', '/api/seekers', null, { 'X-Rianet-App': '' })).status, 403);
  // fetch は Host を書き換えられないため http.request で検証（DNSリバインディング想定）
  const base = await start();
  const status = await new Promise((resolve, reject) => {
    const u = new URL(base);
    require('node:http').request({ host: u.hostname, port: u.port, path: '/api/seekers', headers: { Host: 'evil.example', 'X-Rianet-App': '1' } },
      res => { res.resume(); resolve(res.statusCode); }).on('error', reject).end();
  });
  assert.equal(status, 403);
  assert.equal((await api('POST', '/api/tasks', { title: 'x' }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await api('GET', '/api/seekers')).status, 200);
});

test('不正なJSON・存在しないIDのエラー', async () => {
  const r = await api('GET', '/api/seekers/9999');
  assert.equal(r.status, 404);
  const bad = await api('POST', '/api/seekers', { name: 'a' });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /consent_date/);
});

let employerId, ownPostingId, hwPostingId, seekerId, matchId;

test('取込：日付表記ゆれ・URL・手動終了の維持', async () => {
  const r = importRows([
    { 求人番号: '27000-11111111', 事業所名: '取込特養', 都道府県: '大阪府', 市区町村: '堺市北区', 職種: '介護職員', 職種分類: '介護',
      施設種別: '特養', 雇用形態: '正社員', 賃金下限: '23万', 賃金上限: '27万', 紹介期限日: '令和20年3月31日', URL: 'javascript:alert(1)', 年間休日数: '110' },
    { 求人番号: '27000-22222222', 事業所名: '期限切れ', 職種: '事務', 紹介期限日: '2020/01/01' },
    { 求人番号: '27000-33333333', 事業所名: '日付不正', 職種: '事務', 紹介期限日: '来月末' },
  ], 'manual');
  assert.equal(r.inserted, 2);
  assert.equal(r.errors.length, 1);
  const p = getDb().prepare("SELECT * FROM job_postings WHERE posting_no = '27000-11111111'").get();
  assert.equal(p.expiry_date, '2038-03-31');
  assert.equal(p.source_url, null);
  assert.equal(p.wage_min, 230000);
  assert.equal(getDb().prepare("SELECT is_active FROM job_postings WHERE posting_no = '27000-22222222'").get().is_active, 0);
  hwPostingId = p.id;
  await api('PUT', `/api/postings/${p.id}/active`, { active: false });
  importRows([{ 求人番号: '27000-11111111', 事業所名: '取込特養', 職種: '介護職員', 紹介期限日: future }], 'manual');
  assert.equal(getDb().prepare('SELECT is_active FROM job_postings WHERE id = ?').get(p.id).is_active, 0);
  await api('PUT', `/api/postings/${p.id}/active`, { active: true });
});

test('事業所登録 → HW求人の自社求人化（合意確認必須）→ 明示項目チェック', async () => {
  const e = await api('POST', '/api/employers', { name: '社会福祉法人テスト会', fee_rate_percent: 20, refund_policy: '[{"withinDays":30,"rate":80},{"withinDays":90,"rate":50}]' });
  assert.equal(e.status, 200);
  employerId = e.body.id;
  const ng = await api('POST', `/api/postings/${hwPostingId}/convert`, { employer_id: employerId });
  assert.equal(ng.status, 400);
  const c = await api('POST', `/api/postings/${hwPostingId}/convert`, { employer_id: employerId, confirmed: true });
  assert.equal(c.status, 200);
  assert.match(c.body.posting_no, /^R-\d{4}-0001$/);
  assert.ok(c.body.disclosure_missing.includes('業務の変更の範囲'));
  ownPostingId = c.body.id;
  const u = await api('PUT', `/api/postings/${ownPostingId}`, { job_change_scope: '介護業務全般', place_change_scope: '法人内の事業所', employment_term: '無期',
    city: '堺市北区', prefecture: '大阪府', wage_min: '230000', wage_max: '270000', expiry_date: future });
  assert.ok(!u.body.disclosure_missing.includes('業務の変更の範囲'));
  assert.equal((await api('PUT', `/api/postings/${hwPostingId}`, { job_title: 'x' })).status, 400);
});

test('求職者登録 → 判定 → 選考履歴 → 成約 → 手数料・フォロー', async () => {
  const s = await api('POST', '/api/seekers', { name: '試験 花子', consent_date: today, prefecture: '大阪府', city: '堺市',
    desired_categories: '介護', desired_wage_min: '22万', shift_ok: true, notes: '本籍は確認不要' });
  assert.equal(s.status, 200);
  assert.ok(s.body.prohibited.some(x => x.term === '本籍'));
  seekerId = s.body.id;
  const seeker = getDb().prepare('SELECT * FROM job_seekers WHERE id = ?').get(seekerId);
  assert.equal(seeker.desired_wage_min, 220000);
  assert.equal(seeker.validity_end, addMonths(today, 3));

  const run = await api('POST', '/api/matches/run', { seekerId });
  assert.equal(run.status, 200);
  assert.match(run.body.aiStatus, /同意なし/);
  const list = (await api('GET', `/api/matches?seekerId=${seekerId}`)).body;
  const own = list.find(m => m.posting_id === ownPostingId);
  assert.ok(own);
  matchId = own.id;

  assert.equal((await api('PUT', `/api/matches/${matchId}`, { intro_status: '辞退' })).status, 400);
  for (const st of ['提案済', '応募', '面接', '内定']) {
    const r = await api('PUT', `/api/matches/${matchId}`, { intro_status: st, ...(st === '面接' ? { interview_at: `${today} 10:00` } : {}) });
    assert.equal(r.status, 200, st);
  }
  const ev = (await api('GET', `/api/matches/${matchId}/events`)).body;
  assert.deepEqual(ev.map(e => e.to_status), ['提案済', '応募', '面接', '内定']);
  assert.equal(ev[0].operator, 'テスト担当');
  assert.equal(getDb().prepare('SELECT status FROM job_seekers WHERE id = ?').get(seekerId).status, '内定');

  // HW求人のままでは成約不可
  const hwMatch = list.find(m => m.origin === 'hw');
  if (hwMatch) assert.equal((await api('POST', '/api/placements', { match_id: hwMatch.id, hire_date: today, employment_term: '無期' })).status, 400);

  const pl = await api('POST', '/api/placements', { match_id: matchId, hire_date: today, employment_term: '無期', monthly_wage: 250000 });
  assert.equal(pl.status, 200);
  const detail = (await api('GET', `/api/placements/${pl.body.id}`)).body;
  assert.equal(detail.fee_amount, Math.floor(250000 * 6 * 20 / 100));
  assert.deepEqual(detail.followups.map(f => f.kind), ['1週', '1か月', '3か月', '6か月']);
  assert.equal(getDb().prepare('SELECT status FROM job_seekers WHERE id = ?').get(seekerId).status, '就職');

  // 請求 → 期日自動設定、離職 → 返戻金自動計算
  await api('PUT', `/api/placements/${pl.body.id}`, { invoice_date: today, invoice_no: 'INV-1', paid_date: today, paid_amount: detail.fee_amount });
  const sep = await api('PUT', `/api/placements/${pl.body.id}`, { separation_date: addDays(today, 20), separation_type: '自己都合' });
  const after = (await api('GET', `/api/placements/${pl.body.id}`)).body;
  assert.equal(after.due_date, addDays(today, 30));
  assert.equal(after.refund_amount, Math.floor(detail.fee_amount * 0.8));
  assert.ok(sep.body.warnings[0].includes('30日以内'));
});

test('転職勧奨禁止ガード：無期就職後2年以内の提案は理由が必要', async () => {
  // 離職を取り消して在職扱いに戻す
  getDb().prepare('UPDATE placements SET separation_date = NULL WHERE match_id = ?').run(matchId);
  const r = await api('POST', '/api/proposals', { seeker_id: seekerId, match_ids: [matchId] });
  assert.equal(r.status, 409);
  const ok = await api('POST', '/api/proposals', { seeker_id: seekerId, match_ids: [matchId], override_reason: '本人から求職申込みあり（10/13来所）' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.lineText.includes('賃金'));
});

test('帳簿CSV・事業報告', async () => {
  for (const t of ['job', 'seeker', 'fee']) {
    const r = await api('GET', `/api/reports/ledger/${t}`);
    assert.equal(r.status, 200);
    assert.ok(r.headers.get('content-type').includes('text/csv'));
    assert.ok(String(r.body).includes('試験 花子') || t === 'job');
  }
  const job = await api('GET', '/api/reports/ledger/job');
  assert.ok(String(job.body).includes('R-'));
  const fy = Number(today.slice(5, 7)) < 4 ? Number(today.slice(0, 4)) - 1 : Number(today.slice(0, 4));
  const b = (await api('GET', `/api/reports/business?fy=${fy}`)).body;
  assert.equal(b.就職.就職件数, 1);
  assert.equal(b.就職.うち無期雇用, 1);
});

test('今日のタスク：フォロー・承認待ち等', async () => {
  const t = (await api('GET', '/api/tasks/today')).body;
  assert.ok(Array.isArray(t));
  assert.ok(t.some(x => x.kind === '定着フォロー' || x.kind === '請求' || x.kind === '入金' || x.kind === '新着候補'));
});

test('論理削除と保存期限による削除', async () => {
  const s = await api('POST', '/api/seekers', { name: '削除 対象', consent_date: today });
  const del = await api('DELETE', `/api/seekers/${s.body.id}`);
  assert.equal(del.body.retention_until, addYears(today, 2));
  assert.equal((await api('GET', `/api/seekers/${s.body.id}`)).status, 404);
  assert.ok(getDb().prepare('SELECT 1 FROM job_seekers WHERE id = ?').get(s.body.id));
  assert.equal(purgeExpired(addYears(today, 2)), 0);
  assert.equal(purgeExpired(addDays(addYears(today, 2), 1)) >= 1, true);
  assert.equal(getDb().prepare('SELECT 1 FROM job_seekers WHERE id = ?').get(s.body.id), undefined);
});

test('受付フォーム → 承認で求職者登録', async () => {
  assert.equal((await api('POST', '/api/intake', { name: '受付 一郎' })).status, 400);
  assert.equal((await api('POST', '/api/intake', { name: '受付 一郎', consent: true, preferred_language: 'vi', is_foreign_national: true })).status, 200);
  const d = (await api('GET', '/api/drafts')).body.find(x => x.kind === 'seeker_intake');
  const ap = await api('POST', `/api/drafts/${d.id}/approve`, {});
  assert.equal(ap.status, 200);
  const s = getDb().prepare('SELECT * FROM job_seekers WHERE id = ?').get(ap.body.resultId);
  assert.equal(s.consent_date, today);
  assert.equal(s.preferred_language, 'vi');
});

test('設定：cron・JSON・数値範囲の検証', async () => {
  assert.equal((await api('PUT', '/api/settings', { fetch_cron: 'xx' })).status, 400);
  assert.equal((await api('PUT', '/api/settings', { refund_policy: '{bad' })).status, 400);
  assert.equal((await api('PUT', '/api/settings', { ai_top_n: 50 })).status, 400);
  assert.equal((await api('PUT', '/api/settings', { ai_top_n: 3, fee_rate_percent: '' })).status, 200);
  assert.equal((await api('GET', '/api/settings')).body.settings.ai_top_n, '3');
});

test('苦情受付簿', async () => {
  const c = await api('POST', '/api/complaints', { from_type: '求職者', content: '連絡が遅い' });
  assert.equal(c.status, 200);
  await api('PUT', `/api/complaints/${c.body.id}`, { response: '担当者から謝罪し連絡体制を見直し', completed_date: today });
  assert.equal((await api('GET', '/api/complaints')).body[0].completed_date, today);
});

test('求職者更新：必須・自動設定項目は空で上書きしない', async () => {
  const s = await api('POST', '/api/seekers', { name: '空更新 テスト', consent_date: todayJst() });
  const r = await api('PUT', `/api/seekers/${s.body.id}`, { status: '', accepted_date: '', validity_end: '', name: '', city: '堺市' });
  assert.equal(r.status, 200);
  const row = getDb().prepare('SELECT * FROM job_seekers WHERE id = ?').get(s.body.id);
  assert.equal(row.status, '受付');
  assert.equal(row.name, '空更新 テスト');
  assert.ok(row.accepted_date && row.validity_end);
  assert.equal(row.city, '堺市');
});
