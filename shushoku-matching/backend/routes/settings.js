'use strict';

const express = require('express');
const router = express.Router();
const { getDb, getSettings, audit } = require('../database/db');
const { startScheduler } = require('../services/scheduler');
const ai = require('../services/matching/aiAdvisor');

const EDITABLE = ['crawler_enabled', 'crawler_terms_confirmed', 'crawler_base_url', 'crawler_conditions',
  'crawler_interval_ms', 'crawler_cron', 'provision_enabled', 'provision_dir', 'ai_enabled', 'ai_top_n',
  'match_min_score'];

router.get('/', (req, res) => {
  res.json({ ...getSettings(), ai_available: ai.isAvailable(), ai_model: ai.MODEL });
});

router.put('/', (req, res) => {
  if (req.body.crawler_conditions !== undefined) {
    try { if (!Array.isArray(JSON.parse(req.body.crawler_conditions))) throw new Error(); }
    catch { return res.status(400).json({ error: '巡回条件はJSON配列で入力してください' }); }
  }
  const db = getDb();
  const up = db.prepare('INSERT INTO app_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const changed = [];
  db.transaction(() => {
    for (const k of EDITABLE) {
      if (req.body[k] === undefined) continue;
      up.run(k, String(req.body[k]));
      changed.push(k);
    }
  })();
  audit('settings_update', null, { keys: changed });
  if (changed.includes('crawler_cron')) startScheduler();
  res.json({ ok: true });
});

router.get('/audit-log', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all());
});

module.exports = router;
