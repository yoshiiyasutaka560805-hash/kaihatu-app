'use strict';

const { getDb, getSettings } = require('../database/db');
const spec = require('../models/specs').posting;
const { normalizeDate, normalizeTime, todayJst } = require('../utils/dates');
const { parseYen, parseIntLoose, parseNum, parseBool, parseWageType, safeUrl } = require('../utils/values');
const { normalizePref } = require('../utils/area');

// 取込データの列名 → job_postings の項目名（ハローワーク求人票の項目名・英字キー）
// オンライン提供CSVの実際の列名が異なる場合は、設定「provision_column_map」で追加対応する
const FIELD_ALIASES = {
  posting_no:         ['posting_no', '求人番号'],
  company_name:       ['company_name', '事業所名', '事業所名称'],
  prefecture:         ['prefecture', '都道府県', '就業場所都道府県'],
  city:               ['city', '市区町村', '就業場所', '就業場所市区町村'],
  address:            ['address', '所在地', '就業場所住所'],
  nearest_station:    ['nearest_station', '最寄り駅'],
  job_title:          ['job_title', '職種'],
  job_category:       ['job_category', '職種分類', '職業分類'],
  facility_type:      ['facility_type', '施設種別'],
  job_kind:           ['job_kind', '職務区分'],
  visiting_care:      ['visiting_care', '訪問系業務'],
  employment_type:    ['employment_type', '雇用形態'],
  employment_term:    ['employment_term', '雇用期間の定め', '無期有期'],
  contract_period:    ['contract_period', '契約期間'],
  trial_period:       ['trial_period', '試用期間'],
  wage_type:          ['wage_type', '賃金形態'],
  wage_min:           ['wage_min', '賃金下限', '基本給下限'],
  wage_max:           ['wage_max', '賃金上限', '基本給上限'],
  allowances_monthly: ['allowances_monthly', '定額的手当'],
  night_allowance:    ['night_allowance', '夜勤手当'],
  nights_per_month:   ['nights_per_month', '夜勤回数'],
  bonus_months:       ['bonus_months', '賞与月数'],
  other_annual:       ['other_annual', 'その他年間支給'],
  work_start:         ['work_start', '始業時刻', '就業開始'],
  work_end:           ['work_end', '終業時刻', '就業終了'],
  daily_hours:        ['daily_hours', '所定労働時間'],
  shift_work:         ['shift_work', '交替制', '夜勤'],
  days_per_week:      ['days_per_week', '週所定労働日数'],
  annual_holidays:    ['annual_holidays', '年間休日数'],
  holidays_note:      ['holidays_note', '休日等'],
  overtime:           ['overtime', '時間外労働'],
  social_insurance:   ['social_insurance', '加入保険等'],
  smoking_measure:    ['smoking_measure', '受動喫煙対策'],
  job_change_scope:   ['job_change_scope', '業務の変更範囲'],
  place_change_scope: ['place_change_scope', '就業場所の変更範囲'],
  commute_note:       ['commute_note', 'マイカー通勤', '通勤'],
  required_licenses:  ['required_licenses', '必須資格', '必要な免許・資格'],
  preferred_licenses: ['preferred_licenses', '歓迎資格'],
  experience_required:['experience_required', '必要経験年数'],
  japanese_level:     ['japanese_level', '日本語能力'],
  age_min:            ['age_min', '年齢下限'],
  age_max:            ['age_max', '年齢上限'],
  age_exception_reason:['age_exception_reason', '年齢制限該当事由'],
  foreigner_ok:       ['foreigner_ok', '外国人雇用'],
  tokutei_ok:         ['tokutei_ok', '特定技能受入'],
  openings:           ['openings', '求人数', '採用人数'],
  description:        ['description', '仕事内容'],
  received_date:      ['received_date', '受付年月日', '受理日'],
  expiry_date:        ['expiry_date', '紹介期限日'],
  source_url:         ['source_url', 'URL'],
};

const IMPORT_FIELDS = Object.keys(FIELD_ALIASES);

function convert(field, v) {
  if (typeof v === 'string') v = v.trim();
  if (v == null || v === '') return null;
  switch (field) {
    case 'wage_min': case 'wage_max': case 'allowances_monthly': case 'night_allowance': case 'other_annual':
      return parseYen(v);
    case 'nights_per_month': case 'days_per_week': case 'annual_holidays': case 'experience_required':
    case 'age_min': case 'age_max': case 'openings':
      return parseIntLoose(v);
    case 'bonus_months': case 'daily_hours': return parseNum(v);
    case 'shift_work': case 'foreigner_ok': case 'tokutei_ok': case 'visiting_care': return parseBool(v);
    case 'work_start': case 'work_end': return normalizeTime(v);
    case 'received_date': case 'expiry_date': return normalizeDate(v);
    case 'wage_type': return parseWageType(v) || 'monthly';
    case 'prefecture': return normalizePref(v) || String(v);
    case 'source_url': return safeUrl(v);
    case 'employment_term': {
      const s = String(v);
      if (/無期|定めなし|なし/.test(s)) return '無期';
      if (/有期|定めあり|あり/.test(s)) return '有期';
      return null;
    }
    default: return String(v);
  }
}

// 1行（オブジェクト）→ 求人。columnMap: { 'CSV列名': '項目名' }
function normalizePosting(raw, columnMap = {}) {
  const src = { ...raw };
  for (const [col, field] of Object.entries(columnMap)) {
    if (raw[col] !== undefined && FIELD_ALIASES[field]) src[field] = raw[col];
  }
  const p = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const key = aliases.find(a => src[a] != null && String(src[a]).trim() !== '');
    p[field] = key === undefined ? null : convert(field, src[key]);
  }
  if (!p.wage_type) p.wage_type = 'monthly';
  // 年俸は月額に換算せず annual として保持（比較時に /12）
  if (!p.posting_no) throw new Error('求人番号がありません');
  if (!p.company_name) throw new Error(`求人番号 ${p.posting_no}: 事業所名がありません`);
  if (!p.job_title) throw new Error(`求人番号 ${p.posting_no}: 職種がありません`);
  for (const d of ['received_date', 'expiry_date']) {
    const original = FIELD_ALIASES[d].map(a => src[a]).find(x => x != null && String(x).trim() !== '');
    if (original && !p[d]) throw new Error(`求人番号 ${p.posting_no}: 日付を解釈できません（${original}）`);
  }
  return p;
}

// HW等の外部取込：求人番号で upsert。取込項目は全置換（列に無い項目は空になる）
// 手動で募集終了にした求人は再取込でも有効化しない。自社受理求人（origin=own）は上書きしない
function upsertPosting(p, source, extra = {}) {
  const db = getDb();
  const row = { ...p, source, ...extra };
  const exists = db.prepare('SELECT id, origin, closed_manually FROM job_postings WHERE posting_no = ?').get(p.posting_no);
  const cols = [...IMPORT_FIELDS, 'source', ...Object.keys(extra)];
  for (const c of cols) if (row[c] === undefined) row[c] = null;
  if (exists) {
    if (exists.origin === 'own') return 'skipped';
    db.prepare(`UPDATE job_postings SET ${cols.map(c => `${c} = @${c}`).join(', ')},
      is_active = CASE WHEN closed_manually = 1 THEN 0 ELSE 1 END,
      fetched_at = datetime('now','localtime'), updated_at = datetime('now','localtime')
      WHERE posting_no = @posting_no`).run(row);
    return 'updated';
  }
  db.prepare(`INSERT INTO job_postings (${cols.join(', ')}, origin) VALUES (${cols.map(c => '@' + c).join(', ')}, ?)`).run(row, source === 'web_search' ? 'web' : 'hw');
  return 'inserted';
}

function deactivateExpired() {
  return getDb().prepare(`UPDATE job_postings SET is_active = 0, updated_at = datetime('now','localtime')
    WHERE is_active = 1 AND expiry_date IS NOT NULL AND expiry_date < ?`).run(todayJst()).changes;
}

function importRows(rows, source, { sourceFile = null, terms = null } = {}) {
  const db = getDb();
  const settings = getSettings();
  let columnMap = {};
  if (source === 'hw_provision') {
    try { columnMap = JSON.parse(settings.provision_column_map || '{}'); } catch { columnMap = {}; }
  }
  const extra = { source_file: sourceFile, provision_terms: terms };
  const run = db.prepare('INSERT INTO fetch_runs (source) VALUES (?)').run(source);
  const counts = { inserted: 0, updated: 0, skipped: 0 };
  const errors = [];
  db.transaction(() => {
    for (const [i, raw] of rows.entries()) {
      try { counts[upsertPosting(normalizePosting(raw, columnMap), source, extra)]++; }
      catch (e) { errors.push(`${i + 2}行目: ${e.message}`); }
    }
  })();
  const deactivated = deactivateExpired();
  db.prepare(`UPDATE fetch_runs SET finished_at = datetime('now','localtime'),
    inserted = ?, updated = ?, deactivated = ?, status = ?, message = ? WHERE id = ?`)
    .run(counts.inserted, counts.updated, deactivated,
      errors.length && !counts.inserted && !counts.updated ? 'error' : 'success',
      [counts.skipped ? `自社求人と同番号のためスキップ ${counts.skipped}件` : null, ...errors.slice(0, 30)].filter(Boolean).join('\n') || null,
      run.lastInsertRowid);
  return { ...counts, deactivated, errors };
}

// 自社求人番号の採番：R-YYYY-NNNN
function nextOwnPostingNo() {
  const y = todayJst().slice(0, 4);
  const last = getDb().prepare("SELECT posting_no FROM job_postings WHERE posting_no LIKE ? ORDER BY posting_no DESC LIMIT 1")
    .get(`R-${y}-%`);
  const n = last ? Number(last.posting_no.split('-')[2]) + 1 : 1;
  return `R-${y}-${String(n).padStart(4, '0')}`;
}

// 職業安定法5条の3 等に基づく労働条件明示の主な項目（自社受理求人で入力必須）
// ※明示事項の最新の範囲は業務運営要領・厚労省資料で要確認
const DISCLOSURE_ITEMS = [
  ['job_title', '従事すべき業務の内容'], ['description', '業務内容の詳細'], ['job_change_scope', '業務の変更の範囲'],
  ['employment_term', '労働契約の期間（無期/有期）'], ['trial_period', '試用期間'],
  ['address', '就業の場所'], ['place_change_scope', '就業場所の変更の範囲'],
  ['work_start', '始業時刻'], ['work_end', '終業時刻'], ['overtime', '時間外労働の有無'],
  ['annual_holidays', '休日（年間休日数）'], ['wage_min', '賃金'], ['social_insurance', '加入保険'],
  ['smoking_measure', '受動喫煙防止措置'], ['employment_type', '雇用形態'],
];

function disclosureMissing(p) {
  const missing = DISCLOSURE_ITEMS.filter(([f]) => p[f] == null || p[f] === '').map(([, label]) => label);
  if (p.employment_term === '有期' && !p.contract_period) missing.push('契約期間・更新の有無と上限');
  if (p.shift_work) {
    const i = missing.indexOf('始業時刻'); if (i >= 0) missing.splice(i, 1);
    const j = missing.indexOf('終業時刻'); if (j >= 0) missing.splice(j, 1);
  }
  return missing;
}

module.exports = { FIELD_ALIASES, IMPORT_FIELDS, normalizePosting, upsertPosting, deactivateExpired, importRows,
  nextOwnPostingNo, DISCLOSURE_ITEMS, disclosureMissing, spec };
