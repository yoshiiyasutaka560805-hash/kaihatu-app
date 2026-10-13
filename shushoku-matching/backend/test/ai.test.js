'use strict';

const { api, stop } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert');
const { getDb } = require('../database/db');
const ai = require('../services/ai/client');
const { importRows } = require('../services/postingStore');
const { todayJst, addDays } = require('../utils/dates');

test.after(stop);
const sent = [];
function mockClient(handler) {
  ai.setClientForTest({ beta: { messages: { create: async req => { sent.push(req); return handler(req); } } } });
}
const ok = obj => ({ stop_reason: 'end_turn', usage: { input_tokens: 1000, output_tokens: 500 }, content: [{ type: 'text', text: JSON.stringify(obj) }] });

test('マッチングAI補足：仮名化・fallbacks・構造化出力・利用記録', async () => {
  importRows([{ 求人番号: 'AI-1', 事業所名: 'AI特養', 都道府県: '大阪府', 市区町村: '堺市', 職種: '介護職', 職種分類: '介護', 紹介期限日: addDays(todayJst(), 30) }], 'manual');
  const s = await api('POST', '/api/seekers', { name: '仮名 太郎', phone: '090-1111-2222', consent_date: todayJst(), city: '堺市', prefecture: '大阪府',
    desired_categories: '介護', ai_consent: true, experience_note: '仮名太郎として前職で3年勤務' });
  mockClient(() => ok({ results: [{ posting_no: 'AI-1', fit_summary: '適合', strengths: ['近い'], concerns: [], questions_to_confirm: [] }] }));
  const r = await api('POST', '/api/matches/run', { seekerId: s.body.id });
  assert.match(r.body.aiStatus, /AI補足 1件/);
  const req = sent.at(-1);
  assert.equal(req.fallbacks, 'default');
  assert.equal(req.output_config.format.type, 'json_schema');
  for (const v of ['仮名 太郎', '仮名', '090-1111-2222']) assert.ok(!req.messages[0].content.includes(v), v);
  const row = getDb().prepare("SELECT * FROM ai_requests WHERE purpose = 'match_advice' ORDER BY id DESC").get();
  assert.equal(row.status, 'success');
  assert.ok(row.cost_usd > 0);
  assert.equal(row.operator, 'テスト担当');
  // 再判定（AIなし）で古いコメントが消える
  await api('POST', '/api/matches/run', { seekerId: s.body.id, withAi: false });
  const m = (await api('GET', `/api/matches?seekerId=${s.body.id}`)).body[0];
  assert.equal(m.ai_comment, null);
});

test('AI失敗時も送信記録が残る・辞退の扱い', async () => {
  const s = getDb().prepare("SELECT id FROM job_seekers WHERE name = '仮名 太郎'").get();
  mockClient(() => ({ stop_reason: 'refusal', usage: {}, content: [] }));
  const r = await api('POST', '/api/matches/run', { seekerId: s.id });
  assert.match(r.body.aiStatus, /辞退/);
  assert.equal(getDb().prepare('SELECT status FROM ai_requests ORDER BY id DESC').get().status, 'error');
});

test('面談メモAI抽出：マスキング → 下書き → 承認で反映', async () => {
  const s = getDb().prepare("SELECT id FROM job_seekers WHERE name = '仮名 太郎'").get();
  mockClient(() => ok({ desired_wage_min: 230000, night_max_per_month: 4, desired_facility_types: '特養', uncertain_points: ['休日数は未確認'],
    prefecture: null, city: null }));
  const r = await api('POST', '/api/drafts/memo', { seeker_id: s.id, memo: '仮名さん 電話090-1111-2222。月給23万以上、夜勤は月4回まで、特養希望' });
  assert.equal(r.status, 200);
  assert.ok(!sent.at(-1).messages[0].content.includes('090-1111-2222'));
  assert.ok(!sent.at(-1).messages[0].content.includes('仮名'));
  const ap = await api('POST', `/api/drafts/${r.body.draftId}/approve`, { data: r.body.data });
  assert.equal(ap.status, 200);
  const row = getDb().prepare('SELECT desired_wage_min, night_max_per_month FROM job_seekers WHERE id = ?').get(s.id);
  assert.deepEqual({ ...row }, { desired_wage_min: 230000, night_max_per_month: 4 });
});

test('提案書の翻訳：求職者情報を送らない', async () => {
  const s = getDb().prepare("SELECT id FROM job_seekers WHERE name = '仮名 太郎'").get();
  await api('POST', '/api/matches/run', { seekerId: s.id, withAi: false });
  const m = (await api('GET', `/api/matches?seekerId=${s.id}`)).body[0];
  mockClient(req => {
    const input = JSON.parse(req.messages[0].content);
    return ok({ labels: input.labels.map(l => ({ key: l.key, text: `VI:${l.text}` })), items: input.items.map(i => ({ id: i.id, fields: i.fields.map(f => ({ key: f.key, text: `VI:${f.text}` })) })), note: 'VI note' });
  });
  const r = await api('POST', '/api/proposals', { seeker_id: s.id, match_ids: [m.id], language: 'vi', mark_proposed: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.labels.company, 'VI:事業所');
  assert.ok(!sent.at(-1).messages[0].content.includes('仮名'));
  assert.ok(r.body.warnings[0].includes('自社受理前'));
  assert.equal((await api('GET', `/api/matches?seekerId=${s.id}`)).body[0].intro_status, '提案済');
});

test('月額予算の上限で停止', async () => {
  await api('PUT', '/api/settings', { ai_monthly_budget_usd: '0.0001' });
  const s = getDb().prepare("SELECT id FROM job_seekers WHERE name = '仮名 太郎'").get();
  const r = await api('POST', '/api/drafts/memo', { seeker_id: s.id, memo: 'テスト' });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /予算/);
  await api('PUT', '/api/settings', { ai_monthly_budget_usd: '30' });
});

test('AI未設定時はエラーにせずルール判定のみ', async () => {
  ai.setClientForTest(null);
  const s = getDb().prepare("SELECT id FROM job_seekers WHERE name = '仮名 太郎'").get();
  const r = await api('POST', '/api/matches/run', { seekerId: s.id });
  assert.match(r.body.aiStatus, /APIキー未設定/);
});
