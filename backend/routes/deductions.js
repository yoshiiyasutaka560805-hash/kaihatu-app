'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');

// GET /api/deductions?active=1
router.get('/', (req, res) => {
  const db = getDb();
  const { active } = req.query;
  const where = active === '1' ? 'dr.end_date IS NULL' : '1=1';

  const rows = db.prepare(`
    SELECT dr.*, st.name_ja AS service_type_name
    FROM deduction_records dr
    JOIN service_types st ON st.id = dr.service_type_id
    WHERE ${where}
    ORDER BY dr.start_date DESC
  `).all();
  res.json(rows);
});

// POST /api/deductions
router.post('/', (req, res) => {
  const db = getDb();
  const { service_type_id, deduction_type, start_date, reduction_rate, reason } = req.body;
  if (!service_type_id || !deduction_type || !start_date || !reason) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }
  const result = db.prepare(`
    INSERT INTO deduction_records (service_type_id, deduction_type, start_date, reduction_rate, reason)
    VALUES (?,?,?,?,?)
  `).run(service_type_id, deduction_type, start_date, reduction_rate || null, reason);
  res.json({ id: result.lastInsertRowid });
});

// PUT /api/deductions/:id/resolve - 解消済み
router.put('/:id/resolve', (req, res) => {
  const db = getDb();
  const { end_date, resolution_notes } = req.body;
  db.prepare(`
    UPDATE deduction_records
    SET end_date = ?, resolution_notes = ?
    WHERE id = ?
  `).run(end_date || new Date().toISOString().slice(0, 10), resolution_notes || null, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
