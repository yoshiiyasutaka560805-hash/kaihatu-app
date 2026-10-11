const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { sha256 } = require('./crypto');

const MAX_FAILS = 5;
const LOCK_MIN = 15;
const IDLE_MIN = Number(process.env.SESSION_IDLE_MIN || 30);

function audit(userId, action, target, detail, ip) {
  db.prepare('INSERT INTO audit_log (user_id, action, target, detail, ip) VALUES (?,?,?,?,?)')
    .run(userId ?? null, action, target ?? null, detail ?? null, ip ?? null);
}
const sqlNow = (d = new Date()) => d.toISOString().replace('T', ' ').slice(0, 19);

function validatePassword(pw) {
  return typeof pw === 'string' && pw.length >= 10;
}
function createUser(username, displayName, password, role = 'staff') {
  if (!validatePassword(password)) throw new Error('パスワードは10文字以上にしてください');
  const hash = bcrypt.hashSync(password, 12);
  return db.prepare('INSERT INTO users (username, display_name, password_hash, role) VALUES (?,?,?,?)')
    .run(username, displayName, hash, role).lastInsertRowid;
}

function login(username, password, device, ip) {
  const u = db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username || '');
  if (!u) { audit(null, 'login_fail', username, 'unknown user', ip); return { error: 'IDまたはパスワードが違います' }; }
  if (u.locked_until && u.locked_until > sqlNow()) {
    audit(u.id, 'login_locked', username, null, ip);
    return { error: `ロック中です。${LOCK_MIN}分後に再試行してください` };
  }
  if (!bcrypt.compareSync(password || '', u.password_hash)) {
    const n = u.failed_count + 1;
    const lock = n >= MAX_FAILS ? sqlNow(new Date(Date.now() + LOCK_MIN * 60000)) : null;
    db.prepare('UPDATE users SET failed_count=?, locked_until=? WHERE id=?').run(lock ? 0 : n, lock, u.id);
    audit(u.id, 'login_fail', username, `count=${n}`, ip);
    return { error: 'IDまたはパスワードが違います' };
  }
  db.prepare('UPDATE users SET failed_count=0, locked_until=NULL WHERE id=?').run(u.id);
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token_hash, user_id, device, ip) VALUES (?,?,?,?)')
    .run(sha256(token), u.id, (device || '').slice(0, 200), ip);
  audit(u.id, 'login', username, null, ip);
  return { token, user: { id: u.id, username: u.username, display_name: u.display_name, role: u.role } };
}

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return res.status(401).json({ error: '認証が必要です' });
  const s = db.prepare(`SELECT s.token_hash, s.last_seen, s.revoked, u.id uid, u.username, u.display_name, u.role, u.active
    FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`).get(sha256(token));
  const idleLimit = sqlNow(new Date(Date.now() - IDLE_MIN * 60000));
  if (!s || s.revoked || !s.active || s.last_seen < idleLimit) {
    if (s && !s.revoked) db.prepare('UPDATE sessions SET revoked=1 WHERE token_hash=?').run(s.token_hash);
    return res.status(401).json({ error: 'セッションが無効です。再ログインしてください' });
  }
  db.prepare("UPDATE sessions SET last_seen=datetime('now') WHERE token_hash=?").run(s.token_hash);
  req.user = { id: s.uid, username: s.username, display_name: s.display_name, role: s.role };
  req.sessionHash = s.token_hash;
  req.audit = (action, target, detail) => audit(s.uid, action, target, detail, req.ip);
  next();
}
const requireAdmin = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: '管理者権限が必要です' });

module.exports = { createUser, login, requireAuth, requireAdmin, audit, validatePassword };
