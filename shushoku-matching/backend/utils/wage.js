'use strict';

// 賃金の月額・年収換算（比較用の概算）
// 時給・日給は求人の所定労働時間・日数から換算し、不明な場合のみ 8時間×週5日 で概算する

const WEEKS_PER_MONTH = 52 / 12;

function workHoursPerDay(p) {
  if (p.daily_hours) return p.daily_hours;
  if (p.work_start && p.work_end) {
    const [sh, sm] = p.work_start.split(':').map(Number);
    const [eh, em] = p.work_end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) mins += 24 * 60;
    if (mins > 8 * 60) mins -= 60; else if (mins > 6 * 60) mins -= 45; // 休憩控除（労基法34条の最低限）
    return Math.round(mins / 6) / 10;
  }
  return 8;
}

function daysPerWeek(p) { return p.days_per_week || 5; }

// 指定額・形態を月額に換算（求人の勤務条件を基準とする）
function toMonthlyFor(amount, type, p = {}) {
  if (amount == null) return null;
  switch (type) {
    case 'hourly': return Math.round(amount * workHoursPerDay(p) * daysPerWeek(p) * WEEKS_PER_MONTH);
    case 'daily': return Math.round(amount * daysPerWeek(p) * WEEKS_PER_MONTH);
    case 'annual': return Math.round(amount / 12);
    default: return amount;
  }
}

// 求人の月額見込み（基本給＋固定手当＋夜勤手当×回数）
function postingMonthly(p, which = 'min') {
  const base = which === 'max' ? (p.wage_max ?? p.wage_min) : (p.wage_min ?? p.wage_max);
  const m = toMonthlyFor(base, p.wage_type || 'monthly', p);
  if (m == null) return null;
  return m + (p.allowances_monthly || 0) + (p.night_allowance || 0) * (p.nights_per_month || 0);
}

// 年収見込み（月額×12＋賞与（基本給×月数）＋その他年額）
function postingAnnual(p, which = 'min') {
  const monthly = postingMonthly(p, which);
  if (monthly == null) return null;
  const base = which === 'max' ? (p.wage_max ?? p.wage_min) : (p.wage_min ?? p.wage_max);
  const baseMonthly = toMonthlyFor(base, p.wage_type || 'monthly', p);
  const bonus = (p.wage_type || 'monthly') === 'monthly' ? (p.bonus_months || 0) * baseMonthly : 0;
  return Math.round(monthly * 12 + bonus + (p.other_annual || 0));
}

module.exports = { toMonthlyFor, postingMonthly, postingAnnual, workHoursPerDay };
