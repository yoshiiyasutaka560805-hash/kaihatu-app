'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { scoreMatch } = require('../services/matching/ruleScore');

const today = '2026-10-13';
const settings = { wage_tolerance_percent: '5', tokutei_visiting_allowed: '0' };
const base = {
  is_active: 1, posting_no: 'X-1', company_name: 'A', prefecture: '大阪府', city: '堺市北区', job_title: '介護職員',
  job_category: '介護', facility_type: '特養', job_kind: '介護職', employment_type: '正社員', wage_type: 'monthly',
  wage_min: 220000, wage_max: 260000, work_start: '09:00', work_end: '18:00', shift_work: 0, days_per_week: 5,
  annual_holidays: 110, required_licenses: '', preferred_licenses: '', experience_required: 0, expiry_date: '2026-12-31',
};
const seeker = {
  prefecture: '大阪府', city: '堺市', acceptable_cities: '和泉市', desired_categories: '介護', desired_facility_types: '特養',
  desired_employment: '正社員', desired_wage_type: 'monthly', desired_wage_min: 200000, available_start: '08:00',
  available_end: '19:00', shift_ok: 0, max_days_per_week: 5, min_annual_holidays: 105, licenses: '介護福祉士', experience_years: 3,
};
const run = (s, p, extra = {}) => scoreMatch({ ...seeker, ...s }, { ...base, ...p }, { today, settings, ...extra });

test('全条件一致', () => {
  const r = run({}, {});
  assert.equal(r.excluded, false);
  assert.equal(r.score, 30 + 20 + 15 + 10 + 10 + 8);
  assert.ok(r.completeness > 0);
});

test('通勤範囲外は除外し、改善ヒントを返す', () => {
  const r = run({}, { city: '大阪市北区' });
  assert.ok(r.excluded);
  assert.equal(r.reasonDetails[0].code, 'area');
  assert.match(r.reasonDetails[0].hint, /通勤可能地域/);
});

test('同名市（府中市）は都道府県で区別', () => {
  const s = { prefecture: '東京都', city: '府中市', acceptable_cities: '' };
  assert.equal(run(s, { prefecture: '東京都', city: '府中市' }).excluded, false);
  assert.ok(run(s, { prefecture: '広島県', city: '府中市' }).excluded);
});

test('通勤時間がある場合は時間で判定', () => {
  assert.ok(run({ max_commute_minutes: 30 }, {}, { commuteMinutes: 45 }).excluded);
  const ok = run({ max_commute_minutes: 60 }, { city: '大阪市北区' }, { commuteMinutes: 40 });
  assert.equal(ok.excluded, false);
});

test('上位資格は下位資格の要件を満たす／逆は不可', () => {
  assert.equal(run({ licenses: '介護福祉士' }, { required_licenses: '介護職員初任者研修' }).excluded, false);
  assert.ok(run({ licenses: '介護' }, { required_licenses: '介護福祉士' }).excluded);
});

test('賃金：許容範囲内の不足は除外せず注意', () => {
  const r = run({ desired_wage_min: 270000 }, {});
  assert.equal(r.excluded, false);
  assert.ok(r.warnings.some(w => w.includes('許容範囲内')));
  assert.ok(run({ desired_wage_min: 300000 }, {}).excluded);
});

test('賃金：夜勤手当・固定手当を含めて比較', () => {
  const r = run({ desired_wage_min: 250000, shift_ok: 1 }, { wage_max: 230000, allowances_monthly: 10000, night_allowance: 6000, nights_per_month: 4, shift_work: 1 });
  assert.equal(r.excluded, false);
});

test('夜勤：回数の上限', () => {
  assert.ok(run({ night_max_per_month: 3 }, { shift_work: 1, nights_per_month: 5 }).excluded);
  assert.equal(run({ night_max_per_month: 5 }, { shift_work: 1, nights_per_month: 4 }).excluded, false);
  assert.ok(run({ shift_ok: 0 }, { shift_work: 1 }).reasons.includes('交替制・夜勤が不可'));
});

test('施設種別の不可指定', () => {
  assert.ok(run({ excluded_facility_types: '特養' }, {}).excluded);
});

test('特定技能：訪問系は設定で可にしない限り除外、受入不可は除外', () => {
  const s = { is_foreign_national: 1, visa_status: '特定技能1号', residence_checked_date: '2026-10-01', residence_expiry: '2027-10-01' };
  assert.ok(run(s, { visiting_care: 1 }).reasonDetails.some(r => r.code === 'tokutei_visiting'));
  const allowed = scoreMatch({ ...seeker, ...s }, { ...base, visiting_care: 1 }, { today, settings: { ...settings, tokutei_visiting_allowed: '1' } });
  assert.equal(allowed.excluded, false);
  assert.ok(run(s, { tokutei_ok: 0 }).excluded);
});

test('在留：期限切れは除外、90日以内・未確認は注意', () => {
  const s = { is_foreign_national: 1, visa_status: '永住者' };
  assert.ok(run({ ...s, residence_expiry: '2026-10-01' }).excluded);
  const r = run({ ...s, residence_expiry: '2026-12-01' });
  assert.ok(r.warnings.some(w => w.includes('在留期限まで')));
  assert.ok(r.warnings.some(w => w.includes('在留カード原本')));
});

test('留学・家族滞在：資格外活動許可がなければ除外', () => {
  const s = { is_foreign_national: 1, visa_status: '留学', residence_checked_date: '2026-10-01' };
  assert.ok(run(s).reasonDetails.some(r => r.code === 'visa_permit'));
  const r = run({ ...s, extra_activity_permit: 1 });
  assert.ok(r.warnings.some(w => w.includes('週28時間')));
});

test('年齢条件は例外事由がなければ判定に使わない', () => {
  const s = { birth_date: '1960-01-01' };
  assert.equal(run(s, { age_max: 59 }).excluded, false);
  assert.ok(run(s, { age_max: 59, age_exception_reason: '定年（60歳）' }).excluded);
});

test('重みプロファイル：賃金重視は賃金配点40', () => {
  const r = run({ weight_profile: 'wage' }, {});
  assert.equal(r.items.find(i => i.label === '賃金').max, 40);
  assert.equal(r.items.reduce((s, i) => s + i.max, 0), 100);
});

test('案内可否の4段階判定', () => {
  assert.equal(run({}, {}).verdict.level, 'high');
  assert.equal(run({ desired_categories: '事務', desired_facility_types: '' }, {}).verdict.level, 'ok');
  assert.equal(run({ is_foreign_national: 1, visa_status: '永住者' }, {}).verdict.level, 'check');
  assert.equal(run({}, { city: '大阪市北区' }).verdict.level, 'ng');
  assert.equal(run({}, { city: '大阪市北区' }).verdict.label, '案内不可');
  const sparse = run({}, { annual_holidays: null, days_per_week: null, work_start: null, description: null, facility_type: null, employment_term: null });
  assert.equal(sparse.verdict.level, 'check');
  assert.ok(sparse.verdict.confirm.some(c => c.includes('充足率')));
  assert.ok(run({}, {}).referralNote.includes('自社求人化'));
  assert.equal(run({}, { origin: 'own' }).referralNote, null);
});

test('ヒアリング条件：必須の待遇が求人で確認できなければ要確認、週休2日希望は週6日求人を除外', () => {
  const r = run({ required_benefits: '賞与あり,住宅手当' }, { description: '賞与年2回' });
  assert.ok(r.warnings.some(w => w.includes('住宅手当')));
  assert.ok(!r.warnings.some(w => w.includes('賞与あり')));
  assert.equal(r.verdict.level, 'check');
  assert.ok(run({ holiday_pref: '週休2日以上', max_days_per_week: null }, { days_per_week: 6 }).excluded);
  const w = run({ desired_wage_min: 200000, desired_wage_target: 300000 }, {});
  assert.equal(w.excluded, false);
  assert.ok(w.items.find(i => i.label === '賃金').points < 20);
});
