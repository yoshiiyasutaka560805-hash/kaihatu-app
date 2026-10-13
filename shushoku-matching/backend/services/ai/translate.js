'use strict';

// 提案書（求人比較表）の多言語化。送るのは求人情報のみ（求職者の個人情報は送らない）
const { callStructured } = require('./client');

const LANG_NAMES = {
  ja: '日本語', easy_ja: 'やさしい日本語（ふりがな不要・短い文・難しい漢語を避ける）', en: 'English', vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia', my: 'မြန်မာဘာသာ (Burmese)', ne: 'नेपाली (Nepali)', zh: '简体中文', tl: 'Tagalog',
};

// 介護・労務の固定用語集（訳ゆれ防止）
const GLOSSARY = {
  特養: 'Special nursing home for the elderly (Tokuyo)', 老健: 'Geriatric health services facility (Roken)',
  GH: 'Group home for people with dementia', デイ: 'Day care service', 訪問: 'Home-visit care',
  夜勤: 'night shift', 処遇改善: 'care worker treatment improvement allowance', 賞与: 'bonus', 社会保険: 'social insurance',
  試用期間: 'probation period', 有期: 'fixed-term contract', 無期: 'permanent (no fixed term)',
};

// 構造化出力ではキー可変のオブジェクトを避け、key/text の配列でやり取りする
const KV = { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, text: { type: 'string' } },
  required: ['key', 'text'], additionalProperties: false } };
const SCHEMA = {
  type: 'object',
  properties: {
    labels: KV,
    items: {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'string' }, fields: KV }, required: ['id', 'fields'], additionalProperties: false },
    },
    note: { type: 'string' },
  },
  required: ['labels', 'items', 'note'],
  additionalProperties: false,
};

const toKv = o => Object.entries(o).map(([key, text]) => ({ key, text: text == null ? '' : String(text) }));
const fromKv = a => Object.fromEntries(a.map(x => [x.key, x.text]));

/**
 * @param {string} lang
 * @param {object} labels 表の見出し { key: '日本語ラベル' }
 * @param {Array<{id, fields}>} items 求人ごとの表示値（日本語）
 */
async function translateProposal(lang, labels, items) {
  const parsed = await callStructured({
    purpose: 'translate',
    system: `求人比較表を ${LANG_NAMES[lang]} に翻訳してください。
- 数字・金額・日付・求人番号・事業所名（固有名詞）は変更しない（事業所名は原文のまま、必要なら括弧で読みを補う）。
- 介護・労務の用語は次の用語集の英訳を参考に、その言語で一般的な訳語に統一する：${JSON.stringify(GLOSSARY)}
- 意味を足したり省いたりしない。note には「翻訳は参考です。正式な労働条件は日本語の求人票・労働条件通知書で確認してください」をその言語で書く。`,
    content: JSON.stringify({ labels: toKv(labels), items: items.map(i => ({ id: i.id, fields: toKv(i.fields) })) }),
    schema: SCHEMA,
    fieldsSent: { postings: items.map(i => i.id), seeker: 'none' },
    effort: 'low',
  });
  return { labels: fromKv(parsed.labels), items: parsed.items.map(i => ({ id: i.id, fields: fromKv(i.fields) })), note: parsed.note };
}

module.exports = { translateProposal, LANG_NAMES };
