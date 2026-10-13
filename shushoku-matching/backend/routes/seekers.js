'use strict';

const express = require('express');
const router = express.Router();
const { getDb, audit } = require('../database/db');

const FIELDS = ['name', 'name_kana', 'phone', 'email', 'address', 'birth_date', 'prefecture', 'city',
  'acceptable_cities', 'desired_categories', 'desired_employment', 'desired_wage_type', 'desired_wage_min',
  'available_start', 'available_end', 'shift_ok', 'max_days_per_week', 'min_annual_holidays', 'licenses',
  'experience_years', 'experience_note', 'is_foreign_national', 'visa_status', 'notes', 'status',
  'consent_date', 'ai_consent'];
const STATUSES = ['受付', '紹介中', '面接', '内定', '就職', '終了'];

function pick(body) {
  const o = {};
  for (const f of FIELDS) if (body[f] !== undefined) o[f] = body[f] === '' ? null : body[f];
  for (const b of ['shift_ok', 'is_foreign_national', 'ai_consent']) if (o[b] !== undefined) o[b] = o[b] ? 1 : 0;
  if (o.status && !STATUSES.includes(o.status)) throw new Error('ステータスが不正です');
  return o;
}

router.get('/', (req, res) => {
  res.json(getDb().prepare(`SELECT s.id, s.name, s.status, s.city, s.desired_categories, s.updated_at,
    (SELECT COUNT(*) FROM matches m WHERE m.seeker_id = s.id) AS match_count,
    (SELECT MAX(score) FROM matches m WHERE m.seeker_id = s.id) AS top_score
    FROM job_seekers s ORDER BY s.updated_at DESC`).all());
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM job_seekers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '見つかりません' });
  res.json(row);
});

router.post('/', (req, res) => {
  try {
    const o = pick(req.body);
    if (!o.name) return res.status(400).json({ error: '氏名は必須です' });
    if (!o.consent_date) return res.status(400).json({ error: '個人情報取扱いの同意日を入力してください' });
    const cols = Object.keys(o);
    const r = getDb().prepare(`INSERT INTO job_seekers (${cols.join(',')}) VALUES (${cols.map(c => '@' + c).join(',')})`).run(o);
    audit('seeker_create', r.lastInsertRowid);
    res.json({ id: r.lastInsertRowid });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const o = pick(req.body);
    const cols = Object.keys(o);
    if (!cols.length) return res.json({ ok: true });
    getDb().prepare(`UPDATE job_seekers SET ${cols.map(c => `${c} = @${c}`).join(', ')},
      updated_at = datetime('now','localtime') WHERE id = @id`).run({ ...o, id: req.params.id });
    audit('seeker_update', req.params.id, { fields: cols });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM job_seekers WHERE id = ?').run(req.params.id);
  audit('seeker_delete', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
module.exports.STATUSES = STATUSES;
