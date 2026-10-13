'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const { getDb, audit } = require('../database/db');
const manual = require('../services/sources/manualImport');
const { runAll } = require('../services/scheduler');

function decode(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('shift_jis').decode(buf); }
}

// GET /api/postings?q=&city=&active=1
router.get('/', (req, res) => {
  const where = [];
  const params = {};
  if (req.query.active !== 'all') where.push('is_active = 1');
  if (req.query.q) {
    where.push('(company_name LIKE @q OR job_title LIKE @q OR job_category LIKE @q OR posting_no LIKE @q)');
    params.q = `%${req.query.q}%`;
  }
  if (req.query.city) { where.push('city LIKE @city'); params.city = `%${req.query.city}%`; }
  const sql = `SELECT * FROM job_postings ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY fetched_at DESC LIMIT 500`;
  res.json(getDb().prepare(sql).all(params));
});

router.get('/runs', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM fetch_runs ORDER BY id DESC LIMIT 50').all());
});

router.post('/import-csv', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSVファイルを選択してください' });
  const r = manual.importCsv(decode(req.file.buffer));
  audit('import', 'manual_csv', { inserted: r.inserted, updated: r.updated, errors: r.errors.length });
  res.json(r);
});

router.post('/', (req, res) => {
  const r = manual.importOne(req.body);
  if (r.errors.length) return res.status(400).json({ error: r.errors.join('\n') });
  res.json(r);
});

// 定期取込（提供サービス・自動巡回）を今すぐ実行
router.post('/fetch-now', async (req, res) => {
  res.json(await runAll());
});

router.put('/:id/active', (req, res) => {
  getDb().prepare('UPDATE job_postings SET is_active = ? WHERE id = ?').run(req.body.active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
