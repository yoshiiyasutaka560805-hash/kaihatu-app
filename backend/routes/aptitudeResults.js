'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { requireAuth } = require('../middleware/auth');

// POST /api/aptitude-results - 適性検査結果の保存
// 候補者が受検時に呼ぶ公開エンドポイントのため、認証不要のまま維持する
router.post('/', (req, res) => {
  const db = getDb();
  const {
    candidate_name, test_date, total_questions, correct_count,
    percentage, category_breakdown, answers, duration_seconds, timer_enabled,
  } = req.body;

  if (!candidate_name || typeof candidate_name !== 'string' || !candidate_name.trim()) {
    return res.status(400).json({ error: 'candidate_name が必要です' });
  }
  if (!Number.isInteger(total_questions) || total_questions <= 0) {
    return res.status(400).json({ error: 'total_questions が不正です' });
  }
  if (!Number.isInteger(correct_count) || correct_count < 0 || correct_count > total_questions) {
    return res.status(400).json({ error: 'correct_count が不正です' });
  }
  if (!category_breakdown || typeof category_breakdown !== 'object') {
    return res.status(400).json({ error: 'category_breakdown が必要です' });
  }

  const result = db.prepare(`
    INSERT INTO aptitude_results (
      candidate_name, test_date, total_questions, correct_count,
      percentage, category_breakdown, answers, duration_seconds, timer_enabled
    ) VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    candidate_name.trim(),
    test_date || new Date().toISOString().slice(0, 10),
    total_questions,
    correct_count,
    Number.isInteger(percentage) ? percentage : Math.round((correct_count / total_questions) * 100),
    JSON.stringify(category_breakdown),
    answers ? JSON.stringify(answers) : null,
    Number.isInteger(duration_seconds) ? duration_seconds : null,
    timer_enabled ? 1 : 0,
  );

  res.json({ id: result.lastInsertRowid });
});

// GET /api/aptitude-results - 結果一覧（新しい順）（HR管理者向け、認証必須）
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, candidate_name, test_date, total_questions,
           correct_count, percentage, created_at
    FROM aptitude_results
    ORDER BY created_at DESC, id DESC
  `).all();
  res.json(rows);
});

// GET /api/aptitude-results/:id - 結果詳細（HR管理者向け、認証必須）
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM aptitude_results WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  row.category_breakdown = JSON.parse(row.category_breakdown);
  row.answers = row.answers ? JSON.parse(row.answers) : null;
  res.json(row);
});

// DELETE /api/aptitude-results/:id - 結果削除（HR管理者向け、認証必須）
router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM aptitude_results WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
