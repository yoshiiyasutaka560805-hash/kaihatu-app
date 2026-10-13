'use strict';

const express = require('express');
const router = express.Router();
const { getDb, audit } = require('../database/db');
const specs = require('../models/specs');
const { validate, columnsOf } = require('../utils/validate');
const { parsePolicy } = require('../services/fees');

function load(id) {
  const e = getDb().prepare('SELECT * FROM employers WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!e) throw Object.assign(new Error('事業所が見つかりません'), { status: 404 });
  return e;
}

function checkPolicy(o) {
  if (o.refund_policy) {
    try { JSON.parse(o.refund_policy); } catch { throw Object.assign(new Error('返戻金規定はJSON配列で入力してください'), { status: 400 }); }
    if (!parsePolicy(o.refund_policy).length) throw Object.assign(new Error('返戻金規定の形式：[{"withinDays":30,"rate":80}]'), { status: 400 });
  }
}

router.get('/', (req, res) => {
  const params = {};
  let where = 'e.deleted_at IS NULL';
  if (req.query.q) { where += ' AND (e.name LIKE @q OR e.city LIKE @q)'; params.q = `%${req.query.q}%`; }
  res.json(getDb().prepare(`SELECT e.*, (SELECT COUNT(*) FROM job_postings p WHERE p.employer_id = e.id AND p.is_active = 1) AS active_postings,
    (SELECT COUNT(*) FROM placements pl WHERE pl.employer_id = e.id) AS placements FROM employers e WHERE ${where} ORDER BY e.name`).all(params));
});

router.get('/:id', (req, res) => {
  const e = load(req.params.id);
  const postings = getDb().prepare('SELECT id, posting_no, job_title, is_active, received_date, expiry_date FROM job_postings WHERE employer_id = ? ORDER BY received_date DESC').all(e.id);
  res.json({ ...e, postings });
});

router.post('/', (req, res) => {
  const o = validate(req.body, specs.employer, { required: ['name'] });
  checkPolicy(o);
  const cols = columnsOf(o, specs.employer);
  const r = getDb().prepare(`INSERT INTO employers (${cols.join(',')}) VALUES (${cols.map(c => '@' + c).join(',')})`).run(o);
  audit('employer_create', r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const e = load(req.params.id);
  const o = validate(req.body, specs.employer);
  checkPolicy(o);
  const cols = columnsOf(o, specs.employer);
  if (cols.length) getDb().prepare(`UPDATE employers SET ${cols.map(c => `${c} = @${c}`).join(', ')}, updated_at = datetime('now','localtime') WHERE id = @id`).run({ ...o, id: e.id });
  audit('employer_update', e.id, { fields: cols });
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const e = load(req.params.id);
  getDb().prepare("UPDATE employers SET deleted_at = datetime('now','localtime') WHERE id = ?").run(e.id);
  audit('employer_delete', e.id);
  res.json({ ok: true });
});

module.exports = router;
