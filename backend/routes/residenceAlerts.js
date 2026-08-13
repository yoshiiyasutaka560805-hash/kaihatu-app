'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { recordAudit } = require('../services/auditLog');

// GET /api/residence-alerts?acknowledged=false
router.get('/', (req, res) => {
  const db = getDb();
  const { acknowledged } = req.query;
  const where = acknowledged === 'all' ? '1=1' : 'ra.is_acknowledged = 0';

  const rows = db.prepare(`
    SELECT ra.*, fw.name_native, fw.name_romaji, fw.nationality
    FROM residence_alerts ra
    JOIN foreign_workers fw ON fw.id = ra.foreign_worker_id
    WHERE ${where}
    ORDER BY ra.threshold_days ASC, ra.created_at DESC
  `).all();
  res.json(rows);
});

// PUT /api/residence-alerts/:id/acknowledge
router.put('/:id/acknowledge', (req, res) => {
  const db = getDb();
  const alert = db.prepare('SELECT id FROM residence_alerts WHERE id = ?').get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'アラートが見つかりません' });

  db.prepare(`
    UPDATE residence_alerts
    SET is_acknowledged = 1, acknowledged_by = ?, acknowledged_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.session.userId, req.params.id);

  recordAudit(req, { action: 'update', entityType: 'residence_alert', entityId: Number(req.params.id), after: { is_acknowledged: true } });
  res.json({ ok: true });
});

// POST /api/residence-alerts/check-now - 手動チェック実行
router.post('/check-now', (req, res) => {
  try {
    const { checkAll } = require('../services/residenceAlertChecker');
    const created = checkAll();
    res.json({ checked: true, newAlerts: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
