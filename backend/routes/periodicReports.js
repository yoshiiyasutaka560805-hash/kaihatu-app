'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { requireRole } = require('../middleware/auth');
const { recordAudit } = require('../services/auditLog');

const canEdit = requireRole('admin', 'staff');

// GET /api/periodic-reports?worker_id=&type=&status=
router.get('/', (req, res) => {
  const db = getDb();
  const { worker_id, type, status } = req.query;

  let where = '1=1';
  const params = [];
  if (worker_id) { where += ' AND pr.foreign_worker_id = ?'; params.push(worker_id); }
  if (type) { where += ' AND pr.report_type = ?'; params.push(type); }
  if (status) { where += ' AND pr.status = ?'; params.push(status); }

  const rows = db.prepare(`
    SELECT pr.*, fw.name_native AS worker_name
    FROM periodic_reports pr
    LEFT JOIN foreign_workers fw ON fw.id = pr.foreign_worker_id
    WHERE ${where}
    ORDER BY pr.due_date DESC
  `).all(...params);

  res.json(rows);
});

// GET /api/periodic-reports/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const report = db.prepare(`
    SELECT pr.*, fw.name_native AS worker_name
    FROM periodic_reports pr
    LEFT JOIN foreign_workers fw ON fw.id = pr.foreign_worker_id
    WHERE pr.id = ?
  `).get(req.params.id);
  if (!report) return res.status(404).json({ error: '報告が見つかりません' });
  res.json(report);
});

// POST /api/periodic-reports
router.post('/', canEdit, (req, res) => {
  const db = getDb();
  const b = req.body;
  if (!b.report_type || !b.period_from || !b.period_to || !b.due_date) {
    return res.status(400).json({ error: 'report_type, period_from, period_to, due_date が必要です' });
  }

  const result = db.prepare(`
    INSERT INTO periodic_reports (report_type, foreign_worker_id, period_from, period_to, due_date, notes, created_by)
    VALUES (?,?,?,?,?,?,?)
  `).run(b.report_type, b.foreign_worker_id || null, b.period_from, b.period_to, b.due_date, b.notes || null, req.session.userId);

  recordAudit(req, { action: 'create', entityType: 'periodic_report', entityId: result.lastInsertRowid });
  res.json({ id: result.lastInsertRowid });
});

// PUT /api/periodic-reports/:id
router.put('/:id', canEdit, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM periodic_reports WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '報告が見つかりません' });

  const b = req.body;
  const fields = ['period_from', 'period_to', 'due_date', 'status', 'submitted_date', 'notes'];
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (b[f] !== undefined ? b[f] : existing[f]));

  db.prepare(`UPDATE periodic_reports SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...values, req.params.id);

  recordAudit(req, { action: 'update', entityType: 'periodic_report', entityId: Number(req.params.id) });
  res.json({ ok: true });
});

// GET /api/periodic-reports/:id/export - 印刷用データ（支援実施状況のスナップショットを含む）
router.get('/:id/export', (req, res) => {
  const db = getDb();
  const report = db.prepare(`
    SELECT pr.*, fw.*
    FROM periodic_reports pr
    LEFT JOIN foreign_workers fw ON fw.id = pr.foreign_worker_id
    WHERE pr.id = ?
  `).get(req.params.id);
  if (!report) return res.status(404).json({ error: '報告が見つかりません' });

  let supportPlan = [];
  if (report.foreign_worker_id) {
    supportPlan = db.prepare(`
      SELECT spi.item_name, spc.status, spc.implementation_date, spc.implementer_name
      FROM support_plan_items spi
      LEFT JOIN support_plan_checks spc ON spc.support_plan_item_id = spi.id AND spc.foreign_worker_id = ?
      ORDER BY spi.sort_order
    `).all(report.foreign_worker_id);
  }

  recordAudit(req, { action: 'export', entityType: 'periodic_report', entityId: Number(req.params.id) });
  res.json({ report, supportPlan });
});

module.exports = router;
