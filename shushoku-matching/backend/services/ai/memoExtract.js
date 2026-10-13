'use strict';

// 面談メモ（文字起こし含む）から希望条件を抽出 → 下書き（drafts）に保存し、担当者の承認後に反映
// 送信前に氏名・連絡先・住所・在留カード番号等をマスキングする
const { callStructured } = require('./client');
const { maskText } = require('./pii');
const { FACILITY_TYPES, JOB_KINDS } = require('../../models/specs');

const nullable = t => ({ anyOf: [{ type: t }, { type: 'null' }] });
const SCHEMA = {
  type: 'object',
  properties: {
    prefecture: nullable('string'), city: nullable('string'), acceptable_cities: nullable('string'),
    max_commute_minutes: nullable('integer'), transport: nullable('string'),
    desired_categories: nullable('string'), desired_job_kinds: nullable('string'),
    desired_facility_types: nullable('string'), excluded_facility_types: nullable('string'),
    desired_employment: nullable('string'),
    desired_wage_type: { anyOf: [{ type: 'string', enum: ['monthly', 'hourly', 'daily', 'annual'] }, { type: 'null' }] },
    desired_wage_min: nullable('integer'), available_start: nullable('string'), available_end: nullable('string'),
    shift_ok: nullable('boolean'), night_max_per_month: nullable('integer'), night_only: nullable('boolean'),
    max_days_per_week: nullable('integer'), min_annual_holidays: nullable('integer'), available_from: nullable('string'),
    licenses: nullable('string'), experience_years: nullable('integer'), experience_note: nullable('string'),
    priorities: nullable('string'), jlpt_level: nullable('string'), visa_status: nullable('string'),
    uncertain_points: { type: 'array', items: { type: 'string' } },
  },
  required: ['uncertain_points'],
  additionalProperties: false,
};

const SYSTEM = `職業紹介の面談メモから、求職者の希望条件を抽出してください。
- メモに明記されたことだけを抽出し、不明な項目は null。推測で埋めない。曖昧な点は uncertain_points に書く。
- 複数値はカンマ区切り。施設種別は次から選ぶ：${FACILITY_TYPES.join('/')}。職務は次から選ぶ：${JOB_KINDS.join('/')}。
- 賃金は円単位の整数（「22万」→220000）。時刻は HH:MM。日付は YYYY-MM-DD。
- 本籍・出生地・宗教・思想信条・支持政党・労働組合・家族の職業など、職業紹介で収集してはならない情報は抽出しない。
- ［氏名］［電話］等は伏字です。復元しようとしないこと。`;

async function extractFromMemo(seeker, memo) {
  const masked = maskText(memo, [seeker?.name, seeker?.name_kana]);
  const data = await callStructured({
    purpose: 'memo_extract', system: SYSTEM, content: masked.slice(0, 20000), schema: SCHEMA,
    seekerId: seeker?.id, fieldsSent: { memo: 'masked', length: masked.length }, effort: 'low',
  });
  for (const k of Object.keys(data)) if (data[k] === null) delete data[k];
  for (const b of ['shift_ok', 'night_only']) if (b in data) data[b] = data[b] ? 1 : 0;
  return { data, masked };
}

module.exports = { extractFromMemo, SCHEMA };
