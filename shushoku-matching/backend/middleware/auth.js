'use strict';

// 職員ログイン（ローカル運用向けの簡易セッション）
// ・パスワードは scrypt ハッシュで app_settings に保存。初回起動時に画面から設定する
// ・セッションは HttpOnly / SameSite=Strict の Cookie。無操作30分、最長12時間で失効
// ・受付フォーム（本人入力）を開く前に「ロック」すると、職員画面はパスワードなしでは開けない
// ・ログイン失敗5回で5分間ロック

const crypto = require('crypto');
const { getDb } = require('../database/db');

const COOKIE = 'rn_sid';
const IDLE_MS = 30 * 60 * 1000;
const MAX_MS = 12 * 3600 * 1000;
const sessions = new Map(); // token -> { created, last }
let failures = { count: 0, until: 0 };

function getHash() {
  return getDb().prepare("SELECT value FROM app_settings WHERE key = 'staff_password_hash'").get()?.value || '';
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 32);
  return `scrypt:${salt.toString('hex')}:${h.toString('hex')}`;
}

function verify(pw, stored) {
  const [, saltHex, hHex] = stored.split(':');
  const h = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 32);
  return crypto.timingSafeEqual(h, Buffer.from(hHex, 'hex'));
}

function parseCookies(req) {
  return Object.fromEntries((req.get('cookie') || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, v.join('=')]));
}

function valid(token) {
  const s = token && sessions.get(token);
  if (!s) return false;
  const now = Date.now();
  if (now - s.last > IDLE_MS || now - s.created > MAX_MS) { sessions.delete(token); return false; }
  s.last = now;
  return true;
}

function issue(res) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { created: Date.now(), last: Date.now() });
  res.set('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/`);
}

function clear(req, res) {
  sessions.delete(parseCookies(req)[COOKIE]);
  res.set('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

const PUBLIC_API = ['/api/auth/', '/api/intake'];

function authMiddleware(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  if (PUBLIC_API.some(p => req.path.startsWith(p))) return next();
  if (valid(parseCookies(req)[COOKIE])) return next();
  return res.status(401).json({ error: 'ログインが必要です', auth: true });
}

const express = require('express');
const router = express.Router();

router.get('/status', (req, res) => {
  res.json({ setup: Boolean(getHash()), loggedIn: valid(parseCookies(req)[COOKIE]) });
});

function checkStrength(pw) {
  if (typeof pw !== 'string' || pw.length < 8) throw Object.assign(new Error('パスワードは8文字以上にしてください'), { status: 400 });
}

router.post('/setup', (req, res) => {
  if (getHash()) return res.status(409).json({ error: 'パスワードは設定済みです' });
  checkStrength(req.body.password);
  getDb().prepare("INSERT INTO app_settings (key, value) VALUES ('staff_password_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(hashPassword(req.body.password));
  issue(res);
  res.json({ ok: true });
});

router.post('/login', (req, res) => {
  const now = Date.now();
  if (failures.until > now) return res.status(429).json({ error: `ログインの失敗が続いたため、${Math.ceil((failures.until - now) / 60000)}分後に再試行してください` });
  const stored = getHash();
  if (!stored) return res.status(409).json({ error: '初回のパスワード設定が必要です' });
  if (typeof req.body.password !== 'string' || !verify(req.body.password, stored)) {
    failures.count++;
    if (failures.count >= 5) failures = { count: 0, until: now + 5 * 60 * 1000 };
    return res.status(401).json({ error: 'パスワードが違います' });
  }
  failures = { count: 0, until: 0 };
  issue(res);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => { clear(req, res); res.json({ ok: true }); });

router.post('/change', (req, res) => {
  if (!valid(parseCookies(req)[COOKIE])) return res.status(401).json({ error: 'ログインが必要です' });
  if (!verify(String(req.body.current || ''), getHash())) return res.status(401).json({ error: '現在のパスワードが違います' });
  checkStrength(req.body.password);
  getDb().prepare("UPDATE app_settings SET value = ? WHERE key = 'staff_password_hash'").run(hashPassword(req.body.password));
  sessions.clear();
  issue(res);
  res.json({ ok: true });
});

function resetForTest() { sessions.clear(); failures = { count: 0, until: 0 }; }

module.exports = { authMiddleware, authRouter: router, resetForTest };
