'use strict';

// 各エンティティの入力項目定義（validate() 用）

const FACILITY_TYPES = ['特養', '老健', '介護医療院', 'GH', '有料', 'サ高住', 'デイ', '訪問', '小多機', '障害', '病院', '保育', 'その他'];
const JOB_KINDS = ['介護職', '生活相談員', '看護職', 'ケアマネ', '機能訓練', '送迎', '調理', '事務', 'その他'];
const SEEKER_STATUSES = ['受付', '紹介中', '面接', '内定', '就職', '終了'];
const INTRO_STATUSES = ['未提案', '提案済', '応募', '面接', '内定', '入職', '不採用', '辞退'];
const DECLINE_REASONS = ['賃金', '勤務地・通勤', '勤務時間・夜勤', '休日', '職種・仕事内容', '施設形態', '職場の雰囲気',
  '他社で決定', '本人都合', '連絡不通', '求人者の判断（スキル）', '求人者の判断（日本語）', '求人者の判断（その他）', '求人充足', 'その他'];
const LANGUAGES = ['ja', 'easy_ja', 'en', 'vi', 'id', 'my', 'ne', 'zh', 'tl'];
const WEIGHT_PROFILES = ['balanced', 'wage', 'proximity', 'holiday'];
const VISA_TYPES = ['特定技能1号', '特定技能2号', '介護', '技能実習', '育成就労', '留学', '家族滞在', '永住者', '定住者',
  '日本人の配偶者等', '永住者の配偶者等', '特定活動', 'その他'];

const employer = {
  name: 'text:100', corporate_number: 'text:13', prefecture: 'text:10', city: 'text:50', address: 'text:200',
  contact_person: 'text:50', contact_title: 'text:50', phone: 'text:30', email: 'text:100',
  facility_types: 'text:200', tokutei_support: 'text:200', council_joined: 'bool', contract_date: 'date',
  fee_rate_percent: 'num', refund_policy: 'text:2000', notes: 'text:2000',
};

const posting = {
  posting_no: 'text:40', origin: ['hw', 'own'], employer_id: 'int', hw_posting_no: 'text:40',
  company_name: 'text:100', prefecture: 'text:10', city: 'text:50', address: 'text:200', nearest_station: 'text:50',
  job_title: 'text:100', job_category: 'text:50', facility_type: 'text:20', job_kind: 'text:20', visiting_care: 'bool',
  employment_type: 'text:30', employment_term: ['無期', '有期'], contract_period: 'text:100', trial_period: 'text:100',
  wage_type: ['monthly', 'hourly', 'daily', 'annual'], wage_min: 'yen', wage_max: 'yen', allowances_monthly: 'yen',
  night_allowance: 'yen', nights_per_month: 'int', bonus_months: 'num', other_annual: 'yen',
  work_start: 'time', work_end: 'time', daily_hours: 'num', shift_work: 'bool', days_per_week: 'int',
  annual_holidays: 'int', holidays_note: 'text:200', overtime: 'text:200', social_insurance: 'text:200',
  smoking_measure: 'text:200', job_change_scope: 'text:300', place_change_scope: 'text:300', commute_note: 'text:200',
  required_licenses: 'text:200', preferred_licenses: 'text:200', experience_required: 'int', japanese_level: 'text:20',
  age_min: 'int', age_max: 'int', age_exception_reason: 'text:200', foreigner_ok: 'bool', tokutei_ok: 'bool',
  openings: 'int', description: 'text:3000', received_date: 'date', expiry_date: 'date', source_url: 'url',
};

const seeker = {
  name: 'text:50', name_kana: 'text:50', phone: 'text:30', email: 'text:100', address: 'text:200', birth_date: 'date',
  accepted_date: 'date', validity_end: 'date', consent_date: 'date', ai_consent: 'bool', preferred_language: LANGUAGES,
  prefecture: 'text:10', city: 'text:50', nearest_station: 'text:50', acceptable_cities: 'text:300',
  transport: 'text:50', max_commute_minutes: 'int', desired_categories: 'text:200', desired_facility_types: 'text:200',
  excluded_facility_types: 'text:200', desired_job_kinds: 'text:200', desired_employment: 'text:100',
  desired_wage_type: ['monthly', 'hourly', 'daily', 'annual'], desired_wage_min: 'yen',
  available_start: 'time', available_end: 'time', shift_ok: 'bool', night_max_per_month: 'int', night_only: 'bool',
  max_days_per_week: 'int', min_annual_holidays: 'int', available_from: 'date', licenses: 'text:300',
  experience_years: 'int', experience_note: 'text:2000', priorities: 'text:500', weight_profile: WEIGHT_PROFILES,
  is_foreign_national: 'bool', visa_status: 'text:30', residence_expiry: 'date', work_restriction: 'text:100',
  extra_activity_permit: 'bool', residence_checked_date: 'date', residence_checked_by: 'text:30',
  jlpt_level: ['N1', 'N2', 'N3', 'N4', 'N5', 'なし'], care_japanese_test: 'bool', skill_test: 'text:100',
  notes: 'text:3000', status: SEEKER_STATUSES,
};

const match = {
  intro_status: INTRO_STATUSES, proposed_date: 'date', applied_date: 'date', interview_at: 'datetime',
  interview_place: 'text:200', interview_result: 'text:200', offer_date: 'date', decline_reason: DECLINE_REASONS,
  note: 'text:2000',
};

const placement = {
  hire_date: 'date', employment_term: ['無期', '有期'], monthly_wage: 'yen', fee_basis_months: 'num',
  fee_rate_percent: 'num', fee_amount: 'yen', fee_basis_note: 'text:500', invoice_no: 'text:40',
  invoice_date: 'date', due_date: 'date', paid_date: 'date', paid_amount: 'yen', separation_date: 'date',
  separation_type: ['自己都合', '会社都合', '解雇', '契約満了', 'その他'], separation_reason: 'text:500',
  separation_unknown: 'bool', refund_rate: 'num', refund_amount: 'yen', refund_date: 'date',
};

const followup = { kind: ['1週', '1か月', '3か月', '6か月', 'その他'], due_date: 'date', done_date: 'date',
  method: 'text:30', still_employed: 'tribool', note: 'text:2000' };

const complaint = { received_date: 'date', from_type: ['求職者', '求人者', 'その他'], from_name: 'text:50',
  seeker_id: 'int', employer_id: 'int', content: 'text:3000', response: 'text:3000', responder: 'text:30',
  completed_date: 'date' };

const interviewNote = { at: 'datetime', method: ['来所', '電話', 'オンライン', '訪問', 'その他'], memo: 'text:10000' };

const task = { title: 'text:200', due_date: 'date', seeker_id: 'int' };

module.exports = { FACILITY_TYPES, JOB_KINDS, SEEKER_STATUSES, INTRO_STATUSES, DECLINE_REASONS, LANGUAGES,
  WEIGHT_PROFILES, VISA_TYPES, employer, posting, seeker, match, placement, followup, complaint, interviewNote, task };
