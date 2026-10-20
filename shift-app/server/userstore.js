'use strict';
// ユーザー台帳（data/users.json）とパスワードハッシュ。server.js / adduser.js 共通。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROLES = {
  admin: 'システム管理者',
  manager1: '管理者(Ⅰ)',
  manager2: '管理者(Ⅱ)',
  staff: '一般職員',
};
const N = 32768, R = 8, P = 1, KEYLEN = 64, MAXMEM = 128 * 1024 * 1024;

function scryptAsync(pw, salt, n, r, p) {
  return new Promise((res, rej) => crypto.scrypt(pw, salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM }, (e, k) => (e ? rej(e) : res(k))));
}
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync(pw.normalize('NFKC'), salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}
async function verifyPassword(pw, stored) {
  try {
    const [alg, n, r, p, s, h] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const want = Buffer.from(h, 'base64');
    const got = await scryptAsync(String(pw).normalize('NFKC'), Buffer.from(s, 'base64'), +n, +r, +p);
    return want.length === got.length && crypto.timingSafeEqual(want, got);
  } catch (e) { return false; }
}

function dataDir() { return path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data')); }
function usersFile(dir) { return path.join(dir || dataDir(), 'users.json'); }
function loadUsers(dir) {
  try { return JSON.parse(fs.readFileSync(usersFile(dir), 'utf8')).users || {}; } catch (e) { return {}; }
}
function saveUsers(users, dir) {
  const d = dir || dataDir();
  fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  const f = usersFile(d), tmp = f + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ users }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, f);
}
module.exports = { ROLES, hashPassword, verifyPassword, loadUsers, saveUsers, dataDir };
