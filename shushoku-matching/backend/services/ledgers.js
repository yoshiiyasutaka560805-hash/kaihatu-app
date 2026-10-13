'use strict';

// 法定帳簿（職業安定法32条の15・施行規則24条の7：求人管理簿・求職管理簿・手数料管理簿）のCSV出力
// ※記載事項・様式は業務運営要領で要確認。本出力は記載事項を網羅するための元データとして使用し、
//   必要に応じて所定様式へ転記すること

const { getDb } = require('../database/db');
const { addMonths } = require('../utils/dates');

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header, rows) {
  return '﻿' + [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

const WAGE_LABEL = { monthly: '月給', hourly: '時給', daily: '日給', annual: '年俸' };
const wageText = p => (p.wage_min || p.wage_max) ? `${WAGE_LABEL[p.wage_type] || ''}${p.wage_min ?? ''}〜${p.wage_max ?? ''}円` : '';

function inRange(col, from, to) {
  const where = [];
  const params = [];
  if (from) { where.push(`${col} >= ?`); params.push(from); }
  if (to) { where.push(`${col} <= ?`); params.push(to); }
  return { sql: where.length ? ' AND ' + where.join(' AND ') : '', params };
}

// 求人管理簿：自社受理求人ごとに紹介状況を列挙
function jobLedger({ from, to } = {}) {
  const db = getDb();
  const r = inRange('p.received_date', from, to);
  const postings = db.prepare(`SELECT p.*, e.name AS employer_name, e.address AS employer_address, e.phone AS employer_phone
    FROM job_postings p LEFT JOIN employers e ON e.id = p.employer_id
    WHERE p.origin = 'own'${r.sql} ORDER BY p.received_date, p.posting_no`).all(...r.params);
  const rows = [];
  for (const p of postings) {
    const intros = db.prepare(`SELECT m.*, s.name FROM matches m JOIN job_seekers s ON s.id = m.seeker_id
      WHERE m.posting_id = ? AND m.intro_status <> '未提案' ORDER BY m.proposed_date`).all(p.id);
    const fee = db.prepare('SELECT fee_amount FROM placements WHERE posting_id = ?').all(p.id).map(x => x.fee_amount).filter(Boolean);
    const base = [p.posting_no, p.received_date, p.expiry_date, p.employer_name || p.company_name, p.employer_address || p.address,
      p.employer_phone || '', p.job_title, p.address || `${p.prefecture || ''}${p.city || ''}`, p.employment_type,
      p.employment_term, wageText(p), p.openings ?? '', p.hw_posting_no || ''];
    if (!intros.length) rows.push([...base, '', '', '', '', fee.join('／')]);
    for (const m of intros) {
      rows.push([...base, m.name, m.proposed_date || m.applied_date || '', m.intro_status, m.offer_date || '', fee.join('／')]);
    }
  }
  return toCsv(['求人番号', '求人受付年月日', '求人の有効期間', '求人者の氏名又は名称', '求人者の所在地', '求人者の連絡先',
    '求人に係る職種', '就業の場所', '雇用形態', '雇用期間の定め', '賃金', '求人数', '元HW求人番号',
    '紹介した求職者の氏名', '紹介年月日', '紹介の結果', '採用年月日', '手数料'], rows);
}

// 求職管理簿
function seekerLedger({ from, to } = {}) {
  const db = getDb();
  const r = inRange('s.accepted_date', from, to);
  const seekers = db.prepare(`SELECT s.* FROM job_seekers s WHERE 1=1${r.sql} ORDER BY s.accepted_date, s.id`).all(...r.params);
  const rows = [];
  for (const s of seekers) {
    const intros = db.prepare(`SELECT m.*, p.company_name, pl.hire_date, pl.employment_term, pl.separation_date, pl.separation_type, pl.separation_unknown
      FROM matches m JOIN job_postings p ON p.id = m.posting_id LEFT JOIN placements pl ON pl.match_id = m.id
      WHERE m.seeker_id = ? AND m.intro_status <> '未提案' ORDER BY m.proposed_date`).all(s.id);
    const base = [s.id, s.accepted_date, s.validity_end, s.name, s.birth_date, s.address, s.phone,
      [s.desired_categories, s.desired_job_kinds].filter(Boolean).join('、'), [s.city, s.acceptable_cities].filter(Boolean).join('、'),
      s.desired_wage_min ? `${WAGE_LABEL[s.desired_wage_type] || ''}${s.desired_wage_min}円以上` : '', s.licenses];
    const sixMonth = x => {
      if (!x.hire_date || x.employment_term !== '無期') return '';
      if (x.separation_date && x.separation_date <= addMonths(x.hire_date, 6)) return x.separation_type === '解雇' ? '離職（解雇）' : '離職';
      if (x.separation_unknown) return '不明';
      return '';
    };
    if (!intros.length) rows.push([...base, '', '', '', '', '', '']);
    for (const m of intros) {
      rows.push([...base, m.proposed_date || m.applied_date || '', m.company_name, m.intro_status, m.hire_date || '', m.employment_term || '', sixMonth(m)]);
    }
  }
  return toCsv(['求職者番号', '求職受付年月日', '求職の有効期間', '求職者の氏名', '生年月日', '住所', '連絡先',
    '希望職種', '希望就業地', '希望賃金', '資格', '紹介年月日', '紹介先', '紹介の結果', '就職年月日', '雇用期間の定め',
    '6か月以内の離職'], rows);
}

// 手数料管理簿
function feeLedger({ from, to } = {}) {
  const db = getDb();
  const r = inRange('pl.paid_date', from, to);
  const rows = db.prepare(`SELECT pl.*, p.company_name, s.name FROM placements pl
    JOIN job_postings p ON p.id = pl.posting_id JOIN job_seekers s ON s.id = pl.seeker_id
    WHERE pl.fee_amount IS NOT NULL${r.sql} ORDER BY COALESCE(pl.paid_date, pl.invoice_date)`).all(...r.params)
    .map(x => [x.paid_date || '（未収）', x.company_name, '紹介手数料', x.fee_amount, x.paid_amount ?? '', x.fee_basis_note || '',
      x.name, x.hire_date, x.invoice_no || '', x.refund_amount || '', x.refund_date || '']);
  return toCsv(['徴収年月日', '徴収した相手方（求人者）', '手数料の種類', '請求額', '徴収額', '手数料の算定根拠',
    '就職者の氏名', '就職年月日', '請求書番号', '返戻金額', '返戻年月日'], rows);
}

module.exports = { jobLedger, seekerLedger, feeLedger, toCsv };
