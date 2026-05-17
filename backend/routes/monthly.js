'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');

// GET /api/monthly?year_month=2026-05
router.get('/', (req, res) => {
  const db = getDb();
  const { year_month } = req.query;
  const ym = year_month || new Date().toISOString().slice(0, 7);

  const rows = db.prepare(`
    SELECT msr.*, st.name_ja AS service_type_name
    FROM monthly_staff_records msr
    JOIN service_types st ON st.id = msr.service_type_id
    WHERE msr.year_month = ?
    ORDER BY st.sort_order, msr.role_code
  `).all(ym);

  res.json({ year_month: ym, records: rows });
});

// GET /api/monthly/history?service_type_id=1&role_code=nurse
router.get('/history', (req, res) => {
  const db = getDb();
  const { service_type_id, role_code } = req.query;
  const rows = db.prepare(`
    SELECT year_month, full_time_equiv, required_fta, is_deficient
    FROM monthly_staff_records
    WHERE service_type_id = ? AND role_code = ?
    ORDER BY year_month DESC
    LIMIT 12
  `).all(service_type_id, role_code);
  res.json(rows.reverse());
});

// PUT /api/monthly - 月次記録の一括保存
router.put('/', (req, res) => {
  const db = getDb();
  const { records } = req.body;

  if (!Array.isArray(records)) return res.status(400).json({ error: 'records は配列が必要です' });

  const upsert = db.prepare(`
    INSERT INTO monthly_staff_records
      (year_month, service_type_id, role_code, full_time_equiv, required_fta, is_deficient, notes)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(year_month, service_type_id, role_code)
    DO UPDATE SET
      full_time_equiv = excluded.full_time_equiv,
      required_fta = excluded.required_fta,
      is_deficient = excluded.is_deficient,
      notes = excluded.notes,
      recorded_at = CURRENT_TIMESTAMP
  `);

  db.transaction(() => {
    for (const r of records) {
      const isDeficient = r.required_fta != null && r.full_time_equiv < r.required_fta ? 1 : 0;
      upsert.run(
        r.year_month, r.service_type_id, r.role_code,
        r.full_time_equiv, r.required_fta || null,
        isDeficient, r.notes || null,
      );
    }
  })();

  res.json({ ok: true });
});

module.exports = router;
