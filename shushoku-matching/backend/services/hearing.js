'use strict';

// 初回面接ヒアリングシートの回答から、判定に使う項目を補完する
//   勤務時間帯（日勤のみ／夜勤可／オンコール可）→ 夜勤可否・オンコール
//   重視する順位 → 重み付け（給与→賃金重視、勤務地→近さ重視、休日→休日重視）
//   休日の希望「週休2日以上」→ 週の勤務日数上限5日
//   希望給与のみ記入 → 最低ラインにも使う
//   退職予定日 → 就業可能日（翌日）
//   運転免許 → 保有資格に追記
// 明示的に入力された値は上書きしない

const { addDays } = require('../utils/dates');
const { splitList } = require('../utils/values');

function applyHearing(o, current = {}) {
  const v = k => (o[k] !== undefined ? o[k] : current[k]);
  const out = { ...o };
  const pattern = splitList(v('shift_pattern'));
  if (o.shift_pattern !== undefined && pattern.length) {
    if (pattern.includes('日勤のみ')) {
      if (o.shift_ok === undefined) out.shift_ok = 0;
      if (o.night_max_per_month === undefined && v('night_max_per_month') == null) out.night_max_per_month = 0;
    } else if (pattern.includes('夜勤可') && o.shift_ok === undefined) out.shift_ok = 1;
    if (o.oncall_ok === undefined) out.oncall_ok = pattern.includes('オンコール可') ? 1 : 0;
  }
  if (o.priorities !== undefined && o.weight_profile === undefined) {
    const first = splitList(v('priorities'))[0] || '';
    const map = { 給与: 'wage', 賃金: 'wage', 勤務地: 'proximity', 通勤: 'proximity', 休日: 'holiday' };
    const hit = Object.keys(map).find(k => first.includes(k));
    if (hit) out.weight_profile = map[hit];
  }
  if (o.holiday_pref !== undefined && /週休2日/.test(v('holiday_pref') || '') && o.max_days_per_week === undefined && v('max_days_per_week') == null) {
    out.max_days_per_week = 5;
  }
  if (o.desired_wage_target != null && o.desired_wage_min === undefined && v('desired_wage_min') == null) {
    out.desired_wage_min = o.desired_wage_target;
  }
  if (o.resignation_date && o.available_from === undefined && !v('available_from')) {
    out.available_from = addDays(o.resignation_date, 1);
  }
  if (o.driver_license && o.driver_license !== 'なし') {
    const lic = splitList(v('licenses'));
    const name = o.driver_license.includes('AT限定）') ? '普通自動車免許（AT限定）' : '普通自動車免許';
    if (!lic.some(l => l.includes('普通自動車'))) out.licenses = [...lic, name].join(',');
  }
  return out;
}

module.exports = { applyHearing };
