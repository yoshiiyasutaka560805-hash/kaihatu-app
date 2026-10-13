'use strict';

const { api, stop } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert');
const ai = require('../services/ai/client');
const { getDb } = require('../database/db');
const { todayJst, addDays } = require('../utils/dates');

test.after(() => { ai.setClientForTest(null); stop(); });

test('ネット求人検索：pause_turn継続→提出→取込（ネット求人）→判定', async () => {
  const s = await api('POST', '/api/seekers', { name: '検索 太郎', consent_date: todayJst(), phone: '090-9999-0000', prefecture: '大阪府', city: '堺市',
    desired_categories: '介護', desired_wage_min: '20万', shift_ok: true });
  const reqs = [];
  let n = 0;
  ai.setClientForTest({ beta: { messages: { create: async req => {
    reqs.push(JSON.parse(JSON.stringify(req)));
    n++;
    if (n === 1) return { stop_reason: 'pause_turn', usage: { input_tokens: 100, output_tokens: 50, server_tool_use: { web_search_requests: 3 } },
      content: [{ type: 'server_tool_use', id: 'x', name: 'web_search', input: { query: '堺市 介護 求人' } }] };
    return { stop_reason: 'tool_use', usage: { input_tokens: 200, output_tokens: 300 }, content: [{ type: 'tool_use', id: 't1', name: 'submit_jobs', input: {
      search_notes: 'Indeed・ハローワークで検索',
      jobs: [
        { source_url: 'https://example.jp/job/1', source_site: 'Indeed', company_name: 'ネット特養', job_title: '介護職員', prefecture: '大阪府', city: '堺市中区',
          address: null, nearest_station: null, facility_type: '特養', employment_type: '正社員', employment_term: '無期', wage_type: 'monthly', wage_min: 230000, wage_max: 270000,
          allowances_note: '夜勤手当5000円', work_start: null, work_end: null, shift_work: true, nights_per_month: 4, days_per_week: 5, annual_holidays: 110,
          required_licenses: null, preferred_licenses: null, experience_required: null, foreigner_ok: null, description: '特養での介護', posted_date: '2026/10/01', hw_posting_no: '27010-12345678' },
        { source_url: 'javascript:alert(1)', source_site: 'x', company_name: '不正URL', job_title: 'x', prefecture: null, city: null, address: null, nearest_station: null,
          facility_type: null, employment_type: null, employment_term: null, wage_type: null, wage_min: null, wage_max: null, allowances_note: null, work_start: null,
          work_end: null, shift_work: null, nights_per_month: null, days_per_week: null, annual_holidays: null, required_licenses: null, preferred_licenses: null,
          experience_required: null, foreigner_ok: null, description: null, posted_date: null, hw_posting_no: null },
      ] } }] };
  } } } });
  const r = await api('POST', '/api/matches/web-search', { seekerId: s.body.id, count: 5 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.search.found, 2);
  assert.equal(r.body.search.inserted, 1);
  assert.ok(r.body.search.errors[0].includes('URLなし'));
  assert.equal(reqs.length, 2);
  // 検索条件に氏名・電話を含まない／Web検索ツールと提出ツール
  assert.ok(!JSON.stringify(reqs[0].messages).includes('検索 太郎'));
  assert.ok(!JSON.stringify(reqs[0].messages).includes('090-9999-0000'));
  assert.deepEqual(reqs[0].tools.map(t => t.name), ['web_search', 'web_fetch', 'submit_jobs']);
  assert.equal(reqs[1].messages.length, 2, 'pause_turn は追加のユーザー発言なしで再送');
  const p = getDb().prepare("SELECT * FROM job_postings WHERE source = 'web_search'").get();
  assert.equal(p.origin, 'web');
  assert.equal(p.source_file, 'Indeed');
  assert.equal(p.hw_posting_no, '27010-12345678');
  assert.equal(p.expiry_date, addDays(todayJst(), 14));
  assert.equal(p.received_date, '2026-10-01');
  const m = (await api('GET', `/api/matches?seekerId=${s.body.id}`)).body.find(x => x.posting_id === p.id);
  assert.ok(m, 'ネット求人が判定対象になる');
  assert.ok(m.breakdown.verdict.label);
  assert.ok(m.breakdown.referralNote);
  const log = getDb().prepare("SELECT * FROM ai_requests WHERE purpose = 'web_job_search'").get();
  assert.equal(log.status, 'success');
  assert.ok(log.cost_usd >= 0.03, '検索回数の費用を含む');
});

test('ネット求人検索：勤務地未入力はエラー', async () => {
  const s = await api('POST', '/api/seekers', { name: '地域 なし', consent_date: todayJst() });
  const r = await api('POST', '/api/matches/web-search', { seekerId: s.body.id });
  assert.equal(r.status, 400);
});
