'use strict';

const express = require('express');
const router = express.Router();
const { getDb, audit } = require('../database/db');
const specs = require('../models/specs');
const { validate, columnsOf, ah } = require('../utils/validate');
const { runForSeeker, evaluate, activePostings } = require('../services/matching/runner');
const { getSettings } = require('../database/db');
const { todayJst } = require('../utils/dates');
const { currentOperator } = require('../middleware/context');

router.post('/run', ah(async (req, res) => {
  const seekerId = Number(req.body.seekerId);
  if (!seekerId) return res.status(400).json({ error: 'seekerId が必要です' });
  res.json(await runForSeeker(seekerId, { withAi: req.body.withAi !== false }));
}));

router.get('/', (req, res) => {
  const rows = getDb().prepare(`SELECT m.*, p.posting_no, p.origin, p.company_name, p.prefecture, p.city, p.job_title,
      p.facility_type, p.employment_type, p.employment_term, p.wage_type, p.wage_min, p.wage_max, p.work_start, p.work_end,
      p.shift_work, p.nights_per_month, p.annual_holidays, p.expiry_date, p.source_url, p.is_active, p.employer_id,
      c.minutes AS commute_minutes, c.source AS commute_source, pl.id AS placement_id
    FROM matches m JOIN job_postings p ON p.id = m.posting_id
    LEFT JOIN commute_cache c ON c.seeker_id = m.seeker_id AND c.posting_id = m.posting_id
    LEFT JOIN placements pl ON pl.match_id = m.id
    WHERE m.seeker_id = ? ORDER BY CASE m.intro_status WHEN '未提案' THEN 1 ELSE 0 END, m.score DESC`).all(req.query.seekerId);
  res.json(rows.map(r => ({ ...r, breakdown: JSON.parse(r.breakdown), ai_comment: r.ai_comment ? JSON.parse(r.ai_comment) : null })));
});

// 除外理由が1つだけの「惜しい求人」（何が変われば対象になるか）
router.get('/near-misses', (req, res) => {
  const seeker = getDb().prepare('SELECT * FROM job_seekers WHERE id = ? AND deleted_at IS NULL').get(req.query.seekerId);
  if (!seeker) return res.status(404).json({ error: '求職者が見つかりません' });
  const postings = activePostings();
  const { nearMisses } = evaluate(seeker, postings, getSettings());
  res.json(nearMisses.slice(0, 30).map(n => ({ posting_id: n.posting.id, posting_no: n.posting.posting_no,
    company_name: n.posting.company_name, job_title: n.posting.job_title, city: n.posting.city, score: n.match.score,
    reason: n.match.reasonDetails[0].text, hint: n.match.reasonDetails[0].hint })));
});

router.post('/seen', (req, res) => {
  getDb().prepare('UPDATE matches SET is_new = 0 WHERE seeker_id = ?').run(req.body.seekerId);
  res.json({ ok: true });
});

const DATE_FOR_STATUS = { 提案済: 'proposed_date', 応募: 'applied_date', 内定: 'offer_date' };

router.put('/:id', (req, res) => {
  const db = getDb();
  const m = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: '候補が見つかりません' });
  const o = validate(req.body, specs.match);
  if (o.intro_status === '入職') return res.status(400).json({ error: '入職は「成約登録」から行ってください' });
  if (o.intro_status && ['不採用', '辞退'].includes(o.intro_status) && !o.decline_reason && !m.decline_reason) {
    return res.status(400).json({ error: '不採用・辞退の理由を選択してください' });
  }
  if (o.intro_status && DATE_FOR_STATUS[o.intro_status] && !o[DATE_FOR_STATUS[o.intro_status]] && !m[DATE_FOR_STATUS[o.intro_status]]) {
    o[DATE_FOR_STATUS[o.intro_status]] = todayJst();
  }
  const cols = columnsOf({ ...o, ...(o[DATE_FOR_STATUS[o.intro_status]] ? { [DATE_FOR_STATUS[o.intro_status]]: o[DATE_FOR_STATUS[o.intro_status]] } : {}) }, specs.match);
  db.transaction(() => {
    if (cols.length) db.prepare(`UPDATE matches SET ${cols.map(c => `${c} = @${c}`).join(', ')}, is_new = 0 WHERE id = @id`).run({ ...o, id: m.id });
    if (o.intro_status && o.intro_status !== m.intro_status) {
      db.prepare('INSERT INTO match_events (match_id, from_status, to_status, note, operator) VALUES (?,?,?,?,?)')
        .run(m.id, m.intro_status, o.intro_status, o.decline_reason || (o.note ? String(o.note).slice(0, 100) : null), currentOperator());
      // 求職者のステータスを連動（受付→紹介中→面接）
      const s = db.prepare('SELECT status FROM job_seekers WHERE id = ?').get(m.seeker_id);
      const next = { 提案済: '紹介中', 応募: '紹介中', 面接: '面接', 内定: '内定' }[o.intro_status];
      const order = ['受付', '紹介中', '面接', '内定'];
      if (next && order.indexOf(s.status) >= 0 && order.indexOf(next) > order.indexOf(s.status)) {
        db.prepare("UPDATE job_seekers SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(next, m.seeker_id);
      }
    }
  })();
  audit('match_update', m.id, { fields: cols });
  res.json({ ok: true });
});

router.get('/:id/events', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM match_events WHERE match_id = ? ORDER BY id').all(req.params.id));
});

module.exports = router;
