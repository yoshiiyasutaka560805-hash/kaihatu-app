'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { requireRole } = require('../middleware/auth');
const { recordAudit } = require('../services/auditLog');

const canEdit = requireRole('admin', 'staff');

// GET /api/tasks?assignee=&status=&due_before=&worker_id=&case_id=
router.get('/', (req, res) => {
  const db = getDb();
  const { assignee, status, due_before, worker_id, case_id } = req.query;

  let where = '1=1';
  const params = [];
  if (assignee) { where += ' AND t.assignee_user_id = ?'; params.push(assignee); }
  if (status) { where += ' AND t.status = ?'; params.push(status); }
  if (due_before) { where += ' AND t.due_date IS NOT NULL AND t.due_date <= ?'; params.push(due_before); }
  if (worker_id) { where += ' AND t.foreign_worker_id = ?'; params.push(worker_id); }
  if (case_id) { where += ' AND t.residence_case_id = ?'; params.push(case_id); }

  const rows = db.prepare(`
    SELECT t.*, fw.name_native AS worker_name, u.display_name AS assignee_name
    FROM tasks t
    LEFT JOIN foreign_workers fw ON fw.id = t.foreign_worker_id
    LEFT JOIN users u ON u.id = t.assignee_user_id
    WHERE ${where}
    ORDER BY
      CASE t.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'done' THEN 2 ELSE 3 END,
      t.due_date IS NULL, t.due_date ASC
  `).all(...params);

  res.json(rows);
});

// GET /api/tasks/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const task = db.prepare(`
    SELECT t.*, fw.name_native AS worker_name, u.display_name AS assignee_name
    FROM tasks t
    LEFT JOIN foreign_workers fw ON fw.id = t.foreign_worker_id
    LEFT JOIN users u ON u.id = t.assignee_user_id
    WHERE t.id = ?
  `).get(req.params.id);
  if (!task) return res.status(404).json({ error: 'タスクが見つかりません' });

  const comments = db.prepare(`
    SELECT c.*, u.display_name AS author_name
    FROM task_comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.id);

  res.json({ ...task, comments });
});

// POST /api/tasks
router.post('/', canEdit, (req, res) => {
  const db = getDb();
  const b = req.body;
  if (!b.title) return res.status(400).json({ error: 'title が必要です' });

  const result = db.prepare(`
    INSERT INTO tasks (foreign_worker_id, residence_case_id, title, description, task_type, assignee_user_id, due_date, priority, created_by)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    b.foreign_worker_id || null, b.residence_case_id || null, b.title, b.description || null,
    b.task_type || 'other', b.assignee_user_id || null, b.due_date || null,
    b.priority || 'normal', req.session.userId,
  );

  recordAudit(req, { action: 'create', entityType: 'task', entityId: result.lastInsertRowid });
  res.json({ id: result.lastInsertRowid });
});

// PUT /api/tasks/:id
router.put('/:id', canEdit, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'タスクが見つかりません' });

  const b = req.body;
  const fields = ['title', 'description', 'task_type', 'assignee_user_id', 'due_date', 'priority'];
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (b[f] !== undefined ? b[f] : existing[f]));

  db.prepare(`UPDATE tasks SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...values, req.params.id);

  recordAudit(req, { action: 'update', entityType: 'task', entityId: Number(req.params.id) });
  res.json({ ok: true });
});

// PUT /api/tasks/:id/status
router.put('/:id/status', canEdit, (req, res) => {
  const db = getDb();
  const { status } = req.body;
  if (!['todo', 'in_progress', 'done', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'status が不正です' });
  }

  const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'タスクが見つかりません' });

  db.prepare(`
    UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP, completed_at = CASE WHEN ? = 'done' THEN CURRENT_TIMESTAMP ELSE NULL END
    WHERE id = ?
  `).run(status, status, req.params.id);

  recordAudit(req, { action: 'update', entityType: 'task', entityId: Number(req.params.id), after: { status } });
  res.json({ ok: true });
});

// DELETE /api/tasks/:id
router.delete('/:id', canEdit, (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'タスクが見つかりません' });

  recordAudit(req, { action: 'delete', entityType: 'task', entityId: Number(req.params.id) });
  res.json({ ok: true });
});

// GET /api/tasks/:id/comments
router.get('/:id/comments', (req, res) => {
  const db = getDb();
  const comments = db.prepare(`
    SELECT c.*, u.display_name AS author_name
    FROM task_comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.id);
  res.json(comments);
});

// POST /api/tasks/:id/comments
router.post('/:id/comments', canEdit, (req, res) => {
  const db = getDb();
  const { comment } = req.body;
  if (!comment) return res.status(400).json({ error: 'comment が必要です' });

  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'タスクが見つかりません' });

  const result = db.prepare('INSERT INTO task_comments (task_id, user_id, comment) VALUES (?,?,?)')
    .run(req.params.id, req.session.userId, comment);

  res.json({ id: result.lastInsertRowid });
});

module.exports = router;
