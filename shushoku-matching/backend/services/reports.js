'use strict';

// 職業紹介事業報告書（年度：4/1〜3/31、4月末提出）と人材サービス総合サイト掲載用の集計
// ※報告書の様式・定義（就職者数の数え方、6か月以内離職の扱い等）は管轄労働局の記載要領で要確認

const { getDb } = require('../database/db');
const { fiscalYearRange, addMonths, todayJst } = require('../utils/dates');

function businessReport(fy) {
  const db = getDb();
  const { from, to } = fiscalYearRange(fy);
  const prev = fiscalYearRange(fy - 1);
  const count = (sql, ...p) => db.prepare(sql).get(...p).c;

  const newPostings = count(`SELECT COUNT(*) c FROM job_postings WHERE origin = 'own' AND received_date BETWEEN ? AND ?`, from, to);
  const newOpenings = db.prepare(`SELECT COALESCE(SUM(COALESCE(openings,1)),0) c FROM job_postings WHERE origin = 'own' AND received_date BETWEEN ? AND ?`).get(from, to).c;
  const newSeekers = count('SELECT COUNT(*) c FROM job_seekers WHERE accepted_date BETWEEN ? AND ?', from, to);
  const referrals = count(`SELECT COUNT(*) c FROM match_events WHERE to_status = '提案済' AND substr(at,1,10) BETWEEN ? AND ?`, from, to);
  const placements = db.prepare('SELECT * FROM placements WHERE hire_date BETWEEN ? AND ?').all(from, to);
  const indefinite = placements.filter(p => p.employment_term === '無期');
  const fees = placements.reduce((s, p) => s + (p.paid_amount || 0), 0);
  const refunds = db.prepare('SELECT COALESCE(SUM(refund_amount),0) s FROM placements WHERE refund_date BETWEEN ? AND ?').get(from, to).s;

  // 前年度に無期雇用で就職した者の6か月以内離職（解雇を除く）
  const prevIndef = db.prepare(`SELECT * FROM placements WHERE employment_term = '無期' AND hire_date BETWEEN ? AND ?`).all(prev.from, prev.to);
  const within6 = p => p.separation_date && p.separation_date <= addMonths(p.hire_date, 6);
  const prevSeparated = prevIndef.filter(p => within6(p) && p.separation_type !== '解雇').length;
  const prevUnknown = prevIndef.filter(p => !within6(p) && p.separation_unknown).length;
  const prevPending = prevIndef.filter(p => !within6(p) && !p.separation_unknown && addMonths(p.hire_date, 6) > todayJst()).length;

  const foreign = placements.filter(p => db.prepare('SELECT is_foreign_national f FROM job_seekers WHERE id = ?').get(p.seeker_id)?.f).length;

  return {
    fiscalYear: fy, period: { from, to },
    求人: { 新規求人件数: newPostings, 新規求人数: newOpenings },
    求職: { 新規求職申込件数: newSeekers },
    紹介: { 紹介件数_提案: referrals },
    就職: { 就職件数: placements.length, うち無期雇用: indefinite.length, うち外国籍: foreign },
    前年度無期雇用就職者の6か月以内離職: { 対象者数: prevIndef.length, 離職者数_解雇除く: prevSeparated, 不明: prevUnknown, 未到来: prevPending },
    手数料: { 徴収額合計: fees, 返戻額合計: refunds },
    注意: '様式・定義は管轄労働局の記載要領で確認のうえ転記してください。未到来が残る場合は6か月経過後に確認が必要です。',
  };
}

// 人材サービス総合サイト等で公開する情報（就職者数・無期・6か月以内離職・手数料実績）
function disclosure(fy) {
  const r = businessReport(fy);
  const db = getDb();
  const { from, to } = fiscalYearRange(fy);
  const rows = db.prepare(`SELECT fee_amount, monthly_wage FROM placements WHERE hire_date BETWEEN ? AND ? AND fee_amount IS NOT NULL AND monthly_wage > 0`).all(from, to);
  // 平均手数料率：手数料額 ÷ 年収相当（月額×12）の平均。定義は要確認（労働局の記載要領）
  const avgRate = rows.length ? Math.round(rows.reduce((s, x) => s + x.fee_amount / (x.monthly_wage * 12), 0) / rows.length * 1000) / 10 : null;
  return {
    fiscalYear: fy,
    就職者数: r.就職.就職件数,
    無期雇用就職者数: r.就職.うち無期雇用,
    '無期雇用就職者のうち6か月以内離職者数（前年度就職分）': r.前年度無期雇用就職者の6か月以内離職.離職者数_解雇除く,
    '同・不明': r.前年度無期雇用就職者の6か月以内離職.不明,
    '平均手数料率（年収比・参考値）': avgRate == null ? null : `${avgRate}%`,
    注意: '公開項目・算定方法は最新の省令・指針で要確認',
  };
}

// 辞退・不採用理由と成約率の集計（マッチング改善用）
function pipelineStats(fy) {
  const db = getDb();
  const { from, to } = fiscalYearRange(fy);
  const reasons = db.prepare(`SELECT decline_reason reason, intro_status status, COUNT(*) c FROM matches
    WHERE decline_reason IS NOT NULL AND substr(judged_at,1,10) BETWEEN ? AND ? GROUP BY decline_reason, intro_status ORDER BY c DESC`).all(from, to);
  const funnel = {};
  for (const s of ['提案済', '応募', '面接', '内定', '入職']) {
    funnel[s] = db.prepare(`SELECT COUNT(DISTINCT match_id) c FROM match_events WHERE to_status = ? AND substr(at,1,10) BETWEEN ? AND ?`).get(s, from, to).c;
  }
  const revenue = db.prepare('SELECT COALESCE(SUM(fee_amount),0) billed, COALESCE(SUM(paid_amount),0) paid FROM placements WHERE hire_date BETWEEN ? AND ?').get(from, to);
  return { fiscalYear: fy, funnel, declineReasons: reasons, revenue };
}

module.exports = { businessReport, disclosure, pipelineStats };
