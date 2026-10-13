'use strict';

const express = require('express');
const router = express.Router();
const { getDb, getSettings, setSetting, audit } = require('../database/db');
const DEFAULTS = require('../database/defaults');
const { startScheduler, validateCron, runDaily } = require('../services/scheduler');
const { usageSummary } = require('../services/ai/client');
const { runBackup, listBackups } = require('../services/backup');
const { purgeCandidates } = require('../services/retention');
const { parsePolicy } = require('../services/fees');
const { addDays, todayJst } = require('../utils/dates');
const { ah } = require('../utils/validate');
const specs = require('../models/specs');

const NUMERIC = { match_min_score: [0, 100], wage_tolerance_percent: [0, 30], ai_top_n: [0, 10], ai_monthly_budget_usd: [0, 10000],
  fee_rate_percent: [0, 100], fee_cap_percent: [0, 100], fee_basis_months: [0, 24], invoice_due_days: [0, 365],
  retention_years: [2, 20], seeker_validity_months: [1, 24], backup_keep: [1, 365] };
const BOOL = ['ai_enabled', 'provision_enabled', 'tokutei_visiting_allowed'];
const JSON_KEYS = { refund_policy: 'array', provision_column_map: 'object' };
const EDITABLE = Object.keys(DEFAULTS).filter(k => !k.startsWith('crawler_'));

router.get('/', (req, res) => {
  const s = getSettings();
  for (const k of Object.keys(s)) if (k.startsWith('crawler_')) delete s[k];
  res.json({ settings: s, backupEncrypted: Boolean(process.env.BACKUP_PASSWORD), mapsApi: Boolean(process.env.GOOGLE_MAPS_API_KEY) });
});

router.get('/meta', (req, res) => {
  res.json({ facilityTypes: specs.FACILITY_TYPES, jobKinds: specs.JOB_KINDS, seekerStatuses: specs.SEEKER_STATUSES,
    introStatuses: specs.INTRO_STATUSES, declineReasons: specs.DECLINE_REASONS, languages: specs.LANGUAGES,
    weightProfiles: specs.WEIGHT_PROFILES, visaTypes: specs.VISA_TYPES, operators: getSettings().operators.split(',').map(s => s.trim()).filter(Boolean) });
});

router.put('/', (req, res) => {
  const changes = {};
  for (const k of EDITABLE) {
    if (req.body[k] === undefined) continue;
    let v = req.body[k] == null ? '' : String(req.body[k]).trim();
    if (NUMERIC[k] && v !== '') {
      const n = Number(v);
      if (!Number.isFinite(n) || n < NUMERIC[k][0] || n > NUMERIC[k][1]) return res.status(400).json({ error: `${k} は ${NUMERIC[k][0]}〜${NUMERIC[k][1]} で入力してください` });
    }
    if (BOOL.includes(k)) v = v === '1' || v === 'true' ? '1' : '0';
    if (JSON_KEYS[k]) {
      let parsed;
      try { parsed = JSON.parse(v || (JSON_KEYS[k] === 'array' ? '[]' : '{}')); } catch { return res.status(400).json({ error: `${k} はJSONで入力してください` }); }
      if (JSON_KEYS[k] === 'array' ? !Array.isArray(parsed) : (typeof parsed !== 'object' || Array.isArray(parsed))) return res.status(400).json({ error: `${k} の形式が正しくありません` });
      if (k === 'refund_policy' && parsed.length && parsePolicy(v).length !== parsed.length) return res.status(400).json({ error: '返戻金規定の形式：[{"withinDays":30,"rate":80}]' });
    }
    if (k === 'fetch_cron' && !validateCron(v)) return res.status(400).json({ error: '取込スケジュール（cron式）が正しくありません' });
    changes[k] = v;
  }
  getDb().transaction(() => { for (const [k, v] of Object.entries(changes)) setSetting(k, v); })();
  audit('settings_update', null, { keys: Object.keys(changes) });
  if ('fetch_cron' in changes) startScheduler();
  res.json({ ok: true });
});

router.get('/audit-log', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 300').all());
});
router.get('/ai-usage', (req, res) => res.json(usageSummary()));
router.get('/backups', (req, res) => res.json(listBackups()));
router.post('/backup-now', ah(async (req, res) => { const r = await runBackup(); audit('backup', null, { encrypted: r.encrypted }); res.json(r); }));
router.get('/purge-candidates', (req, res) => res.json(purgeCandidates(addDays(todayJst(), 30))));
router.post('/daily-now', ah(async (req, res) => res.json(await runDaily())));

module.exports = router;
