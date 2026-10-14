'use strict';

// AI送信前のマスキングと、収集が原則禁止される情報の検知

const { ageOn } = require('../../utils/dates');

const PATTERNS = [
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '［メール］'],
  [/(?<!\d)(\+?81[-\s]?|0)\d{1,4}[-\s(]?\d{1,4}[-\s)]?\d{3,4}(?!\d)/g, '［電話］'],
  [/〒?\s?\d{3}-\d{4}/g, '［郵便番号］'],
  [/\b[A-Z]{2}\d{8}[A-Z]{2}\b/g, '［在留カード番号］'],
  [/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '［個人番号］'],
  [/(19|20)\d{2}[年/.-]\d{1,2}[月/.-]\d{1,2}日?生?/g, '［日付］'],
  [/[^\s、。]{1,10}(丁目|番地|番\d|号室)/g, '［住所］'],
];

// 自由記述から個人を特定しうる情報を伏せる。knownNames: 氏名・フリガナ等
function maskText(text, knownNames = []) {
  if (!text) return '';
  let s = String(text);
  for (const n of knownNames.filter(Boolean)) {
    for (const part of String(n).split(/[\s　]+/).filter(p => p.length >= 2)) {
      s = s.split(part).join('［氏名］');
    }
    s = s.split(String(n)).join('［氏名］');
  }
  for (const [re, rep] of PATTERNS) s = s.replace(re, rep);
  return s;
}

// 求職者の仮名化（AI送信用）
function pseudonymizeSeeker(s) {
  const age = ageOn(s.birth_date);
  const names = [s.name, s.name_kana];
  return {
    年代: age != null ? `${Math.floor(age / 10) * 10}代` : '不明',
    居住地域: [s.prefecture, s.city].filter(Boolean).join(''),
    通勤可能地域: s.acceptable_cities || '',
    通勤上限分: s.max_commute_minutes || '未設定',
    希望職種: [s.desired_categories, s.desired_job_kinds].filter(Boolean).join('、'),
    希望施設種別: s.desired_facility_types || '',
    不可施設種別: s.excluded_facility_types || '',
    希望雇用形態: s.desired_employment || '',
    希望賃金: s.desired_wage_min ? `${s.desired_wage_min}円（${s.desired_wage_type || 'monthly'}）` : '未設定',
    勤務可能時間: s.available_start && s.available_end ? `${s.available_start}〜${s.available_end}` : '未設定',
    夜勤: s.night_only ? '夜勤専従希望' : (s.night_max_per_month != null ? `月${s.night_max_per_month}回まで` : (s.shift_ok ? '可' : '不可')),
    週勤務日数上限: s.max_days_per_week || '未設定',
    希望年間休日: s.min_annual_holidays || '未設定',
    保有資格: s.licenses || 'なし',
    経験年数: s.experience_years || 0,
    経験概要: maskText(s.experience_note, names).slice(0, 800),
    優先順位: maskText(s.priorities, names).slice(0, 300),
    希望給与: s.desired_wage_target ? `${s.desired_wage_target}円` : '未設定',
    勤務時間帯: s.shift_pattern || '',
    必須の待遇: s.required_benefits || '',
    休日の希望: [s.holiday_pref, s.fixed_day_off ? `固定休:${s.fixed_day_off}` : ''].filter(Boolean).join(' '),
    運転免許: s.driver_license || '',
    経験した現場: s.experience_settings || '',
    夜勤経験: s.night_experience || '',
    看護の診療科経験: s.nurse_specialty || '',
    避けたい_譲れない条件: maskText(s.must_conditions, names).slice(0, 300),
    転職理由: maskText(s.motivation, names).slice(0, 300),
    入職希望時期: s.available_from || '',
    外国籍: s.is_foreign_national ? `はい（在留資格: ${s.visa_status || '未確認'}、日本語: ${s.jlpt_level || '不明'}）` : 'いいえ',
  };
}

// 職業安定法の指針で原則収集してはならない情報（社会的差別の原因となるおそれのある事項等）の検知
// ※正確な範囲は指針（平成11年労働省告示141号）で要確認。検知は注意喚起であり、業務上必要な場合は担当者が判断
const PROHIBITED_TERMS = [
  ['本籍', '本籍'], ['出生地', '出生地'], ['出身地', '出生地'], ['宗教', '思想・信条・宗教'], ['信仰', '思想・信条・宗教'],
  ['支持政党', '思想・信条'], ['政党', '思想・信条'], ['思想', '思想・信条'], ['労働組合', '労働組合への加入'],
  ['組合活動', '労働組合への加入'], ['部落', '社会的身分・門地'], ['門地', '社会的身分・門地'], ['家柄', '社会的身分・門地'],
  ['人種', '人種・民族'], ['民族', '人種・民族'], ['尊敬する人物', '思想・信条'], ['愛読書', '思想・信条'],
  ['家族の職業', '家族状況（就職差別につながるおそれ）'], ['親の職業', '家族状況（就職差別につながるおそれ）'],
  ['資産', '家庭環境'], ['住宅状況', '家庭環境'],
];

function detectProhibited(texts) {
  const found = new Map();
  for (const t of texts.filter(Boolean)) {
    for (const [term, cat] of PROHIBITED_TERMS) if (String(t).includes(term)) found.set(term, cat);
  }
  return [...found].map(([term, category]) => ({ term, category }));
}

module.exports = { maskText, pseudonymizeSeeker, detectProhibited };
