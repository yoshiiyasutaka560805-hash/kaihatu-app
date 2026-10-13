'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { scoreMatch, toMonthly } = require('../services/matching/ruleScore');

const today = new Date('2026-10-13T00:00:00Z');
const base = {
  is_active: 1, posting_no: 'X-1', company_name: 'A', prefecture: '大阪府', city: '堺市',
  job_title: '介護職員', job_category: '介護', employment_type: '正社員', wage_type: 'monthly',
  wage_min: 220000, wage_max: 260000, work_start: '09:00', work_end: '18:00', shift_work: 0,
  days_per_week: 5, annual_holidays: 110, required_licenses: '', preferred_licenses: '',
  experience_required: 0, expiry_date: '2026-12-31',
};
const seeker = {
  prefecture: '大阪府', city: '堺市', acceptable_cities: '和泉市', desired_categories: '介護',
  desired_employment: '正社員', desired_wage_type: 'monthly', desired_wage_min: 200000,
  available_start: '08:00', available_end: '19:00', shift_ok: 0, max_days_per_week: 5,
  min_annual_holidays: 105, licenses: '介護福祉士', experience_years: 3,
};

test('全条件一致で満点', () => {
  const r = scoreMatch(seeker, base, today);
  assert.equal(r.excluded, false);
  assert.equal(r.score, 30 + 20 + 15 + 10 + 10 + 8);
});

test('通勤範囲外は除外', () => {
  const r = scoreMatch(seeker, { ...base, city: '大阪市' }, today);
  assert.ok(r.excluded);
  assert.match(r.reasons[0], /通勤可能範囲外/);
});

test('必須資格不足は除外', () => {
  const r = scoreMatch(seeker, { ...base, required_licenses: '看護師' }, today);
  assert.ok(r.reasons.some(x => x.includes('必須資格不足')));
});

test('資格名の表記ゆれは許容', () => {
  const r = scoreMatch({ ...seeker, licenses: '介護職員初任者研修修了' }, { ...base, required_licenses: '介護職員初任者研修' }, today);
  assert.equal(r.excluded, false);
});

test('賃金上限が希望未満は除外', () => {
  const r = scoreMatch({ ...seeker, desired_wage_min: 300000 }, base, today);
  assert.ok(r.reasons.includes('賃金上限が希望額未満'));
});

test('時給求人は月額換算で比較', () => {
  assert.equal(toMonthly(1300, 'hourly'), 208000);
  const r = scoreMatch(seeker, { ...base, wage_type: 'hourly', wage_min: 1300, wage_max: 1300 }, today);
  assert.equal(r.excluded, false);
  assert.ok(r.warnings.some(w => w.includes('月額換算')));
});

test('夜勤不可の求職者に交替制求人は除外', () => {
  const r = scoreMatch(seeker, { ...base, shift_work: 1 }, today);
  assert.ok(r.reasons.includes('交替制・夜勤が不可'));
});

test('勤務可能時間外は除外', () => {
  const r = scoreMatch({ ...seeker, available_end: '17:00' }, base, today);
  assert.ok(r.reasons.some(x => x.includes('勤務可能時間外')));
});

test('紹介期限切れは除外', () => {
  const r = scoreMatch(seeker, { ...base, expiry_date: '2026-10-01' }, today);
  assert.ok(r.reasons.includes('紹介期限切れ'));
});

test('年齢条件は例外事由がなければ判定に使わず警告のみ', () => {
  const s = { ...seeker, birth_date: '1960-01-01' };
  const r1 = scoreMatch(s, { ...base, age_max: 59 }, today);
  assert.equal(r1.excluded, false);
  assert.ok(r1.warnings.some(w => w.includes('例外事由が不明')));
  const r2 = scoreMatch(s, { ...base, age_max: 59, age_exception_reason: '定年（60歳）' }, today);
  assert.ok(r2.excluded);
});

test('外国籍×外国人雇用不可は除外せず警告', () => {
  const r = scoreMatch({ ...seeker, is_foreign_national: 1 }, { ...base, foreigner_ok: 0 }, today);
  assert.equal(r.excluded, false);
  assert.ok(r.warnings.some(w => w.includes('在留資格')));
});

test('上位資格は下位資格の要件を満たす／逆は不可', () => {
  const p = { ...base, required_licenses: '介護職員初任者研修' };
  assert.equal(scoreMatch({ ...seeker, licenses: '介護福祉士' }, p, today).excluded, false);
  const r = scoreMatch({ ...seeker, licenses: '介護' }, { ...base, required_licenses: '介護福祉士' }, today);
  assert.ok(r.excluded);
});
