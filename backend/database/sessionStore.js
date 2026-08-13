'use strict';

const session = require('express-session');
const { getDb } = require('./db');

class SqliteSessionStore extends session.Store {
  get(sid, cb) {
    try {
      const db = getDb();
      const row = db.prepare('SELECT session, expires_at FROM user_sessions WHERE sid = ?').get(sid);
      if (!row || row.expires_at < Date.now()) {
        if (row) db.prepare('DELETE FROM user_sessions WHERE sid = ?').run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.session));
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sessionData, cb) {
    try {
      const db = getDb();
      const maxAge = sessionData.cookie?.maxAge ?? 8 * 60 * 60 * 1000;
      const expiresAt = Date.now() + maxAge;
      db.prepare(`
        INSERT INTO user_sessions (sid, session, expires_at)
        VALUES (?,?,?)
        ON CONFLICT(sid) DO UPDATE SET session = excluded.session, expires_at = excluded.expires_at
      `).run(sid, JSON.stringify(sessionData), expiresAt);
      cb?.(null);
    } catch (err) {
      cb?.(err);
    }
  }

  destroy(sid, cb) {
    try {
      const db = getDb();
      db.prepare('DELETE FROM user_sessions WHERE sid = ?').run(sid);
      cb?.(null);
    } catch (err) {
      cb?.(err);
    }
  }

  touch(sid, sessionData, cb) {
    this.set(sid, sessionData, cb);
  }
}

function cleanupExpiredSessions() {
  const db = getDb();
  db.prepare('DELETE FROM user_sessions WHERE expires_at < ?').run(Date.now());
}

module.exports = { SqliteSessionStore, cleanupExpiredSessions };
