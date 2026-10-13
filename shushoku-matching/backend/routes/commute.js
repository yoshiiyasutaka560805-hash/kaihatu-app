'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { validate, ah } = require('../utils/validate');
const commute = require('../services/commute');

// 通勤時間
router.put('/', (req, res) => {
  const o = validate(req.body, { seeker_id: 'int', posting_id: 'int', minutes: 'int', mode: 'text:20' }, { required: ['seeker_id', 'posting_id'] });
  if (o.minutes == null) commute.clear(o.seeker_id, o.posting_id);
  else if (o.minutes < 0 || o.minutes > 600) return res.status(400).json({ error: '通勤時間は0〜600分で入力してください' });
  else commute.setManual(o.seeker_id, o.posting_id, o.minutes, o.mode);
  res.json({ ok: true });
});

router.post('/estimate', ah(async (req, res) => {
  const db = getDb();
  const seeker = db.prepare('SELECT * FROM job_seekers WHERE id = ? AND deleted_at IS NULL').get(req.body.seekerId);
  if (!seeker) return res.status(404).json({ error: '求職者が見つかりません' });
  const postings = db.prepare(`SELECT p.* FROM job_postings p JOIN matches m ON m.posting_id = p.id WHERE m.seeker_id = ?`).all(seeker.id);
  res.json({ results: await commute.estimateViaApi(seeker, postings) });
}));

module.exports = router;
