'use strict';

// 求人票（PDF・画像）の読み取り → 下書き。事業所から受け取った求人票（事業所情報）が対象
const { callStructured } = require('./client');
const { IMPORT_FIELDS } = require('../postingStore');

const SCHEMA = {
  type: 'object',
  properties: {
    fields: {
      type: 'object',
      properties: Object.fromEntries(IMPORT_FIELDS.map(f => [f, { anyOf: [{ type: 'string' }, { type: 'null' }] }])),
      required: IMPORT_FIELDS,
      additionalProperties: false,
    },
    uncertain_points: { type: 'array', items: { type: 'string' } },
  },
  required: ['fields', 'uncertain_points'],
  additionalProperties: false,
};

const SYSTEM = `求人票（ハローワーク求人票または事業所の募集要項）の内容を項目ごとに抽出してください。
- 記載がない項目は null。推測で埋めない。読み取りに自信がない値は uncertain_points に記載。
- 値は原文の表記のままでよい（日付・金額の正規化はシステム側で行う）。ただし wage_type は 月給/時給/日給/年俸 のいずれか。
- employment_term は「無期」「有期」のいずれか。shift_work / foreigner_ok / tokutei_ok / visiting_care は「あり」「なし」。
- 項目名: posting_no=求人番号, company_name=事業所名, job_title=職種, description=仕事内容, job_change_scope=業務の変更範囲, place_change_scope=就業場所の変更範囲, smoking_measure=受動喫煙対策, expiry_date=紹介期限日。`;

const MEDIA = { 'application/pdf': 'document', 'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image', 'image/gif': 'image' };

async function readPosting(buffer, mimetype, sourceName) {
  const kind = MEDIA[mimetype];
  if (!kind) throw Object.assign(new Error('PDF・PNG・JPEG・WebP のみ対応しています'), { status: 400 });
  const block = { type: kind, source: { type: 'base64', media_type: mimetype, data: buffer.toString('base64') } };
  const parsed = await callStructured({
    purpose: 'posting_ocr', system: SYSTEM, schema: SCHEMA,
    content: [block, { type: 'text', text: '添付の求人票から項目を抽出してください。' }],
    fieldsSent: { file: sourceName, size: buffer.length }, effort: 'medium',
  });
  return parsed;
}

module.exports = { readPosting };
