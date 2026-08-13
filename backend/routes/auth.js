'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../database/db');
const { recordAudit } = require('../services/auditLog');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username と password が必要です' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);

  if (!user) {
    recordAudit(req, { action: 'login_failed', entityType: 'user', after: { username } });
    return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    return res.status(423).json({ error: 'ログイン試行回数が上限に達したため、一時的にロックされています' });
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    const failedCount = user.failed_login_count + 1;
    const lockedUntil = failedCount >= MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + LOCK_DURATION_MS).toISOString()
      : null;
    db.prepare('UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?')
      .run(failedCount, lockedUntil, user.id);
    recordAudit(req, { action: 'login_failed', entityType: 'user', entityId: user.id });
    return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
  }

  db.prepare(`
    UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(user.id);

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.displayName = user.display_name;

  recordAudit(req, { action: 'login', entityType: 'user', entityId: user.id });

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    mustChangePassword: !!user.must_change_password,
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  if (req.session?.userId) {
    recordAudit(req, { action: 'logout', entityType: 'user', entityId: req.session.userId });
  }
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: '未ログインです' });
  }
  const db = getDb();
  const user = db.prepare('SELECT id, username, display_name, role, must_change_password FROM users WHERE id = ?')
    .get(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: '未ログインです' });
  }
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    mustChangePassword: !!user.must_change_password,
  });
});

// PUT /api/auth/me/password - 本人によるパスワード変更
router.put('/me/password', (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: '未ログインです' });
  }
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: '新しいパスワードは8文字以上で入力してください' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

  if (!user.must_change_password) {
    if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: '現在のパスワードが正しくありません' });
    }
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(hash, user.id);

  res.json({ ok: true });
});

module.exports = router;
