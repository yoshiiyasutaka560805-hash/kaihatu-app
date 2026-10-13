'use strict';

// 紹介手数料・返戻金の計算
// 手数料は届出した手数料表に基づくこと（上限制：賃金の一定割合が上限／届出制：届け出た率）
// ※率・算定基礎（6か月分の賃金等）は自社の届出内容を設定画面で入力する。既定値は置かない

const { getSettings } = require('../database/db');
const { diffDays } = require('../utils/dates');

function parsePolicy(json) {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) ? v.filter(t => Number.isFinite(t.withinDays) && Number.isFinite(t.rate)).sort((a, b) => a.withinDays - b.withinDays) : [];
  } catch { return []; }
}

// placement: { monthly_wage, fee_basis_months, fee_rate_percent }, employer: { fee_rate_percent }
function calcFee({ monthlyWage, basisMonths, ratePercent }, settings = getSettings()) {
  const warnings = [];
  const rate = ratePercent ?? (settings.fee_rate_percent === '' ? null : Number(settings.fee_rate_percent));
  const months = basisMonths ?? Number(settings.fee_basis_months || 6);
  if (rate == null || !Number.isFinite(rate)) return { amount: null, warnings: ['手数料率が未設定です（設定画面または事業所で入力）'] };
  if (!monthlyWage) return { amount: null, warnings: ['算定基礎となる賃金（月額）を入力してください'] };
  const cap = settings.fee_cap_percent === '' ? null : Number(settings.fee_cap_percent);
  if (cap != null && rate > cap) warnings.push(`手数料率${rate}%が上限${cap}%を超えています（届出内容を確認）`);
  const amount = Math.floor(monthlyWage * months * rate / 100);
  return { amount, rate, months, basisNote: `月額${monthlyWage.toLocaleString()}円×${months}か月×${rate}%`, warnings };
}

// 離職日・入職日・規定から返戻率を判定
function calcRefund({ hireDate, separationDate, feeAmount, separationType, policyJson }, settings = getSettings()) {
  if (!separationDate || !feeAmount) return { rate: 0, amount: 0, note: '' };
  if (separationType === '解雇' || separationType === '会社都合') {
    // 求人者都合の離職を返戻対象とするかは契約による
  }
  const tiers = parsePolicy(policyJson || settings.refund_policy);
  if (!tiers.length) return { rate: null, amount: null, note: '返戻金規定が未設定です' };
  const days = diffDays(hireDate, separationDate);
  const tier = tiers.find(t => days <= t.withinDays);
  if (!tier) return { rate: 0, amount: 0, note: `入職後${days}日のため返戻対象外` };
  return { rate: tier.rate, amount: Math.floor(feeAmount * tier.rate / 100), note: `入職後${days}日（${tier.withinDays}日以内：${tier.rate}%）` };
}

module.exports = { calcFee, calcRefund, parsePolicy };
