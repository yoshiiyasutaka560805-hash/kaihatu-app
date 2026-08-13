'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../database/db');
const { requireRole } = require('../middleware/auth');
const { recordAudit } = require('../services/auditLog');

router.use(requireRole('admin'));

// GET /api/users
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, username, display_name, email, role, is_active, must_change_password,
           last_login_at, created_at
    FROM users ORDER BY created_at
  `).all();
  res.json(rows);
});

// POST /api/users
router.post('/', (req, res) => {
  const { username, display_name, email, role, initial_password } = req.body;
  if (!username || !display_name || !initial_password) {
    return res.status(400).json({ error: 'username, display_name, initial_password が必要です' });
  }
  if (!['admin', 'staff', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'role は admin/staff/viewer のいずれかが必要です' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'このユーザー名は既に使用されています' });

  const hash = bcrypt.hashSync(initial_password, 10);
  const result = db.prepare(`
    INSERT INTO users (username, display_name, email, password_hash, role, must_change_password)
    VALUES (?,?,?,?,?,1)
  `).run(username, display_name, email || null, hash, role);

  recordAudit(req, { action: 'create', entityType: 'user', entityId: result.lastInsertRowid });
  res.json({ id: result.lastInsertRowid });
});

// PUT /api/users/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

  const { display_name, email, role } = req.body;
  if (role && !['admin', 'staff', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'role は admin/staff/viewer のいずれかが必要です' });
  }

  db.prepare(`
    UPDATE users SET display_name = ?, email = ?, role = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    display_name ?? user.display_name,
    email ?? user.email,
    role ?? user.role,
    id,
  );

  recordAudit(req, { action: 'update', entityType: 'user', entityId: Number(id) });
  res.json({ ok: true });
});

// PUT /api/users/:id/reset-password
router.put('/:id/reset-password', (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'new_password は8文字以上で入力してください' });
  }

  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare(`
    UPDATE users SET password_hash = ?, must_change_password = 1, failed_login_count = 0,
      locked_until = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(hash, req.params.id);

  recordAudit(req, { action: 'update', entityType: 'user', entityId: Number(req.params.id), after: { reset_password: true } });
  res.json({ ok: true });
});

// PUT /api/users/:id/deactivate
router.put('/:id/deactivate', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

  db.prepare('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  recordAudit(req, { action: 'update', entityType: 'user', entityId: Number(req.params.id), after: { is_active: false } });
  res.json({ ok: true });
});

// PUT /api/users/:id/activate
router.put('/:id/activate', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

  db.prepare('UPDATE users SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  recordAudit(req, { action: 'update', entityType: 'user', entityId: Number(req.params.id), after: { is_active: true } });
  res.json({ ok: true });
});

module.exports = router;
