'use strict';

// Claude API による適合理由の補足
// ・送信前に仮名化（氏名・カナ・電話・メール・住所・生年月日は送らない。年齢は年代のみ）
// ・ANTHROPIC_API_KEY 未設定、または求職者の AI 利用同意がない場合は呼ばない
// ・最終判断は担当者。AI コメントは参考情報として表示する

const Anthropic = require('@anthropic-ai/sdk');
const { ageOn } = require('./ruleScore');

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';

const OUTPUT_SCHEMA = {
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
求職者の条件（仮名化済み）と、ルール判定で上位となったハローワーク求人を比較し、
求人ごとに「適合の要約」「強み」「懸念点」「求職者・求人者に確認すべき事項」を日本語で簡潔に示してください。
- 判断材料は与えられた情報のみ。不明な点は推測で埋めず「確認事項」に回す。
- 年齢・性別・国籍等による不当な選別につながる記述をしない（職業安定法・男女雇用機会均等法・労働施策総合推進法に留意）。
- 外国籍の場合は、在留資格上の就労可否を確認事項に含める。
- 各項目は1〜3文、箇条書きは最大3件。`;

function pseudonymizeSeeker(s) {
  const age = ageOn(s.birth_date);
  return {
    年代: age != null ? `${Math.floor(age / 10) * 10}代` : '不明',
    居住: [s.prefecture, s.city].filter(Boolean).join(''),
    通勤可能市区町村: s.acceptable_cities || '',
    希望職種: s.desired_categories || '',
    希望雇用形態: s.desired_employment || '',
    希望賃金: s.desired_wage_min ? `${s.desired_wage_min}円（${s.desired_wage_type || 'monthly'}）` : '未設定',
    勤務可能時間: s.available_start && s.available_end ? `${s.available_start}〜${s.available_end}` : '未設定',
    夜勤交替制: s.shift_ok ? '可' : '不可',
    週勤務日数上限: s.max_days_per_week || '未設定',
    希望年間休日: s.min_annual_holidays || '未設定',
    保有資格: s.licenses || 'なし',
    経験年数: s.experience_years || 0,
    経験概要: s.experience_note || '',
    外国籍: s.is_foreign_national ? `はい（在留資格: ${s.visa_status || '未確認'}）` : 'いいえ',
  };
}

function postingSummary(p, m) {
  return {
    posting_no: p.posting_no,
    事業所名: p.company_name,
    勤務地: [p.prefecture, p.city].filter(Boolean).join(''),
    職種: p.job_title, 職種分類: p.job_category, 雇用形態: p.employment_type,
    賃金: `${p.wage_min ?? '?'}〜${p.wage_max ?? '?'}円（${p.wage_type}）`,
    就業時間: p.shift_work ? '交替制あり' : `${p.work_start || '?'}〜${p.work_end || '?'}`,
    年間休日: p.annual_holidays, 必須資格: p.required_licenses, 歓迎資格: p.preferred_licenses,
    必要経験年数: p.experience_required, 仕事内容: (p.description || '').slice(0, 600),
    ルール判定スコア: m.score, 注意事項: m.warnings,
  };
}

function isAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

// candidates: [{ posting, match }] → Map(posting_no → comment)
async function advise(seeker, candidates, { client } = {}) {
  const payload = {
    求職者: pseudonymizeSeeker(seeker),
    求人候補: candidates.map(c => postingSummary(c.posting, c.match)),
  };
  const anthropic = client || new Anthropic();
  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(payload, null, 1) }],
  });

  if (response.stop_reason === 'refusal') throw new Error('AIが応答を辞退しました');
  if (response.stop_reason === 'max_tokens') throw new Error('AI応答が上限で途切れました');
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const parsed = JSON.parse(text);
  return { payload, comments: new Map(parsed.results.map(r => [r.posting_no, r])) };
}

module.exports = { advise, isAvailable, pseudonymizeSeeker, MODEL };
