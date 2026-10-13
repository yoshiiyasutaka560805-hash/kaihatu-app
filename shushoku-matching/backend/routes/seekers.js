'use strict';

const express = require('express');
const router = express.Router();
const { getDb, getSettings, audit } = require('../database/db');
const specs = require('../models/specs');
const { validate, columnsOf, ah } = require('../utils/validate');
const { todayJst, addMonths } = require('../utils/dates');
const { detectProhibited } = require('../services/ai/pii');
const { closeSeeker, reopenSeeker } = require('../services/retention');
const { solicitationGuard } = require('../services/matching/runner');
const { currentOperator } = require('../middleware/context');

const CLOSED = ['就職', '終了'];

function load(id) {
  const row = getDb().prepare('SELECT * FROM job_seekers WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!row) throw Object.assign(new Error('求職者が見つかりません'), { status: 404 });
  return row;
}

const prohibitedOf = o => detectProhibited([o.notes, o.experience_note, o.priorities]);

router.get('/', (req, res) => {
  const where = ['s.deleted_at IS NULL'];
  const params = {};
  if (req.query.status) { where.push('s.status = @status'); params.status = req.query.status; }
  if (req.query.q) { where.push('(s.name LIKE @q OR s.name_kana LIKE @q OR s.city LIKE @q)'); params.q = `%${req.query.q}%`; }
  res.json(getDb().prepare(`SELECT s.id, s.name, s.name_kana, s.status, s.city, s.desired_categories, s.desired_job_kinds,
    s.is_foreign_national, s.visa_status, s.residence_expiry, s.preferred_language, s.updated_at, s.accepted_date,
    (SELECT COUNT(*) FROM matches m WHERE m.seeker_id = s.id) AS match_count,
    (SELECT COUNT(*) FROM matches m WHERE m.seeker_id = s.id AND m.is_new = 1) AS new_count,
    (SELECT MAX(score) FROM matches m WHERE m.seeker_id = s.id) AS top_score
    FROM job_seekers s WHERE ${where.join(' AND ')} ORDER BY s.updated_at DESC`).all(params));
});

router.get('/:id', (req, res) => {
  const s = load(req.params.id);
  audit('seeker_view', s.id);
  res.json({ ...s, guard: solicitationGuard(s.id), prohibited: prohibitedOf(s) });
});

router.post('/', (req, res) => {
  const o = validate(req.body, specs.seeker, { required: ['name', 'consent_date'] });
  const settings = getSettings();
  o.accepted_date = o.accepted_date || todayJst();
  o.validity_end = o.validity_end || addMonths(o.accepted_date, Number(settings.seeker_validity_months || 3));
  const cols = columnsOf(o, specs.seeker);
  const r = getDb().prepare(`INSERT INTO job_seekers (${cols.join(',')}) VALUES (${cols.map(c => '@' + c).join(',')})`).run(o);
  audit('seeker_create', r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid, prohibited: prohibitedOf(o) });
});

router.put('/:id', (req, res) => {
  const before = load(req.params.id);
  const o = validate(req.body, specs.seeker);
  const cols = columnsOf(o, specs.seeker);
  if (cols.length) {
    getDb().prepare(`UPDATE job_seekers SET ${cols.map(c => `${c} = @${c}`).join(', ')}, updated_at = datetime('now','localtime')
      WHERE id = @id`).run({ ...o, id: before.id });
  }
  if (o.status && o.status !== before.status) {
    if (CLOSED.includes(o.status)) closeSeeker(before.id);
    else if (CLOSED.includes(before.status)) reopenSeeker(before.id);
  }
  audit('seeker_update', before.id, { fields: cols });
  res.json({ ok: true, prohibited: prohibitedOf({ ...before, ...o }) });
});

// 論理削除：帳簿保存のため保存期限まではデータを保持し、期限到来後に自動削除
router.delete('/:id', (req, res) => {
  const s = load(req.params.id);
  getDb().prepare("UPDATE job_seekers SET deleted_at = datetime('now','localtime') WHERE id = ?").run(s.id);
  closeSeeker(s.id);
  audit('seeker_delete', s.id);
  res.json({ ok: true, retention_until: getDb().prepare('SELECT retention_until FROM job_seekers WHERE id = ?').get(s.id).retention_until });
});

// 面談記録
router.get('/:id/notes', (req, res) => {
  load(req.params.id);
  res.json(getDb().prepare('SELECT * FROM interview_notes WHERE seeker_id = ? ORDER BY at DESC').all(req.params.id));
});

router.post('/:id/notes', (req, res) => {
  const s = load(req.params.id);
  const o = validate({ at: `${todayJst()} 00:00`, ...req.body }, specs.interviewNote, { required: ['memo'] });
  const r = getDb().prepare('INSERT INTO interview_notes (seeker_id, at, method, memo, operator) VALUES (?,?,?,?,?)')
    .run(s.id, o.at, o.method, o.memo, currentOperator());
  audit('note_create', s.id);
  res.json({ id: r.lastInsertRowid, prohibited: detectProhibited([o.memo]) });
});

module.exports = router;
