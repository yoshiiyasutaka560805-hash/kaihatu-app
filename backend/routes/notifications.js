'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');

// GET /api/notifications?subsidy_id=&service_type_id=
router.get('/', (req, res) => {
  const db = getDb();
  const { subsidy_id, service_type_id } = req.query;
  let where = '1=1';
  const params = [];
  if (subsidy_id)      { where += ' AND nh.subsidy_id = ?';      params.push(subsidy_id); }
  if (service_type_id) { where += ' AND nh.service_type_id = ?'; params.push(service_type_id); }

  const rows = db.prepare(`
    SELECT nh.*, s.name_ja AS subsidy_name, st.name_ja AS service_type_name
    FROM notification_history nh
    LEFT JOIN subsidies s ON s.id = nh.subsidy_id
    LEFT JOIN service_types st ON st.id = nh.service_type_id
    WHERE ${where}
    ORDER BY nh.filed_date DESC
  `).all(...params);
  res.json(rows);
});

// POST /api/notifications
router.post('/', (req, res) => {
  const db = getDb();
  const { subsidy_id, service_type_id, filed_date, effective_date, change_content, form_name, filed_by, notes } = req.body;
  if (!filed_date || !change_content) {
    return res.status(400).json({ error: '提出日と変更内容が必要です' });
  }
  const result = db.prepare(`
    INSERT INTO notification_history (subsidy_id, service_type_id, filed_date, effective_date, change_content, form_name, filed_by, notes)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(subsidy_id || null, service_type_id || null, filed_date, effective_date || null, change_content, form_name || null, filed_by || null, notes || null);
  res.json({ id: result.lastInsertRowid });
});

// DELETE /api/notifications/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM notification_history WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
