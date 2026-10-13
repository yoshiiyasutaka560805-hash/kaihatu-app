'use strict';

const { getDb } = require('../database/db');

// 取込データ1件の列名 → job_postings の列名
// ハローワーク求人票の項目名・英字キーの両方を受け付ける
const FIELD_ALIASES = {
  posting_no:         ['posting_no', '求人番号'],
  company_name:       ['company_name', '事業所名'],
  prefecture:         ['prefecture', '都道府県'],
  city:               ['city', '市区町村', '就業場所'],
  address:            ['address', '所在地', '就業場所住所'],
  job_title:          ['job_title', '職種'],
  job_category:       ['job_category', '職種分類', '職業分類'],
  employment_type:    ['employment_type', '雇用形態'],
  wage_type:          ['wage_type', '賃金形態'],
  wage_min:           ['wage_min', '賃金下限', '基本給下限'],
  wage_max:           ['wage_max', '賃金上限', '基本給上限'],
  work_start:         ['work_start', '始業時刻', '就業開始'],
  work_end:           ['work_end', '終業時刻', '就業終了'],
  shift_work:         ['shift_work', '交替制', '夜勤'],
  days_per_week:      ['days_per_week', '週所定労働日数'],
  annual_holidays:    ['annual_holidays', '年間休日数'],
  holidays_note:      ['holidays_note', '休日等'],
  required_licenses:  ['required_licenses', '必須資格', '必要な免許・資格'],
  preferred_licenses: ['preferred_licenses', '歓迎資格'],
  experience_required:['experience_required', '必要経験年数'],
  age_min:            ['age_min', '年齢下限'],
  age_max:            ['age_max', '年齢上限'],
  age_exception_reason:['age_exception_reason', '年齢制限該当事由'],
  foreigner_ok:       ['foreigner_ok', '外国人雇用'],
  description:        ['description', '仕事内容'],
  received_date:      ['received_date', '受付年月日', '受理日'],
  expiry_date:        ['expiry_date', '紹介期限日'],
  source_url:         ['source_url', 'URL'],
};

const INT_FIELDS = new Set(['wage_min', 'wage_max', 'days_per_week', 'annual_holidays',
  'experience_required', 'age_min', 'age_max']);
const BOOL_FIELDS = new Set(['shift_work', 'foreigner_ok']);
const WAGE_TYPES = { '月給': 'monthly', '時給': 'hourly', '日給': 'daily' };

function toInt(v) {
  if (v == null || v === '') return null;
  const n = parseInt(String(v).replace(/[,，円\s]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function toBool(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (['1', 'true', 'あり', '有', '可', 'はい'].includes(s)) return 1;
  if (['0', 'false', 'なし', '無', '不可', 'いいえ'].includes(s)) return 0;
  return null;
}

function toTime(v) {
  if (v == null || v === '') return null;
  const m = String(v).match(/(\d{1,2})[:時：](\d{2})?/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${(m[2] || '00')}`;
}

function normalizePosting(raw) {
  const p = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const key = aliases.find(a => raw[a] != null && raw[a] !== '');
    if (key === undefined) continue;
    let v = raw[key];
    if (typeof v === 'string') v = v.trim();
    if (INT_FIELDS.has(field)) v = toInt(v);
    else if (BOOL_FIELDS.has(field)) v = toBool(v);
    else if (field === 'work_start' || field === 'work_end') v = toTime(v);
    else if (field === 'wage_type') v = WAGE_TYPES[v] || v;
    p[field] = v;
  }
  if (!p.posting_no) throw new Error('求人番号がありません');
  if (!p.company_name) throw new Error(`求人番号 ${p.posting_no}: 事業所名がありません`);
  if (!p.job_title) throw new Error(`求人番号 ${p.posting_no}: 職種がありません`);
  return p;
}

// 求人番号で upsert。戻り値: 'inserted' | 'updated'
function upsertPosting(posting, source) {
  const db = getDb();
  const p = { ...posting, source };
  const exists = db.prepare('SELECT id FROM job_postings WHERE posting_no = ?').get(p.posting_no);
  const cols = Object.keys(p);
  if (exists) {
    const set = cols.map(c => `${c} = @${c}`).join(', ');
    db.prepare(`UPDATE job_postings SET ${set}, is_active = 1,
      fetched_at = datetime('now','localtime') WHERE posting_no = @posting_no`).run(p);
    return 'updated';
  }
  db.prepare(`INSERT INTO job_postings (${cols.join(', ')})
    VALUES (${cols.map(c => '@' + c).join(', ')})`).run(p);
  return 'inserted';
}

// 紹介期限切れの求人を無効化
function deactivateExpired() {
  return getDb().prepare(`UPDATE job_postings SET is_active = 0
    WHERE is_active = 1 AND expiry_date IS NOT NULL AND expiry_date < date('now','localtime')`).run().changes;
}

// 取込処理を fetch_runs に記録しながら実行する共通ラッパ
function importRows(rows, source) {
  const db = getDb();
  const run = db.prepare('INSERT INTO fetch_runs (source) VALUES (?)').run(source);
  const counts = { inserted: 0, updated: 0 };
  const errors = [];
  db.transaction(() => {
    for (const [i, raw] of rows.entries()) {
      try {
        counts[upsertPosting(normalizePosting(raw), source)]++;
      } catch (e) {
        errors.push(`${i + 1}行目: ${e.message}`);
      }
    }
  })();
  const deactivated = deactivateExpired();
  db.prepare(`UPDATE fetch_runs SET finished_at = datetime('now','localtime'),
    inserted = ?, updated = ?, deactivated = ?, status = ?, message = ? WHERE id = ?`)
    .run(counts.inserted, counts.updated, deactivated,
      errors.length && !counts.inserted && !counts.updated ? 'error' : 'success',
      errors.slice(0, 20).join('\n') || null, run.lastInsertRowid);
  return { ...counts, deactivated, errors };
}

module.exports = { normalizePosting, upsertPosting, deactivateExpired, importRows, FIELD_ALIASES };
