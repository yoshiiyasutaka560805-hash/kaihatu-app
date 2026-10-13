'use strict';

const express = require('express');
const router = express.Router();
const { getDb, audit } = require('../database/db');
const { runForSeeker } = require('../services/matching/runner');

const INTRO_STATUSES = ['未提案', '提案済', '応募', '面接', '内定', '不採用', '辞退'];

// POST /api/matches/run  { seekerId, withAi }
router.post('/run', async (req, res) => {
  try {
    res.json(await runForSeeker(Number(req.body.seekerId), { withAi: req.body.withAi !== false }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /api/matches?seekerId=
router.get('/', (req, res) => {
  const rows = getDb().prepare(`SELECT m.*, p.posting_no, p.company_name, p.prefecture, p.city, p.job_title,
      p.employment_type, p.wage_type, p.wage_min, p.wage_max, p.work_start, p.work_end, p.shift_work,
      p.annual_holidays, p.expiry_date, p.source_url, p.is_active
    FROM matches m JOIN job_postings p ON p.id = m.posting_id
    WHERE m.seeker_id = ? ORDER BY m.score DESC`).all(req.query.seekerId);
  res.json(rows.map(r => ({
    ...r,
    breakdown: JSON.parse(r.breakdown),
    ai_comment: r.ai_comment ? JSON.parse(r.ai_comment) : null,
  })));
});

router.put('/:id/status', (req, res) => {
  const { intro_status } = req.body;
  if (!INTRO_STATUSES.includes(intro_status)) return res.status(400).json({ error: '紹介ステータスが不正です' });
  getDb().prepare('UPDATE matches SET intro_status = ? WHERE id = ?').run(intro_status, req.params.id);
  audit('match_status', req.params.id, { intro_status });
  res.json({ ok: true });
});

module.exports = router;
