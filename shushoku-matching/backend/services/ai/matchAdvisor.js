'use strict';

// マッチング上位候補の適合理由・懸念点・確認事項（AI補足）
const { callStructured } = require('./client');
const { pseudonymizeSeeker } = require('./pii');

const SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          posting_no: { type: 'string' },
          fit_summary: { type: 'string' },
          strengths: { type: 'array', items: { type: 'string' } },
          concerns: { type: 'array', items: { type: 'string' } },
          questions_to_confirm: { type: 'array', items: { type: 'string' } },
        },
        required: ['posting_no', 'fit_summary', 'strengths', 'concerns', 'questions_to_confirm'],
        additionalProperties: false,
      },
    },
  },
  required: ['results'],
  additionalProperties: false,
};

const SYSTEM = `あなたは有料職業紹介事業者の紹介担当者を補助するアシスタントです。
求職者の条件（仮名化済み）と、ルール判定で上位となった求人を比較し、
求人ごとに「適合の要約」「強み」「懸念点」「求職者・求人者に確認すべき事項」を日本語で簡潔に示してください。
- 判断材料は与えられた情報のみ。不明な点は推測で埋めず「確認事項」に回す。
- 年齢・性別・国籍等による不当な選別につながる記述をしない（職業安定法・男女雇用機会均等法・労働施策総合推進法に留意）。
- 外国籍の場合は、在留資格上の就労可否・日本語での業務遂行の支援体制を確認事項に含める。
- 各項目は1〜3文、箇条書きは最大3件。`;

function postingSummary(p, m) {
  return {
    posting_no: p.posting_no,
    事業所名: p.company_name,
    勤務地: [p.prefecture, p.city].filter(Boolean).join(''),
    施設種別: p.facility_type, 職種: p.job_title, 職務: p.job_kind, 雇用形態: p.employment_type, 契約期間: p.employment_term,
    賃金: `${p.wage_min ?? '?'}〜${p.wage_max ?? '?'}円（${p.wage_type}）`,
    月額見込: m.estimates?.monthlyMin, 年収見込: m.estimates?.annualMin,
    就業時間: p.shift_work ? `交替制（夜勤月${p.nights_per_month ?? '?'}回）` : `${p.work_start || '?'}〜${p.work_end || '?'}`,
    年間休日: p.annual_holidays, 必須資格: p.required_licenses, 歓迎資格: p.preferred_licenses,
    必要経験年数: p.experience_required, 日本語: p.japanese_level, 仕事内容: (p.description || '').slice(0, 600),
    ルール判定スコア: m.score, 注意事項: m.warnings,
  };
}

async function advise(seeker, candidates) {
  const pseudo = pseudonymizeSeeker(seeker);
  const payload = { 求職者: pseudo, 求人候補: candidates.map(c => postingSummary(c.posting, c.match)) };
  const parsed = await callStructured({
    purpose: 'match_advice', system: SYSTEM, content: JSON.stringify(payload, null, 1), schema: SCHEMA,
    seekerId: seeker.id, fieldsSent: { seeker: Object.keys(pseudo), postings: candidates.map(c => c.posting.posting_no) },
  });
  return new Map(parsed.results.map(r => [r.posting_no, r]));
}

module.exports = { advise, SCHEMA };
