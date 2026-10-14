'use strict';

const { api, stop, start, getBase } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const ai = require('../services/ai/client');
const { getDb } = require('../database/db');
const { todayJst } = require('../utils/dates');

test.after(() => { ai.setClientForTest(null); stop(); });

async function uploadSheet(buf, name, fields = {}) {
  await start();
  const form = new FormData();
  form.append('file', new Blob([buf]), name);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const { api: _a } = require('./helpers');
  // Cookie を共有するため helpers の api と同じヘッダを使う
  const res = await fetch(`${getBase()}/api/drafts/sheet`, { method: 'POST', body: form, headers: await authHeaders() });
  return { status: res.status, body: await res.json() };
}
async function authHeaders() {
  const r = await fetch(`${getBase()}/api/auth/login`, { method: 'POST', headers: { 'X-Rianet-App': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-password' }) });
  return { 'X-Rianet-App': '1', Cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}

test('自社テンプレート（Excel）はAIなしで読み取り、承認で求職者登録', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('条件表');
  ws.addRow(['項目', '記入欄', '記入例・選択肢']);
  for (const r of [['氏名', '条件 太郎'], ['電話番号', '090-0000-1111'], ['都道府県', '大阪府'], ['市区町村', '堺市'], ['希望職種', '介護'],
    ['希望施設', '特養'], ['希望雇用形態', '正社員'], ['賃金形態', '月給'], ['希望賃金', '23万'], ['夜勤・交替制', '可'],
    ['夜勤回数の上限（月）', '4'], ['希望年間休日', ''], ['保有資格', '介護福祉士']]) ws.addRow([r[0], r[1], '例：xxx']);
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const r = await uploadSheet(buf, '条件表.xlsx');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.method, 'template');
  assert.equal(r.body.data.desired_wage_type, 'monthly');
  assert.equal(r.body.data.shift_ok, 1);
  assert.ok(!('min_annual_holidays' in r.body.data), '空欄は読まない（記入例を値として読まない）');
  const ap = await api('POST', `/api/drafts/${r.body.draftId}/approve`, { data: { fields: { ...r.body.data, consent_date: todayJst() } } });
  assert.equal(ap.status, 200, JSON.stringify(ap.body));
  const s = getDb().prepare('SELECT * FROM job_seekers WHERE id = ?').get(ap.body.resultId);
  assert.equal(s.name, '条件 太郎');
  assert.equal(s.desired_wage_min, 230000);
  assert.equal(s.night_max_per_month, 4);
  // 判定 → 4段階の件数
  const run = await api('POST', '/api/matches/run', { seekerId: s.id, withAi: false });
  assert.ok(run.body.verdicts && 'high' in run.body.verdicts);
});

async function makeDocx(text) {
  const zip = new JSZip();
  const paras = text.split('\n').map(l => `<w:p><w:r><w:t>${l}</w:t></w:r></w:p>`).join('');
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${paras}</w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('自由様式（Word）：AI同意なしは手入力、同意ありはマスキングしてAI抽出', async () => {
  const buf = await makeDocx('就職希望のメモ\n山田花子です。電話は080-1234-5678\n堺市あたりで、デイサービスの介護をパートで希望。時給1200円以上、夜勤はできません。');
  const manual = await uploadSheet(buf, 'memo.docx');
  assert.equal(manual.status, 200);
  assert.equal(manual.body.method, 'manual');
  assert.equal(manual.body.data.phone, '080-1234-5678');

  let sent;
  ai.setClientForTest({ beta: { messages: { create: async req => { sent = req; return { stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 },
    content: [{ type: 'text', text: JSON.stringify({ city: '堺市', desired_facility_types: 'デイ', desired_employment: 'パート', desired_wage_type: 'hourly', desired_wage_min: 1200, shift_ok: false, uncertain_points: ['勤務日数が不明'] }) }] }; } } } });
  const r = await uploadSheet(buf, 'memo.docx', { ai_ok: '1' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.method, 'ai');
  assert.equal(r.body.data.desired_wage_min, 1200);
  assert.equal(r.body.data.shift_ok, 0);
  assert.equal(r.body.data.phone, '080-1234-5678', '電話はローカルで読み取る');
  assert.ok(!sent.messages[0].content.includes('080-1234-5678'));
  assert.deepEqual(r.body.uncertain, ['勤務日数が不明']);
});

test('未対応形式・古い形式はエラー', async () => {
  assert.equal((await uploadSheet(Buffer.from('x'), 'a.xls')).status, 400);
  assert.equal((await uploadSheet(Buffer.from('x'), 'a.txt')).status, 400);
});

test('ヒアリングシート形式：手当・勤務帯・優先順位・最低ラインを判定条件に反映', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('条件表');
  ws.addRow(['項目', '記入欄', '記入例・選択肢']);
  for (const r of [['氏名', 'シート 花子'], ['都道府県', '大阪府'], ['市区町村', '堺市'], ['希望職種', '介護職員・ヘルパー'],
    ['希望雇用形態', '正社員'], ['希望勤務時間帯', '日勤のみ'], ['賃金形態', '月給'], ['希望給与', '25万'], ['希望賃金', '22万'],
    ['必須の手当・待遇', '交通費支給,賞与あり'], ['休日・休暇の希望', '週休2日以上'], ['優先順位', '1.休日 2.給与 3.勤務地'],
    ['運転免許', '普通（AT限定）'], ['現職の状況', '在職中'], ['退職予定日', '2026/11/30'], ['他社内定の回答期限', '2026/10/20'],
    ['紹介先へ提供してよい情報の範囲', '氏名を伏せた概要のみ']]) ws.addRow([r[0], r[1], '例']);
  const r = await uploadSheet(Buffer.from(await wb.xlsx.writeBuffer()), 'hearing.xlsx');
  assert.equal(r.body.method, 'template');
  const ap = await api('POST', `/api/drafts/${r.body.draftId}/approve`, { data: { fields: { ...r.body.data, consent_date: todayJst() } } });
  assert.equal(ap.status, 200, JSON.stringify(ap.body));
  const s = getDb().prepare('SELECT * FROM job_seekers WHERE id = ?').get(ap.body.resultId);
  assert.equal(s.shift_ok, 0);
  assert.equal(s.night_max_per_month, 0);
  assert.equal(s.weight_profile, 'holiday');
  assert.equal(s.priorities, '休日,給与,勤務地');
  assert.equal(s.max_days_per_week, 5);
  assert.equal(s.desired_wage_target, 250000);
  assert.equal(s.desired_wage_min, 220000);
  assert.equal(s.available_from, '2026-12-01');
  assert.match(s.licenses, /普通自動車免許（AT限定）/);
  assert.equal(s.disclosure_scope, '氏名を伏せた概要のみ');
});
