#!/usr/bin/env node
'use strict';
// 勤務表アプリ 社内サーバー版（外部npm依存なし / Node 22 標準モジュールのみ）
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const { ROLES, verifyPassword, hashPassword, loadUsers, saveUsers, dataDir } = require('./userstore');

const PORT = process.env.PORT === undefined ? 8443 : +process.env.PORT;
const HOST = process.env.HOST || '127.0.0.1';
const DATA = dataDir();
const TLS = !!(process.env.TLS_CERT && process.env.TLS_KEY);
const SECURE_COOKIE = process.env.SECURE_COOKIE === '1' || TLS;
const SESSION_MS = (+process.env.SESSION_HOURS || 8) * 3600 * 1000;
const BACKUP_KEEP = +process.env.BACKUP_KEEP || 30;
const MAX_BODY = 5 * 1024 * 1024;
const LOCK_FAILS = 5, LOCK_WINDOW = 10 * 60 * 1000, IP_FAILS = 30;
const INDEX = path.join(__dirname, '..', 'index.html');

// リバースプロキシ配下の設定（既定は信用しない）
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
// X-Forwarded-For を信用する直接接続元（既定はループバックのみ。別ホストのプロキシは TRUST_PROXY_IPS にカンマ区切りで）
const TRUST_PROXY_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'].concat(String(process.env.TRUST_PROXY_IPS || '').split(',').map(s => s.trim()).filter(Boolean)));
const PUBLIC_ORIGINS = new Set(String(process.env.PUBLIC_ORIGIN || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean));
// 監査ログ：月次または AUDIT_MAX_BYTES でローテーション。AUDIT_RETENTION_DAYS 未設定なら削除しない
const AUDIT_RETENTION_DAYS = +process.env.AUDIT_RETENTION_DAYS > 0 ? +process.env.AUDIT_RETENTION_DAYS : 0;
const AUDIT_MAX_BYTES = +process.env.AUDIT_MAX_BYTES > 0 ? +process.env.AUDIT_MAX_BYTES : 5 * 1024 * 1024;
const PW_MIN = 12, PW_MAX = 128;

const MONTHS = path.join(DATA, 'months'), BACKUPS = path.join(DATA, 'backups'), AUDIT = path.join(DATA, 'audit.log'), AUDIT_DIR = path.join(DATA, 'audit'), SESS_FILE = path.join(DATA, 'sessions.json');
for (const d of [DATA, MONTHS, BACKUPS, AUDIT_DIR]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });

// ---------- 共通 ----------
const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const sessions = new Map(); // SHA-256(token) -> { id, exp, pv }  ※トークン自体は保持・保存しない
const fails = new Map();    // key -> { n, first, until }
const tokHash = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const pvOf = u => String((u && (u.pwChangedAt || u.createdAt)) || '');

const SEC_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
};
if (TLS) SEC_HEADERS['Strict-Transport-Security'] = 'max-age=31536000';

function send(res, code, body, extra) {
  const isStr = typeof body === 'string';
  res.writeHead(code, Object.assign({}, SEC_HEADERS,
    { 'Content-Type': isStr ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8' }, extra || {}));
  res.end(isStr ? body : JSON.stringify(body));
}
const err = (res, code, error, message, extra) => send(res, code, { error, message, shiftapp: true }, extra);

let auditMonth = null; // 現在の audit.log が属する月（YYYY-MM）
const monthOf = d => d.toISOString().slice(0, 7);
try { auditMonth = monthOf(fs.statSync(AUDIT).mtime); } catch (e) { /* none */ }
function rotateAudit(now) {
  let st; try { st = fs.statSync(AUDIT); } catch (e) { auditMonth = monthOf(now); return; }
  const m = auditMonth || monthOf(st.mtime), cur = monthOf(now);
  if (m === cur && st.size < AUDIT_MAX_BYTES) { auditMonth = cur; return; }
  fs.mkdirSync(AUDIT_DIR, { recursive: true, mode: 0o700 });
  let n = 0, dest;
  do { n++; dest = path.join(AUDIT_DIR, `audit-${m}${n > 1 ? '-' + n : ''}.log`); } while (fs.existsSync(dest));
  fs.renameSync(AUDIT, dest); auditMonth = cur;
  fs.appendFileSync(AUDIT, JSON.stringify({ ts: now.toISOString(), event: 'audit_rotate', file: path.basename(dest) }) + '\n', { mode: 0o600 });
}
function purgeAudit() {
  if (!AUDIT_RETENTION_DAYS) return;
  const limit = Date.now() - AUDIT_RETENTION_DAYS * 86400000; let n = 0;
  try {
    for (const f of fs.readdirSync(AUDIT_DIR)) {
      if (!/^audit-.*\.log$/.test(f)) continue;
      const fp = path.join(AUDIT_DIR, f);
      if (fs.statSync(fp).mtimeMs < limit) { fs.unlinkSync(fp); n++; }
    }
  } catch (e) { console.error('audit purge failed', e.message); }
  if (n) audit({ event: 'audit_purge', removed: n, days: AUDIT_RETENTION_DAYS });
}
function audit(ev) {
  // 勤務内容・パスワード・トークンは書かない（誰が・いつ・何を・どの月/部署）
  try {
    const now = new Date();
    try { rotateAudit(now); } catch (e) { console.error('audit rotate failed', e.message); }
    fs.appendFileSync(AUDIT, JSON.stringify(Object.assign({ ts: now.toISOString() }, ev)) + '\n', { mode: 0o600 });
  } catch (e) { console.error('audit write failed', e.message); }
}
function atomicWrite(file, text) {
  const tmp = file + '.' + process.pid + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  fs.renameSync(tmp, file);
}
function parseCookies(h) {
  const o = {};
  String(h || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return o;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const t = Buffer.concat(chunks).toString('utf8');
      if (!t) return resolve({});
      try { resolve(JSON.parse(t)); } catch (e) { reject(Object.assign(new Error('bad json'), { code: 400 })); }
    });
    req.on('error', reject);
  });
}

// ---------- 権限 ----------
function perms(u) {
  const admin = u.role === 'admin', m = u.role === 'manager1' || u.role === 'manager2';
  const g = new Set(u.groups || []);
  return {
    readable: t => admin || u.role === 'manager1' || g.has(t),
    writable: t => admin || (m && g.has(t)),
    canWriteAny: admin || (m && g.size > 0),
  };
}
const publicUser = (id, u) => ({ id, name: u.name, role: u.role, roleLabel: ROLES[u.role], groups: u.role === 'admin' ? ['*'] : (u.groups || []), mustChange: !!u.mustChange });

// ---------- 月データ ----------
const monthFile = ym => path.join(MONTHS, ym + '.json');
function readMonth(ym) {
  try { return JSON.parse(fs.readFileSync(monthFile(ym), 'utf8')); } catch (e) { return null; }
}
const clone = o => JSON.parse(JSON.stringify(o));
const titleOfKey = (k, titles) => titles.filter(t => k.startsWith(t + '/')).sort((a, b) => b.length - a.length)[0];

function filterState(state, P) {
  const s = clone(state);
  const keep = new Map();
  s.sections = (s.sections || []).filter(x => P.readable(x.title));
  s.sections.forEach(x => keep.set(x.id, x));
  s.staff = (s.staff || []).filter(t => keep.has(t.sec));
  const titles = s.sections.map(x => x.title), allTitles = (state.sections || []).map(x => x.title);
  for (const k of ['needs', 'minNeeds']) {
    if (!s[k]) continue;
    for (const key of Object.keys(s[k])) { const t = titleOfKey(key, allTitles); if (!t || !titles.includes(t)) delete s[k][key]; }
  }
  return s;
}

function validateState(st) {
  const bad = m => { throw Object.assign(new Error(m), { code: 400 }); };
  if (!st || typeof st !== 'object' || Array.isArray(st)) bad('state が不正です');
  if (!Array.isArray(st.sections) || !Array.isArray(st.staff)) bad('sections / staff が必要です');
  if (st.sections.length > 100 || st.staff.length > 3000) bad('件数が多すぎます');
  const ids = new Set();
  for (const x of st.sections) {
    if (!x || typeof x.title !== 'string' || !x.title || x.title.length > 100 || x.title.includes('\n')) bad('部署名が不正です');
    if (ids.has(x.id)) bad('部署IDが重複しています'); ids.add(x.id);
  }
  const titles = new Set(st.sections.map(x => x.title));
  if (titles.size !== st.sections.length) bad('部署名が重複しています');
  for (const t of st.staff) if (!t || typeof t !== 'object' || !ids.has(t.sec)) bad('職員の部署が不正です');
  if (!Number.isInteger(st.y) || !Number.isInteger(st.m)) bad('年月が不正です');
}

// 管理者は「書き込める部署の sections / staff / needs」だけを既存データに反映する。
function mergeState(existing, inc, user) {
  const P = perms(user);
  const incSec = inc.sections;
  const staffOf = (st, sec) => st.staff.filter(t => t.sec === sec.id);
  const strip = (st, sec) => JSON.stringify(staffOf(st, sec).map(t => { const c = clone(t); delete c.id; delete c.sec; return c; }));
  const touched = [], ignored = [];
  let out;

  if (user.role === 'admin') {
    out = clone(inc);
    out.sections.forEach(x => touched.push(x.title));
  } else {
    const base = existing ? clone(existing) : null;
    out = base || (() => { const g = clone(inc); g.sections = []; g.staff = []; g.needs = {}; g.minNeeds = {}; return g; })();
    out.needs = out.needs || {}; out.minNeeds = out.minNeeds || {};
    const exTitles = out.sections.map(x => x.title);
    const groups = []; // { title, sec(meta), staff[] }
    for (const sec of out.sections) {
      if (P.writable(sec.title)) {
        const isec = incSec.find(x => x.title === sec.title);
        if (isec) { groups.push({ sec: clone(isec), staff: clone(staffOf(inc, isec)) }); touched.push(sec.title); }
        else groups.push({ sec, staff: staffOf(out, sec) }); // 未送信の自部署は保持（削除不可）
      } else {
        groups.push({ sec, staff: staffOf(out, sec) });
        const isec = incSec.find(x => x.title === sec.title);
        if (isec && strip(inc, isec) !== strip(out, sec)) ignored.push(sec.title);
      }
    }
    for (const isec of incSec) {
      if (exTitles.includes(isec.title)) continue;
      if (P.writable(isec.title)) { groups.push({ sec: clone(isec), staff: clone(staffOf(inc, isec)) }); touched.push(isec.title); }
      else ignored.push(isec.title);
    }
    const finalTitles = groups.map(g => g.sec.title);
    for (const k of ['needs', 'minNeeds']) {
      const merged = {};
      for (const key of Object.keys(out[k] || {})) { const t = titleOfKey(key, finalTitles); if (t && !P.writable(t)) merged[key] = out[k][key]; else if (!t && base) merged[key] = out[k][key]; }
      for (const key of Object.keys(inc[k] || {})) { const t = titleOfKey(key, incSec.map(x => x.title)); if (t && P.writable(t)) merged[key] = inc[k][key]; }
      out[k] = merged;
    }
    out.sections = []; out.staff = [];
    for (const g of groups) { g.sec.id = out.sections.length; out.sections.push(g.sec); for (const t of g.staff) { t.sec = g.sec.id; out.staff.push(t); } }
    out.staff.forEach((t, i) => { t.id = i; });
    return { merged: out, touched, ignored };
  }
  // admin: ID を連番に正規化
  const map = new Map(); out.sections.forEach((x, i) => { map.set(x.id, i); x.id = i; });
  out.staff.forEach((t, i) => { t.sec = map.get(t.sec); t.id = i; });
  return { merged: out, touched, ignored };
}

function backup(ym, version, text) {
  const dir = path.join(BACKUPS, ym);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[-:.]/g, '');
  atomicWrite(path.join(dir, `${ym}_v${String(version).padStart(6, '0')}_${stamp}.json`), text);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  for (const f of files.slice(0, Math.max(0, files.length - BACKUP_KEEP))) { try { fs.unlinkSync(path.join(dir, f)); } catch (e) { /* ignore */ } }
}

// ---------- 認証 ----------
const DUMMY = hashPassword('dummy-password-for-timing');
function ipOf(req) {
  const peer = req.socket.remoteAddress || '?';
  // TRUST_PROXY=1 かつ直接の接続元が許可プロキシのときだけ X-Forwarded-For の先頭を使う（プロキシ側で上書き設定すること）
  if (TRUST_PROXY && TRUST_PROXY_IPS.has(peer)) {
    const first = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (first && net.isIP(first)) return first;
  }
  return peer;
}
// セッション・ロック状態の永続化（data/sessions.json, 0600。トークンはSHA-256のみ）
function persist() {
  try { atomicWrite(SESS_FILE, JSON.stringify({ sessions: Object.fromEntries(sessions), locks: Object.fromEntries(fails) })); }
  catch (e) { console.error('state write failed', e.message); }
}
(function loadState() {
  try {
    const j = JSON.parse(fs.readFileSync(SESS_FILE, 'utf8')), now = Date.now();
    for (const [h, s] of Object.entries(j.sessions || {})) if (s && typeof s.id === 'string' && s.exp > now && /^[0-9a-f]{64}$/.test(h)) sessions.set(h, { id: s.id, exp: s.exp, pv: String(s.pv || '') });
    for (const [k, f] of Object.entries(j.locks || {})) if (f && ((f.until && f.until > now) || (!f.until && now - f.first <= LOCK_WINDOW))) fails.set(k, { n: +f.n || 0, first: +f.first || now, until: +f.until || 0 });
  } catch (e) { /* 初回・破損時は空で開始 */ }
})();
function lockInfo(key) {
  const f = fails.get(key); const now = Date.now();
  if (!f) return 0;
  if (f.until && f.until > now) return f.until - now;
  if (f.until || now - f.first > LOCK_WINDOW) { fails.delete(key); persist(); }
  return 0;
}
function addFail(key, limit) {
  const now = Date.now(); let f = fails.get(key);
  if (!f || now - f.first > LOCK_WINDOW) f = { n: 0, first: now, until: 0 };
  f.n++; if (f.n >= limit) f.until = now + LOCK_WINDOW;
  fails.set(key, f); persist();
}
function auth(req) {
  const tok = parseCookies(req.headers.cookie).sid;
  const th = tok && /^[0-9a-f]{64}$/.test(tok) ? tokHash(tok) : null;
  const s = th && sessions.get(th);
  if (!s) return null;
  if (s.exp < Date.now()) { sessions.delete(th); persist(); return null; }
  const users = loadUsers(), u = Object.prototype.hasOwnProperty.call(users, s.id) ? users[s.id] : null;
  // 無効化・パスワード再発行（CLI）でも失効
  if (!u || u.disabled || s.pv !== pvOf(u)) { sessions.delete(th); persist(); return null; }
  return { id: s.id, user: u, th };
}
function sweep() {
  const now = Date.now(); let ch = false;
  for (const [t, s] of sessions) if (s.exp < now) { sessions.delete(t); ch = true; }
  for (const [k, f] of fails) if ((f.until && f.until < now) || (!f.until && now - f.first > LOCK_WINDOW)) { fails.delete(k); ch = true; }
  if (ch) persist();
}
setInterval(sweep, 60 * 1000).unref();
sweep(); purgeAudit();
setInterval(purgeAudit, 6 * 3600 * 1000).unref();

// ---------- パスワードポリシー ----------
const norm = s => String(s || '').normalize('NFKC').toLowerCase();
async function checkNewPassword(pw, id, u) {
  if (typeof pw !== 'string' || pw.length < PW_MIN) return `パスワードは${PW_MIN}文字以上にしてください`;
  if (pw.length > PW_MAX) return `パスワードは${PW_MAX}文字以内にしてください`;
  const n = norm(pw);
  if (new Set(Array.from(n)).size < 5) return '同じ文字の繰り返しなど、推測されやすいパスワードは使えません';
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(pw.normalize('NFKC'))).length;
  if (classes < 2) return '英大文字・小文字・数字・記号・日本語のうち2種類以上を組み合わせてください';
  if (id.length >= 3 && n.includes(norm(id))) return 'パスワードに職員IDを含めないでください';
  const parts = [String(u.name || '')].concat(String(u.name || '').split(/[\s\u3000]+/));
  for (const p of parts) { const pn = norm(p).replace(/[\s\u3000]/g, ''); if (pn.length >= 2 && n.includes(pn)) return 'パスワードに氏名を含めないでください'; }
  for (const h of [u.hash].concat(u.prevHashes || [])) if (h && await verifyPassword(pw, h)) return '現在または直近のパスワードと同じものは使えません';
  return '';
}

// ---------- ハンドラ ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname, method = req.method, ip = ipOf(req);

  if (method === 'GET' && (p === '/' || p === '/index.html')) {
    let html; try { html = fs.readFileSync(INDEX, 'utf8'); } catch (e) { return err(res, 500, 'no_index', 'index.html がありません'); }
    // 単体HTML内のCSP(meta)は connect-src 'none' のため、配信時のみサーバーのCSPに置換（file:// 利用時の厳格設定は変えない）
    html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, `<meta http-equiv="Content-Security-Policy" content="${SEC_HEADERS['Content-Security-Policy'].replace('; frame-ancestors \'none\'', '')}">`);
    return send(res, 200, html);
  }
  if (p === '/favicon.ico') { res.writeHead(204, SEC_HEADERS); return res.end(); }
  if (!p.startsWith('/api/')) return err(res, 404, 'not_found', '見つかりません');

  if (!['GET', 'POST', 'PUT'].includes(method)) return err(res, 405, 'method', '許可されていないメソッドです');
  if (method !== 'GET') {
    if (req.headers['x-requested-with'] !== 'shiftapp') return err(res, 403, 'csrf', '不正なリクエストです（CSRF対策ヘッダなし）');
    const origin = req.headers.origin;
    if (origin) {
      let oh = '', oo = ''; try { const o = new URL(origin); oh = o.host; oo = o.origin; } catch (e) { /* */ }
      if (oh !== req.headers.host && !PUBLIC_ORIGINS.has(oo)) return err(res, 403, 'csrf', '不正なリクエストです（Origin）');
    }
  }

  if (p === '/api/login' && method === 'POST') {
    const b = await readBody(req);
    const id = typeof b.id === 'string' ? b.id.trim().slice(0, 64) : '', pw = typeof b.password === 'string' ? b.password.slice(0, 200) : '';
    const key = ip + '|' + id.toLowerCase(), ipKey = ip + '|*';
    const wait = Math.max(lockInfo(key), lockInfo(ipKey));
    if (wait) {
      audit({ event: 'login_locked', user: id, ip });
      return err(res, 429, 'locked', 'ログイン失敗が続いたため一時的にロックされています。しばらくしてからやり直してください。', { 'Retry-After': String(Math.ceil(wait / 1000)) });
    }
    const users = loadUsers(), u = Object.prototype.hasOwnProperty.call(users, id) ? users[id] : null;
    const ok = u && !u.disabled ? await verifyPassword(pw, u.hash) : (await verifyPassword(pw, await DUMMY), false);
    if (!ok) {
      addFail(key, LOCK_FAILS); addFail(ipKey, IP_FAILS);
      audit({ event: 'login_fail', user: id, ip });
      return err(res, 401, 'bad_credentials', '職員IDまたはパスワードが違います');
    }
    fails.delete(key);
    const tok = crypto.randomBytes(32).toString('hex');
    sessions.set(tokHash(tok), { id, exp: Date.now() + SESSION_MS, pv: pvOf(u) }); persist();
    audit({ event: 'login_ok', user: id, ip, role: u.role });
    return send(res, 200, publicUser(id, u), {
      'Set-Cookie': `sid=${tok}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_MS / 1000)}${SECURE_COOKIE ? '; Secure' : ''}`,
    });
  }

  const a = auth(req);
  if (!a) return err(res, 401, 'unauthorized', 'ログインが必要です');
  const P = perms(a.user);

  if (a.user.mustChange && p !== '/api/password' && p !== '/api/logout' && p !== '/api/me') {
    return err(res, 403, 'must_change', '初回ログインのため、先にパスワードを変更してください');
  }

  if (p === '/api/password' && method === 'POST') {
    const b = await readBody(req);
    const cur = typeof b.current === 'string' ? b.current.slice(0, 200) : '', nw = typeof b.next === 'string' ? b.next : '';
    const key = ip + '|' + a.id.toLowerCase();
    const wait = lockInfo(key);
    if (wait) { audit({ event: 'password_change_locked', user: a.id, ip }); return err(res, 429, 'locked', '失敗が続いたため一時的にロックされています。しばらくしてからやり直してください。', { 'Retry-After': String(Math.ceil(wait / 1000)) }); }
    if (!(await verifyPassword(cur, a.user.hash))) {
      addFail(key, LOCK_FAILS); audit({ event: 'password_change_fail', user: a.id, ip, reason: 'bad_current' });
      return err(res, 400, 'bad_current', '現在のパスワードが違います');
    }
    const problem = await checkNewPassword(nw, a.id, a.user);
    if (problem) { audit({ event: 'password_change_fail', user: a.id, ip, reason: 'policy' }); return err(res, 400, 'policy', problem); }
    const users = loadUsers(), cu = Object.prototype.hasOwnProperty.call(users, a.id) ? users[a.id] : null;
    if (!cu) return err(res, 401, 'unauthorized', 'ログインが必要です');
    cu.prevHashes = [cu.hash].concat(cu.prevHashes || []).slice(0, 3);
    cu.hash = await hashPassword(nw); cu.mustChange = false; cu.pwChangedAt = new Date().toISOString();
    saveUsers(users);
    for (const [h, s] of sessions) if (s.id === a.id && h !== a.th) sessions.delete(h); // 他の端末のセッションを失効
    const mine = sessions.get(a.th); if (mine) mine.pv = pvOf(cu);
    fails.delete(key); persist();
    audit({ event: 'password_change', user: a.id, ip });
    return send(res, 200, { ok: true });
  }

  if (p === '/api/logout' && method === 'POST') {
    sessions.delete(a.th); persist(); audit({ event: 'logout', user: a.id, ip });
    return send(res, 200, { ok: true }, { 'Set-Cookie': `sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${SECURE_COOKIE ? '; Secure' : ''}` });
  }
  if (p === '/api/me' && method === 'GET') return send(res, 200, publicUser(a.id, a.user));

  if (p === '/api/months' && method === 'GET') {
    const list = [];
    for (const f of fs.readdirSync(MONTHS)) {
      const ym = f.replace(/\.json$/, ''); if (!YM_RE.test(ym) || !f.endsWith('.json')) continue;
      const m = readMonth(ym); if (m && m.state.sections.some(x => P.readable(x.title))) list.push(ym);
    }
    return send(res, 200, { months: list.sort() });
  }

  if (p === '/api/audit' && method === 'GET') {
    if (a.user.role !== 'admin') return err(res, 403, 'forbidden', '権限がありません');
    const n = Math.min(2000, Math.max(1, +url.searchParams.get('n') || 200));
    let lines = []; try { lines = fs.readFileSync(AUDIT, 'utf8').split('\n').filter(Boolean); } catch (e) { /* none */ }
    audit({ event: 'audit_view', user: a.id, ip });
    return send(res, 200, { entries: lines.slice(-n).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean) });
  }

  const mm = p.match(/^\/api\/month\/([^/]+)$/);
  if (mm) {
    const ym = mm[1];
    if (!YM_RE.test(ym)) return err(res, 400, 'bad_ym', '年月の形式が不正です（例 2026-10）');
    if (method === 'GET') {
      const m = readMonth(ym);
      if (!m) return err(res, 404, 'no_month', 'この月のデータはありません');
      const state = filterState(m.state, P);
      if (!state.sections.length) return err(res, 403, 'forbidden', 'この月で閲覧できる部署がありません');
      audit({ event: 'view', user: a.id, ip, ym, groups: state.sections.map(x => x.title) });
      return send(res, 200, { ym, version: m.version, updatedAt: m.updatedAt, writable: state.sections.filter(x => P.writable(x.title)).map(x => x.title), state });
    }
    if (method === 'PUT') {
      if (!P.canWriteAny) { audit({ event: 'save_denied', user: a.id, ip, ym }); return err(res, 403, 'forbidden', '保存する権限がありません（照会のみ）'); }
      const ct = String(req.headers['content-type'] || '');
      if (!ct.includes('application/json')) return err(res, 415, 'content_type', 'Content-Type は application/json にしてください');
      const b = await readBody(req);
      if (!Number.isInteger(b.version) || b.version < 0) return err(res, 400, 'bad_version', 'version が不正です');
      validateState(b.state);
      if (b.state.y * 100 + b.state.m !== +ym.slice(0, 4) * 100 + +ym.slice(5)) return err(res, 400, 'ym_mismatch', 'URLの年月とデータの年月が一致しません');
      const cur = readMonth(ym), curV = cur ? cur.version : 0;
      if (b.version !== curV) {
        audit({ event: 'save_conflict', user: a.id, ip, ym, sent: b.version, current: curV });
        return send(res, 409, { error: 'conflict', message: '他の人が先に保存しました。最新版を取り込んでください。', version: curV, shiftapp: true });
      }
      const { merged, touched, ignored } = mergeState(cur && cur.state, b.state, a.user);
      if (!touched.length) { audit({ event: 'save_denied', user: a.id, ip, ym }); return err(res, 403, 'forbidden', '書き込める部署がありません'); }
      const rec = { version: curV + 1, updatedAt: new Date().toISOString(), updatedBy: a.id, state: merged };
      const text = JSON.stringify(rec);
      atomicWrite(monthFile(ym), text);
      try { backup(ym, rec.version, text); } catch (e) { console.error('backup failed', e.message); }
      audit({ event: 'save', user: a.id, ip, ym, version: rec.version, groups: touched, ignored });
      return send(res, 200, { ok: true, version: rec.version, updatedAt: rec.updatedAt, ignored });
    }
  }
  return err(res, 404, 'not_found', '見つかりません');
}

function onRequest(req, res) {
  handle(req, res).catch(e => {
    if (res.headersSent) return res.end();
    const code = e && e.code === 413 ? 413 : e && e.code === 400 ? 400 : 500;
    if (code === 500) console.error('error', e && e.message);
    err(res, code, code === 413 ? 'too_large' : code === 400 ? 'bad_request' : 'server_error',
      code === 413 ? 'データが大きすぎます' : code === 400 ? (e.message === 'bad json' ? 'JSONが不正です' : e.message) : 'サーバーエラー');
  });
}

const server = TLS
  ? https.createServer({ cert: fs.readFileSync(process.env.TLS_CERT), key: fs.readFileSync(process.env.TLS_KEY) }, onRequest)
  : http.createServer(onRequest);
server.requestTimeout = 30000; server.headersTimeout = 15000; server.keepAliveTimeout = 5000;
server.listen(PORT, HOST, () => {
  console.log(`shiftapp server listening on ${TLS ? 'https' : 'http'}://${HOST}:${server.address().port}  data=${DATA}`);
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && !TLS && !SECURE_COOKIE) console.warn('WARNING: 社内LAN公開時はHTTPS（TLS_CERT/TLS_KEY）を使用してください');
});
