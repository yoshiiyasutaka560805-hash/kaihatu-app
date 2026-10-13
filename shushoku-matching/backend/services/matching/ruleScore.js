'use strict';

// ルールベースのマッチング判定
// 1) 必須条件で足切り（excluded=true, reasons に理由）
// 2) 加点方式で100点満点（items に内訳）
// 3) 注意事項（warnings）は除外せず担当者の確認を促す

const list = v => (v ? String(v).split(/[,、，\n]/).map(x => x.trim()).filter(Boolean) : []);
const norm = s => String(s).replace(/[\s（）()・]/g, '');
const includesLoose = (a, b) => norm(a).includes(norm(b)) || norm(b).includes(norm(a));

// 賃金を月額換算（時給×160h、日給×20日。概算であり比較用）
function toMonthly(amount, type) {
  if (amount == null) return null;
  if (type === 'hourly') return amount * 160;
  if (type === 'daily') return amount * 20;
  return amount;
}

const toMin = t => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

function ageOn(birthDate, today = new Date()) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  let age = today.getFullYear() - b.getFullYear();
  const md = (today.getMonth() - b.getMonth()) * 100 + (today.getDate() - b.getDate());
  if (md < 0) age--;
  return age;
}

// 上位資格で下位資格の要件を満たす（介護分野の代表的な序列）
const LICENSE_COVERS = {
  '介護福祉士': ['実務者研修', '初任者研修', 'ホームヘルパー2級'],
  '実務者研修': ['初任者研修', 'ホームヘルパー2級'],
  'ホームヘルパー1級': ['初任者研修', 'ホームヘルパー2級'],
  '介護職員基礎研修': ['初任者研修', 'ホームヘルパー2級'],
};

// 保有資格名が要件名を含む場合に一致（例: 「初任者研修修了」は「初任者研修」を満たす）
function hasLicense(held, required) {
  const r = norm(required);
  return held.some(h => {
    const nh = norm(h);
    if (nh.includes(r)) return true;
    return Object.entries(LICENSE_COVERS).some(([upper, lowers]) =>
      nh.includes(upper) && lowers.some(l => r.includes(l)));
  });
}

function scoreMatch(seeker, posting, today = new Date()) {
  const reasons = [];
  const warnings = [];
  const items = [];
  const todayStr = today.toISOString().slice(0, 10);

  // ── 足切り ──────────────────────────────
  if (!posting.is_active) reasons.push('求人が無効');
  if (posting.expiry_date && posting.expiry_date < todayStr) reasons.push('紹介期限切れ');

  const okCities = [seeker.city, ...list(seeker.acceptable_cities)].filter(Boolean);
  if (okCities.length) {
    if (!posting.city || !okCities.some(c => includesLoose(c, posting.city))) {
      reasons.push(`勤務地（${posting.city || '不明'}）が通勤可能範囲外`);
    }
  } else if (seeker.prefecture && posting.prefecture && seeker.prefecture !== posting.prefecture) {
    reasons.push(`勤務地の都道府県（${posting.prefecture}）が希望と異なる`);
  }

  const held = list(seeker.licenses);
  const missing = list(posting.required_licenses).filter(r => !hasLicense(held, r));
  if (missing.length) reasons.push(`必須資格不足（${missing.join('、')}）`);

  const desiredMonthly = toMonthly(seeker.desired_wage_min, seeker.desired_wage_type);
  const postingTop = toMonthly(posting.wage_max ?? posting.wage_min, posting.wage_type);
  if (desiredMonthly && postingTop != null && postingTop < desiredMonthly) {
    reasons.push('賃金上限が希望額未満');
  }

  if (posting.shift_work && !seeker.shift_ok) reasons.push('交替制・夜勤が不可');
  const ps = toMin(posting.work_start), pe = toMin(posting.work_end);
  const as = toMin(seeker.available_start), ae = toMin(seeker.available_end);
  if (!posting.shift_work && ps != null && pe != null && as != null && ae != null && pe > ps) {
    if (ps < as || pe > ae) reasons.push(`就業時間（${posting.work_start}〜${posting.work_end}）が勤務可能時間外`);
  }

  if (seeker.max_days_per_week && posting.days_per_week && posting.days_per_week > seeker.max_days_per_week) {
    reasons.push(`週${posting.days_per_week}日勤務が上限（週${seeker.max_days_per_week}日）超過`);
  }

  // 年齢：法令上の例外事由が記載された求人のみ判定に使う
  const age = ageOn(seeker.birth_date, today);
  if (age != null && (posting.age_min || posting.age_max)) {
    if (posting.age_exception_reason) {
      if ((posting.age_min && age < posting.age_min) || (posting.age_max && age > posting.age_max)) {
        reasons.push(`年齢制限（${posting.age_exception_reason}）に該当しない`);
      }
    } else {
      warnings.push('年齢条件の記載があるが例外事由が不明。判定には使用していない（求人者へ確認）');
    }
  }

  if (seeker.is_foreign_national) {
    if (posting.foreigner_ok === 0) warnings.push('外国人雇用「不可」の記載あり。在留資格要件を求人者に確認');
    else if (posting.foreigner_ok == null) warnings.push('外国人雇用の可否が不明。在留資格での就労可否を確認');
  }

  // ── 加点 ────────────────────────────────
  const add = (label, points, max, note) => items.push({ label, points, max, note });

  const cats = list(seeker.desired_categories);
  const jobText = `${posting.job_category || ''} ${posting.job_title || ''}`;
  if (!cats.length) add('職種', 15, 30, '希望職種未設定');
  else if (cats.some(c => norm(jobText).includes(norm(c)))) add('職種', 30, 30, '希望職種に一致');
  else add('職種', 0, 30, '希望職種と不一致');

  if (!desiredMonthly || postingTop == null) add('賃金', 12, 25, '比較情報不足');
  else {
    const ratio = postingTop / desiredMonthly;
    const postingBottom = toMonthly(posting.wage_min ?? posting.wage_max, posting.wage_type);
    if (postingBottom >= desiredMonthly * 1.2) add('賃金', 25, 25, '下限でも希望を2割以上上回る');
    else if (postingBottom >= desiredMonthly) add('賃金', 20, 25, '下限で希望額以上');
    else add('賃金', ratio >= 1.1 ? 14 : 10, 25, '上限側で希望額を満たす（経験等で変動）');
    if (posting.wage_type !== (seeker.desired_wage_type || 'monthly')) {
      warnings.push('賃金形態が異なるため月額換算（時給×160h・日給×20日）で比較');
    }
  }

  if (seeker.city && posting.city && includesLoose(seeker.city, posting.city)) add('勤務地', 15, 15, '居住市区町村内');
  else if (okCities.length && posting.city && okCities.some(c => includesLoose(c, posting.city))) add('勤務地', 10, 15, '通勤可能範囲内');
  else if (seeker.prefecture && posting.prefecture === seeker.prefecture) add('勤務地', 6, 15, '同一都道府県');
  else add('勤務地', 0, 15, '');

  const emp = list(seeker.desired_employment);
  if (!emp.length) add('雇用形態', 5, 10, '希望未設定');
  else if (posting.employment_type && emp.some(e => includesLoose(e, posting.employment_type))) add('雇用形態', 10, 10, '希望に一致');
  else add('雇用形態', 0, 10, '希望と不一致');

  if (seeker.min_annual_holidays && posting.annual_holidays != null) {
    add('休日', posting.annual_holidays >= seeker.min_annual_holidays ? 10 : 0, 10,
      `年間休日${posting.annual_holidays}日`);
  } else add('休日', posting.annual_holidays != null ? 5 : 3, 10, '比較情報不足');

  let exp = 0;
  const expNotes = [];
  if ((seeker.experience_years || 0) >= (posting.experience_required || 0)) exp += 5;
  else expNotes.push(`経験${posting.experience_required}年以上が必要`);
  const preferred = list(posting.preferred_licenses);
  if (!preferred.length) exp += 3;
  else if (preferred.some(p => hasLicense(held, p))) { exp += 5; expNotes.push('歓迎資格あり'); }
  add('経験・資格', exp, 10, expNotes.join('、'));

  const score = items.reduce((s, i) => s + i.points, 0);
  return { excluded: reasons.length > 0, reasons, score, items, warnings };
}

module.exports = { scoreMatch, toMonthly, ageOn };
