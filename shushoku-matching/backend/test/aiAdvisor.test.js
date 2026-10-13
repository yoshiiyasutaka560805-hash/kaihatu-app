'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { advise } = require('../services/matching/aiAdvisor');

test('AI補足：リクエスト内容と応答パース（APIはモック）', async () => {
  let sent;
  const client = { beta: { messages: { create: async req => {
    sent = req;
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ results: [
      { posting_no: 'P-1', fit_summary: '適合', strengths: ['a'], concerns: [], questions_to_confirm: ['b'] },
    ] }) }] };
  } } } };
  const seeker = { name: '山田太郎', phone: '090', birth_date: '1990-01-01', city: '堺市' };
  const posting = { posting_no: 'P-1', company_name: 'A', job_title: '介護', wage_type: 'monthly' };
  const { comments } = await advise(seeker, [{ posting, match: { score: 80, warnings: [] } }], { client });

  assert.equal(comments.get('P-1').fit_summary, '適合');
  assert.equal(sent.fallbacks, 'default');
  assert.equal(sent.output_config.format.type, 'json_schema');
  assert.ok(!sent.messages[0].content.includes('山田'));
  assert.ok(!sent.messages[0].content.includes('090'));
});

test('AI補足：辞退時はエラー', async () => {
  const client = { beta: { messages: { create: async () => ({ stop_reason: 'refusal', content: [] }) } } };
  await assert.rejects(advise({}, [], { client }), /辞退/);
});
