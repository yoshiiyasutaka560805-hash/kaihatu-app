'use strict';

// ルールベースのマッチング判定 v2
// 1) 必須条件で足切り（reasons：理由コード・文言・「何が変われば対象になるか」）
// 2) 加点（重みプロファイルで配点を切替、100点満点）
// 3) 注意事項（warnings）は除外せず担当者の確認を促す
// 4) completeness：求人情報の充足率（情報不足の求人が高く見えないよう別指標で表示）

const { splitList } = require('../../utils/values');
const { parseArea, areaMatch } = require('../../utils/area');
const { ageOn, todayJst, diffDays } = require('../../utils/dates');
const { toMonthlyFor, postingMonthly, postingAnnual } = require('../../utils/wage');

const WEIGHTS = {
  balanced:  { 職種: 30, 賃金: 25, 勤務地: 15, 雇用形態: 10, 休日: 10, 経験資格: 10 },
  wage:      { 職種: 20, 賃金: 40, 勤務地: 10, 雇用形態: 10, 休日: 10, 経験資格: 10 },
  proximity: { 職種: 20, 賃金: 20, 勤務地: 30, 雇用形態: 10, 休日: 10, 経験資格: 10 },
  holiday:   { 職種: 20, 賃金: 20, 勤務地: 15, 雇用形態: 10, 休日: 25, 経験資格: 10 },
};

const norm = s => String(s).replace(/[\s（）()・　]/g, '');

// 上位資格で下位資格の要件を満たす（介護分野の代表的な序列）
const LICENSE_COVERS = {
  介護福祉士: ['実務者研修', '初任者研修', 'ホームヘルパー2級', 'ホームヘルパー1級', '介護職員基礎研修'],
  実務者研修: ['初任者研修', 'ホームヘルパー2級'],
  ホームヘルパー1級: ['初任者研修', 'ホームヘルパー2級'],
  介護職員基礎研修: ['初任者研修', 'ホームヘルパー2級'],
  正看護師: ['准看護師'],
};

function hasLicense(held, required) {
  const r = norm(required);
  return held.some(h => {
    const nh = norm(h);
    if (nh.includes(r)) return true;
    if (r === '看護師' && nh.includes('看護師') && !nh.includes('准')) return true;
    return Object.entries(LICENSE_COVERS).some(([upper, lowers]) => nh.includes(upper) && lowers.some(l => r.includes(l)));
  });
}

const COMPLETENESS_FIELDS = ['city', 'job_title', 'employment_type', 'wage_min', 'annual_holidays', 'days_per_week',
  'work_start', 'description', 'facility_type', 'expiry_date', 'employment_term', 'required_licenses'];

function completeness(p) {
  const filled = COMPLETENESS_FIELDS.filter(f => p[f] != null && p[f] !== '').length
    + (p.shift_work != null ? 0 : 0);
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
}

const isTokutei = s => /特定技能/.test(s.visa_status || '');
const isLimitedWorkVisa = s => /留学|家族滞在/.test(s.visa_status || '');

function seekerAreas(seeker) {
  const list = [seeker.city, ...splitList(seeker.acceptable_cities)].filter(Boolean);
  return list.map(t => parseArea(t, seeker.prefecture)).filter(Boolean);
}

function scoreMatch(seeker, posting, ctx = {}) {
  const today = ctx.today || todayJst();
  const settings = ctx.settings || {};
  const tolerance = Number(settings.wage_tolerance_percent ?? 5) / 100;
  const reasons = [];   // { code, text, hint }
  const warnings = [];
  const items = [];
  const exclude = (code, text, hint) => reasons.push({ code, text, hint });

  // ── 足切り ──────────────────────────────
  if (!posting.is_active) exclude('inactive', '求人が無効（募集終了）', null);
  if (posting.expiry_date && posting.expiry_date < today) exclude('expired', '紹介期限切れ', null);

  const pArea = parseArea(`${posting.prefecture || ''}${posting.city || ''}`) || null;
  const areas = seekerAreas(seeker);
  let areaLevel = null;
  const commute = ctx.commuteMinutes;
  if (commute != null && seeker.max_commute_minutes) {
    if (commute > seeker.max_commute_minutes) {
      exclude('commute', `通勤${commute}分（上限${seeker.max_commute_minutes}分）`, `通勤上限を${commute}分以上にすれば対象`);
    }
  } else if (areas.length) {
    areaLevel = areas.map(a => areaMatch(a, pArea)).find(Boolean) || null;
    if (!areaLevel) {
      exclude('area', `勤務地（${posting.prefecture || ''}${posting.city || '不明'}）が通勤可能範囲外`,
        `通勤可能地域に「${posting.prefecture || ''}${posting.city || ''}」を追加すれば対象`);
    } else if (areaLevel === 'city') warnings.push('求人の勤務地が区まで特定できないため、市単位で一致とした');
  } else if (seeker.prefecture && posting.prefecture && seeker.prefecture !== posting.prefecture) {
    exclude('pref', `勤務地の都道府県（${posting.prefecture}）が希望と異なる`, null);
  }

  // 施設種別
  const excludedFac = splitList(seeker.excluded_facility_types);
  if (posting.facility_type && excludedFac.includes(posting.facility_type)) {
    exclude('facility', `施設種別（${posting.facility_type}）は希望しない`, `「${posting.facility_type}」を不可から外せば対象`);
  }

  const held = splitList(seeker.licenses);
  const missing = splitList(posting.required_licenses).filter(r => !hasLicense(held, r));
  if (missing.length) exclude('license', `必須資格不足（${missing.join('、')}）`, `${missing.join('・')}を取得すれば対象`);

  // 賃金（月額換算・固定手当・夜勤手当込み）
  const desiredMonthly = toMonthlyFor(seeker.desired_wage_min, seeker.desired_wage_type || 'monthly', posting);
  const top = postingMonthly(posting, 'max');
  const bottom = postingMonthly(posting, 'min');
  if (desiredMonthly && top != null && top < desiredMonthly) {
    const shortRate = (desiredMonthly - top) / desiredMonthly;
    if (shortRate <= tolerance) {
      warnings.push(`賃金見込み（月${top.toLocaleString()}円）が希望を${Math.ceil(shortRate * 100)}%下回る（許容範囲内）`);
    } else {
      exclude('wage', `賃金見込み（月${top.toLocaleString()}円）が希望額未満`, `希望額を月${top.toLocaleString()}円以下にすれば対象`);
    }
  }
  if ((posting.wage_type || 'monthly') !== (seeker.desired_wage_type || 'monthly') && desiredMonthly) {
    warnings.push('賃金形態が異なるため、求人の所定労働時間・日数で月額換算して比較');
  }

  // 夜勤
  const nightPosting = posting.shift_work || (posting.nights_per_month || 0) > 0;
  if (nightPosting) {
    const max = seeker.night_max_per_month;
    if (!seeker.shift_ok && !(max > 0) && !seeker.night_only) {
      exclude('night', '交替制・夜勤が不可', '夜勤・交替制を可にすれば対象');
    } else if (max != null && posting.nights_per_month != null && posting.nights_per_month > max) {
      exclude('night_count', `夜勤月${posting.nights_per_month}回（上限${max}回）`, `夜勤上限を月${posting.nights_per_month}回にすれば対象`);
    } else if (max != null && posting.nights_per_month == null) {
      warnings.push('夜勤回数が不明。求人者に確認');
    }
  }
  const ps = posting.work_start, pe = posting.work_end, as = seeker.available_start, ae = seeker.available_end;
  if (!posting.shift_work && ps && pe && as && ae && pe > ps && (ps < as || pe > ae)) {
    exclude('time', `就業時間（${ps}〜${pe}）が勤務可能時間外`, `勤務可能時間を${ps}〜${pe}に広げれば対象`);
  }
  if (seeker.max_days_per_week && posting.days_per_week && posting.days_per_week > seeker.max_days_per_week) {
    exclude('days', `週${posting.days_per_week}日勤務（上限週${seeker.max_days_per_week}日）`, null);
  }

  // 年齢：法令上の例外事由が記載された求人のみ判定に使う
  const age = ageOn(seeker.birth_date, today);
  if (age != null && (posting.age_min || posting.age_max)) {
    if (posting.age_exception_reason) {
      if ((posting.age_min && age < posting.age_min) || (posting.age_max && age > posting.age_max)) {
        exclude('age', `年齢制限（${posting.age_exception_reason}）に該当しない`, null);
      }
    } else warnings.push('年齢条件の記載があるが例外事由が不明。判定には使用していない（求人者へ確認）');
  }

  // 外国籍・在留資格
  if (seeker.is_foreign_national) {
    if (!seeker.residence_checked_date) warnings.push('在留カード原本の確認記録がない（不法就労助長防止のため紹介前に確認）');
    if (seeker.residence_expiry) {
      const left = diffDays(today, seeker.residence_expiry);
      if (left < 0) exclude('residence_expired', '在留期限切れ', null);
      else if (left <= 90) warnings.push(`在留期限まで${left}日。更新手続の状況を確認`);
    }
    if (posting.foreigner_ok === 0) warnings.push('外国人雇用「不可」の記載あり。在留資格要件を求人者に確認');
    else if (posting.foreigner_ok == null) warnings.push('外国人雇用の可否が不明。在留資格での就労可否を確認');
    if (isTokutei(seeker)) {
      if (posting.tokutei_ok === 0) exclude('tokutei', '求人者が特定技能の受入れ不可', null);
      else if (posting.tokutei_ok == null) warnings.push('特定技能の受入れ体制（支援計画・協議会加入等）を求人者に確認');
      if (posting.visiting_care && settings.tokutei_visiting_allowed !== '1') {
        exclude('tokutei_visiting', '訪問系業務を含む（特定技能での従事可否を要確認）', '設定で特定技能の訪問系を可にした場合は対象');
      }
    }
    if (isLimitedWorkVisa(seeker)) {
      const weekly = (posting.days_per_week || 5) * (posting.daily_hours || 8);
      if (!seeker.extra_activity_permit) exclude('visa_permit', '資格外活動許可なし', '資格外活動許可を得れば対象（週28時間以内）');
      else if (weekly > 28) warnings.push(`資格外活動は週28時間以内（求人の所定は週約${weekly}時間）。勤務日数・時間を調整`);
    }
    if (posting.japanese_level && seeker.jlpt_level && seeker.jlpt_level !== 'なし') {
      const need = Number(posting.japanese_level.match(/N(\d)/)?.[1]);
      const have = Number(seeker.jlpt_level.slice(1));
      if (need && have && have > need) warnings.push(`求人は日本語${posting.japanese_level}以上、本人は${seeker.jlpt_level}`);
    }
  }

  // ── 加点 ────────────────────────────────
  const W = WEIGHTS[seeker.weight_profile] || WEIGHTS.balanced;
  const add = (label, ratio, note) => items.push({ label, points: Math.round(W[label] * ratio), max: W[label], note });

  const cats = splitList(seeker.desired_categories);
  const kinds = splitList(seeker.desired_job_kinds);
  const facs = splitList(seeker.desired_facility_types);
  const jobText = norm(`${posting.job_category || ''}${posting.job_title || ''}${posting.job_kind || ''}`);
  const catHit = cats.some(c => jobText.includes(norm(c))) || (posting.job_kind && kinds.includes(posting.job_kind));
  const facHit = posting.facility_type && facs.includes(posting.facility_type);
  if (!cats.length && !kinds.length) add('職種', facHit ? 0.7 : 0.5, '希望職種未設定');
  else if (catHit && (facHit || !facs.length)) add('職種', 1, facHit ? '職種・施設種別とも一致' : '希望職種に一致');
  else if (catHit) add('職種', 0.8, '職種一致（施設種別は希望外）');
  else add('職種', facHit ? 0.3 : 0, '希望職種と不一致');

  if (!desiredMonthly || bottom == null) add('賃金', 0.4, '比較情報不足');
  else if (bottom >= desiredMonthly * 1.2) add('賃金', 1, '下限でも希望を2割以上上回る');
  else if (bottom >= desiredMonthly) add('賃金', 0.8, '下限で希望額以上');
  else if (top >= desiredMonthly) add('賃金', top / desiredMonthly >= 1.1 ? 0.55 : 0.4, '上限側で希望額を満たす（経験等で変動）');
  else add('賃金', 0.2, '許容範囲内の不足');

  if (commute != null) {
    const lim = seeker.max_commute_minutes || 60;
    add('勤務地', Math.max(0, Math.min(1, 1 - commute / (lim * 1.5))), `通勤約${commute}分`);
  } else {
    const home = seeker.city ? parseArea(seeker.city, seeker.prefecture) : null;
    if (home && areaMatch(home, pArea) === 'exact') add('勤務地', 1, '居住市区町村内');
    else if (areaLevel) add('勤務地', 0.67, '通勤可能範囲内');
    else if (seeker.prefecture && posting.prefecture === seeker.prefecture) add('勤務地', 0.4, '同一都道府県');
    else add('勤務地', 0, '');
  }

  const emp = splitList(seeker.desired_employment);
  if (!emp.length) add('雇用形態', 0.5, '希望未設定');
  else if (posting.employment_type && emp.some(e => norm(posting.employment_type).includes(norm(e)))) add('雇用形態', 1, '希望に一致');
  else add('雇用形態', 0, '希望と不一致');

  if (seeker.min_annual_holidays && posting.annual_holidays != null) {
    const diff = posting.annual_holidays - seeker.min_annual_holidays;
    add('休日', diff >= 0 ? 1 : Math.max(0, 1 + diff / 20), `年間休日${posting.annual_holidays}日`);
  } else add('休日', posting.annual_holidays != null ? 0.5 : 0.3, '比較情報不足');

  let exp = 0;
  const expNotes = [];
  if ((seeker.experience_years || 0) >= (posting.experience_required || 0)) exp += 0.5;
  else expNotes.push(`経験${posting.experience_required}年以上が必要`);
  const preferred = splitList(posting.preferred_licenses);
  if (!preferred.length) exp += 0.3;
  else if (preferred.some(p => hasLicense(held, p))) { exp += 0.5; expNotes.push('歓迎資格あり'); }
  if (seeker.night_only && (posting.nights_per_month || 0) >= 8) { exp = Math.min(1, exp + 0.2); expNotes.push('夜勤専従希望に合致'); }
  add('経験資格', exp, expNotes.join('、'));

  const score = Math.min(100, items.reduce((s, i) => s + i.points, 0));
  const annual = postingAnnual(posting, 'min');
  return {
    excluded: reasons.length > 0,
    reasons: reasons.map(r => r.text),
    reasonDetails: reasons,
    score, items, warnings,
    completeness: completeness(posting),
    estimates: { monthlyMin: bottom, monthlyMax: top, annualMin: annual, desiredMonthly },
  };
}

module.exports = { scoreMatch, WEIGHTS, hasLicense, completeness };
