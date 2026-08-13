'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');

// GET /api/support-plans/items - 支援計画の法定項目マスタ
router.get('/items', (req, res) => {
  const db = getDb();
  const items = db.prepare('SELECT * FROM support_plan_items ORDER BY sort_order').all();
  res.json(items);
});

module.exports = router;
