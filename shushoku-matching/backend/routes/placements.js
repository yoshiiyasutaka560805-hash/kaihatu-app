'use strict';

// 成約（入職）・請求・入金・離職・返戻金・定着フォロー
const express = require('express');
const router = express.Router();
const { getDb, getSettings, audit } = require('../database/db');
const specs = require('../models/specs');
const { validate, columnsOf } = require('../utils/validate');
const { addDays, addMonths, todayJst } = require('../utils/dates');
const { calcFee, calcRefund } = require('../services/fees');
const { closeSeeker } = require('../services/retention');
const { currentOperator } = require('../middleware/context');
const { postingMonthly } = require('../utils/wage');

const FOLLOWUPS = [['1週', d => addDays(d, 7)], ['1か月', d => addMonths(d, 1)], ['3か月', d => addMonths(d, 3)], ['6か月', d => addMonths(d, 6)]];

function load(id) {
  const p = getDb().prepare(`SELECT pl.*, s.name AS seeker_name, jp.company_name, jp.job_title, jp.posting_no,
      e.name AS employer_name, e.fee_rate_percent AS employer_fee_rate, e.refund_policy AS employer_refund_policy
    FROM placements pl JOIN job_seekers s ON s.id = pl.seeker_id JOIN job_postings jp ON jp.id = pl.posting_id
    LEFT JOIN employers e ON e.id = pl.employer_id WHERE pl.id = ?`).get(id);
  if (!p) throw Object.assign(new Error('成約が見つかりません'), { status: 404 });
  return p;
}

router.get('/', (req, res) => {
  res.json(getDb().prepare(`SELECT pl.*, s.name AS seeker_name, jp.company_name, jp.job_title FROM placements pl
    JOIN job_seekers s ON s.id = pl.seeker_id JOIN job_postings jp ON jp.id = pl.posting_id ORDER BY pl.hire_date DESC`).all());
});

router.get('/:id', (req, res) => {
  const p = load(req.params.id);
  const followups = getDb().prepare('SELECT * FROM followups WHERE placement_id = ? ORDER BY due_date').all(p.id);
  res.json({ ...p, followups });
});

// 成約登録：内定した候補を入職として登録（自社受理求人のみ）
router.post('/', (req, res) => {
  const db = getDb();
  const m = db.prepare(`SELECT m.*, p.origin, p.employer_id, p.employment_term AS posting_term, p.* , m.id AS mid
    FROM matches m JOIN job_postings p ON p.id = m.posting_id WHERE m.id = ?`).get(req.body.match_id);
  if (!m) return res.status(404).json({ error: '候補が見つかりません' });
  if (m.origin !== 'own') return res.status(400).json({ error: 'ハローワーク求人のままでは成約登録できません。求人者から求人申込みを受理し「自社求人化」してから紹介してください' });
  if (db.prepare('SELECT 1 FROM placements WHERE match_id = ?').get(m.mid)) return res.status(409).json({ error: '登録済みです' });
  const o = validate(req.body, specs.placement, { required: ['hire_date', 'employment_term'] });
  if (o.monthly_wage == null) o.monthly_wage = postingMonthly(m, 'min');
  const employer = m.employer_id ? db.prepare('SELECT * FROM employers WHERE id = ?').get(m.employer_id) : null;
  const fee = calcFee({ monthlyWage: o.monthly_wage, basisMonths: o.fee_basis_months, ratePercent: o.fee_rate_percent ?? employer?.fee_rate_percent ?? null });
  if (o.fee_amount == null && fee.amount != null) Object.assign(o, { fee_amount: fee.amount, fee_rate_percent: fee.rate, fee_basis_months: fee.months, fee_basis_note: fee.basisNote });
  let id;
  db.transaction(() => {
    const row = { ...o, match_id: m.mid, seeker_id: m.seeker_id, posting_id: m.posting_id, employer_id: m.employer_id };
    const cols = [...columnsOf(o, specs.placement), 'match_id', 'seeker_id', 'posting_id', 'employer_id'];
    id = db.prepare(`INSERT INTO placements (${cols.join(',')}) VALUES (${cols.map(c => '@' + c).join(',')})`).run(row).lastInsertRowid;
    for (const [kind, f] of FOLLOWUPS) db.prepare('INSERT INTO followups (placement_id, kind, due_date) VALUES (?,?,?)').run(id, kind, f(o.hire_date));
    db.prepare("UPDATE matches SET intro_status = '入職', is_new = 0 WHERE id = ?").run(m.mid);
    db.prepare("INSERT INTO match_events (match_id, from_status, to_status, note, operator) VALUES (?,?, '入職', ?, ?)")
      .run(m.mid, m.intro_status, `入職日 ${o.hire_date}`, currentOperator());
    db.prepare("UPDATE job_seekers SET status = '就職', updated_at = datetime('now','localtime') WHERE id = ?").run(m.seeker_id);
  })();
  closeSeeker(m.seeker_id, o.hire_date);
  audit('placement_create', id, { match_id: m.mid });
  res.json({ id, feeWarnings: fee.warnings });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const p = load(req.params.id);
  const o = validate(req.body, specs.placement);
  for (const k of ['hire_date', 'employment_term', 'fee_basis_months']) if (k in o && o[k] == null) delete o[k];
  const s = getSettings();
  if (o.invoice_date && !o.due_date && !p.due_date) o.due_date = addDays(o.invoice_date, Number(s.invoice_due_days || 30));
  const merged = { ...p, ...o };
  const warnings = [];
  // 離職入力時は返戻金を自動計算（手入力値があれば優先）
  // 返戻額は「今回空欄で送られた」または「未保存」の場合に自動計算（手入力値があれば優先）
  const sepDate = o.separation_date ?? p.separation_date;
  const wantsRecalc = 'refund_amount' in o ? o.refund_amount == null : p.refund_amount == null;
  if (sepDate && wantsRecalc && (o.separation_date || 'refund_amount' in o)) {
    o.separation_date = sepDate;
    const r = calcRefund({ hireDate: merged.hire_date, separationDate: sepDate, feeAmount: merged.paid_amount || merged.fee_amount,
      separationType: merged.separation_type, policyJson: p.employer_refund_policy });
    if (r.amount != null) { o.refund_rate = r.rate; o.refund_amount = r.amount; }
    if (r.note) warnings.push(r.note);
  }
  const cols = columnsOf(o, specs.placement);
  if (cols.length) db.prepare(`UPDATE placements SET ${cols.map(c => `${c} = @${c}`).join(', ')} WHERE id = @id`).run({ ...o, id: p.id });
  if (o.separation_date || o.refund_date || o.paid_date) closeSeeker(p.seeker_id, todayJst());
  audit('placement_update', p.id, { fields: cols });
  res.json({ ok: true, warnings });
});

router.post('/:id/calc-fee', (req, res) => {
  const p = load(req.params.id);
  const b = validate(req.body, { monthly_wage: 'yen', fee_basis_months: 'num', fee_rate_percent: 'num' });
  // 率を空欄にした場合は、保存値ではなく事業所→設定の率を使う
  const rate = 'fee_rate_percent' in b ? (b.fee_rate_percent ?? p.employer_fee_rate ?? null) : (p.fee_rate_percent ?? p.employer_fee_rate ?? null);
  const r = calcFee({ monthlyWage: b.monthly_wage ?? p.monthly_wage, basisMonths: b.fee_basis_months ?? p.fee_basis_months, ratePercent: rate });
  res.json(r);
});

router.put('/:id/followups/:fid', (req, res) => {
  const p = load(req.params.id);
  const o = validate(req.body, specs.followup);
  const cols = columnsOf(o, specs.followup);
  if (cols.length) {
    getDb().prepare(`UPDATE followups SET ${cols.map(c => `${c} = @${c}`).join(', ')}, operator = @operator WHERE id = @fid AND placement_id = @pid`)
      .run({ ...o, operator: currentOperator(), fid: req.params.fid, pid: p.id });
  }
  // 6か月時点で在職状況を把握できなかった場合は「不明」として記録（事業報告用）
  if (o.still_employed === 0 && !p.separation_date) {
    // 離職日は別途入力
  }
  audit('followup_update', p.id, { followup: req.params.fid });
  res.json({ ok: true });
});

router.post('/:id/followups', (req, res) => {
  const p = load(req.params.id);
  const o = validate({ kind: 'その他', ...req.body }, specs.followup, { required: ['due_date'] });
  const r = getDb().prepare('INSERT INTO followups (placement_id, kind, due_date, note) VALUES (?,?,?,?)').run(p.id, o.kind, o.due_date, o.note);
  res.json({ id: r.lastInsertRowid });
});

module.exports = router;
