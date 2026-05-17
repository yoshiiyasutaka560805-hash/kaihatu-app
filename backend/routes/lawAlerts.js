'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');

// GET /api/law-alerts
router.get('/', (req, res) => {
  const db = getDb();
  const { acknowledged } = req.query;
  let where = acknowledged === 'all' ? '1=1' : 'la.is_acknowledged = 0';

  const rows = db.prepare(`
    SELECT la.*, ls.source_name, ls.source_url
    FROM law_update_alerts la
    JOIN law_update_sources ls ON ls.id = la.source_id
    WHERE ${where}
    ORDER BY la.detected_at DESC
  `).all();
  res.json(rows);
});

// PUT /api/law-alerts/:id/acknowledge
router.put('/:id/acknowledge', (req, res) => {
  const db = getDb();
  db.prepare(`
    UPDATE law_update_alerts
    SET is_acknowledged = 1, acknowledged_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.params.id);
  res.json({ ok: true });
});

// POST /api/law-alerts/check-now - 手動チェック実行
router.post('/check-now', async (req, res) => {
  try {
    const { checkAll } = require('../services/lawUpdateChecker');
    const found = await checkAll();
    res.json({ checked: true, newAlerts: found });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/law-alerts/sources
router.get('/sources', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM law_update_sources ORDER BY id').all());
});

module.exports = router;
