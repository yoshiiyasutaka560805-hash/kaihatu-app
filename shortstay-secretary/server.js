const express = require('express');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const db = require('./lib/db');
const { encrypt, decrypt, encryptBuffer, decryptBuffer, DATA_DIR } = require('./lib/crypto');
const auth = require('./lib/auth');
const alerts = require('./lib/alerts');
const routing = require('./lib/routing');

const app = express();
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });
app.disable('x-powered-by');
app.set('trust proxy', false);
app.use(express.json({ limit: '2mb' }));

// 施設LAN・VPN・ループバック以外からの接続は拒否（インターネット公開の誤設定対策）
function isAllowedIp(ip) {
  const a = (ip || '').replace(/^::ffff:/, '');
  if (a === '127.0.0.1' || a === '::1') return true;
  const p = a.split('.').map(Number);
  if (p.length !== 4 || p.some(Number.isNaN)) return a.startsWith('fd') || a.startsWith('fe80'); // Tailscale ULA 等
  return p[0] === 10 || (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || (p[0] === 169 && p[1] === 254);
}
app.use((req, res, next) => {
  if (process.env.ALLOW_ANY_IP !== '1' && !isAllowedIp(req.socket.remoteAddress)) return res.status(403).end();
  res.set({
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
  });
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

const api = express.Router();
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error(e); res.status(500).json({ error: '処理に失敗しました' });
});

// ---- セットアップ / 認証 ----
api.get('/setup-needed', (req, res) => res.json({ needed: db.prepare('SELECT COUNT(*) n FROM users').get().n === 0 }));
api.post('/setup', (req, res) => {
  if (db.prepare('SELECT COUNT(*) n FROM users').get().n > 0) return res.status(403).json({ error: '設定済みです' });
  const { username, display_name, password } = req.body || {};
  if (!username || !display_name) return res.status(400).json({ error: '入力が不足しています' });
  try { auth.createUser(username, display_name, password, 'admin'); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
const loginHits = new Map();
api.post('/login', (req, res) => {
  const k = req.ip; const now = Date.now();
  const hits = (loginHits.get(k) || []).filter((t) => now - t < 60000);
  if (hits.length >= 10) return res.status(429).json({ error: '試行回数が多すぎます。1分後に再試行してください' });
  loginHits.set(k, [...hits, now]);
  const r = auth.login(req.body?.username, req.body?.password, req.headers['user-agent'], req.ip);
  if (r.error) return res.status(401).json({ error: r.error });
  res.json(r);
});
api.use(auth.requireAuth);
api.post('/logout', (req, res) => {
  db.prepare('UPDATE sessions SET revoked=1 WHERE token_hash=?').run(req.sessionHash);
  req.audit('logout'); res.json({ ok: true });
});
api.get('/me', (req, res) => res.json(req.user));

// ---- ダッシュボード（AI秘書の朝のブリーフィング） ----
api.get('/dashboard', (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : alerts.todayStr();
  req.audit('view_dashboard', date); res.json(alerts.briefing(date));
});

// ---- 利用者台帳 ----
const clientOut = (c, full = true) => ({
  id: c.id, name: alerts.displayName(c), surname_initial: c.surname_initial, masked_name: alerts.maskedName(c),
  wheelchair: !!c.wheelchair, active: !!c.active,
  ...(full ? { surname: decrypt(c.surname_enc), given: decrypt(c.given_enc), phone: decrypt(c.phone_enc),
    address: decrypt(c.address_enc), emergency: decrypt(c.emergency_enc), note: decrypt(c.note_enc) } : {}),
});
api.get('/clients', (req, res) => {
  req.audit('list_clients');
  res.json(db.prepare('SELECT * FROM clients WHERE active=1 ORDER BY id').all().map((c) => clientOut(c, false)));
});
api.get('/clients/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM clients WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: '見つかりません' });
  req.audit('view_client', String(c.id));
  res.json({
    ...clientOut(c),
    patterns: db.prepare('SELECT * FROM pickup_patterns WHERE client_id=? ORDER BY weekday, time').all(c.id),
    documents: db.prepare(`SELECT d.id, d.expires_on, d.note, d.file_name, t.name type_name, d.doc_type_id
      FROM documents d JOIN doc_types t ON t.id=d.doc_type_id WHERE d.client_id=? ORDER BY t.id`).all(c.id),
  });
});
function saveClient(body, id) {
  const { surname, given, surname_initial, phone, address, emergency, note, wheelchair } = body || {};
  if (!surname || !given) throw new Error('姓と名は必須です');
  const ini = (surname_initial || '').trim().slice(0, 2).toUpperCase();
  if (!/^[A-Z]{1,2}$/.test(ini)) throw new Error('姓のイニシャルは英字1〜2文字で入力してください（例: Y）');
  const vals = [encrypt(surname), encrypt(given), ini, encrypt(phone), encrypt(address), encrypt(emergency), encrypt(note), wheelchair ? 1 : 0];
  if (id) { db.prepare(`UPDATE clients SET surname_enc=?, given_enc=?, surname_initial=?, phone_enc=?, address_enc=?,
      emergency_enc=?, note_enc=?, wheelchair=? WHERE id=?`).run(...vals, id); return Number(id); }
  return Number(db.prepare(`INSERT INTO clients (surname_enc, given_enc, surname_initial, phone_enc, address_enc,
      emergency_enc, note_enc, wheelchair) VALUES (?,?,?,?,?,?,?,?)`).run(...vals).lastInsertRowid);
}
api.post('/clients', (req, res) => {
  try { const id = saveClient(req.body); req.audit('create_client', String(id)); res.json({ id }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
api.put('/clients/:id', (req, res) => {
  try { saveClient(req.body, req.params.id); req.audit('update_client', req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
api.delete('/clients/:id', (req, res) => {
  db.prepare('UPDATE clients SET active=0 WHERE id=?').run(req.params.id); // 論理削除（廃棄は管理者が別途実施）
  req.audit('deactivate_client', req.params.id); res.json({ ok: true });
});

// ---- 車両・運転手 ----
api.get('/vehicles', (req, res) => res.json(db.prepare('SELECT * FROM vehicles WHERE active=1').all()));
api.post('/vehicles', (req, res) => {
  const { name, wheelchair, capacity } = req.body || {};
  if (!name) return res.status(400).json({ error: '車両名は必須です' });
  const id = db.prepare('INSERT INTO vehicles (name, wheelchair, capacity) VALUES (?,?,?)')
    .run(name, wheelchair ? 1 : 0, Math.min(Math.max(+capacity || 3, 1), 8)).lastInsertRowid;
  req.audit('create_vehicle', String(id)); res.json({ id: Number(id) });
});
api.get('/drivers', (req, res) => res.json(db.prepare('SELECT * FROM drivers WHERE active=1').all()));
api.post('/drivers', (req, res) => {
  if (!req.body?.name) return res.status(400).json({ error: '運転手名は必須です' });
  const id = db.prepare('INSERT INTO drivers (name) VALUES (?)').run(req.body.name).lastInsertRowid;
  req.audit('create_driver', String(id)); res.json({ id: Number(id) });
});

// ---- 固定送迎パターン ----
api.post('/clients/:id/patterns', (req, res) => {
  const { weekday, kind, time, default_vehicle_id, default_driver_id, note } = req.body || {};
  if (!(weekday >= 0 && weekday <= 6) || !['迎え', '送り'].includes(kind) || !/^\d{2}:\d{2}$/.test(time || ''))
    return res.status(400).json({ error: '曜日・種別（迎え/送り）・時刻(HH:MM)を確認してください' });
  const id = db.prepare(`INSERT INTO pickup_patterns (client_id, weekday, kind, time, default_vehicle_id, default_driver_id, note)
    VALUES (?,?,?,?,?,?,?)`).run(req.params.id, weekday, kind, time, default_vehicle_id || null, default_driver_id || null, note || null).lastInsertRowid;
  req.audit('create_pattern', String(id)); res.json({ id: Number(id) });
});
api.delete('/patterns/:id', (req, res) => {
  db.prepare('DELETE FROM pickup_patterns WHERE id=?').run(req.params.id);
  req.audit('delete_pattern', req.params.id); res.json({ ok: true });
});

// ---- 送迎ルート案 ----
api.post('/transport/plan', wrap(async (req, res) => {
  const { date, kind, vehicle_id, driver_id, pattern_ids } = req.body || {};
  if (!Array.isArray(pattern_ids) || !pattern_ids.length || !['迎え', '送り'].includes(kind))
    return res.status(400).json({ error: '種別と利用者（送迎パターン）を選択してください' });
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id=?').get(vehicle_id);
  const driver = db.prepare('SELECT * FROM drivers WHERE id=?').get(driver_id);
  const ph = pattern_ids.map(() => '?').join(',');
  const clients = db.prepare(`SELECT c.*, p.time FROM pickup_patterns p JOIN clients c ON c.id=p.client_id
    WHERE p.id IN (${ph}) AND p.kind=? ORDER BY p.time`).all(...pattern_ids, kind);
  if (clients.length !== pattern_ids.length) return res.status(400).json({ error: '選択した種別と一致しない送迎パターンがあります' });
  const result = await routing.planRoute({ kind, vehicle, driver, clients });
  req.audit('plan_route', `${date || ''} ${kind}`, `riders=${clients.length} external_call=${!!process.env.GOOGLE_MAPS_API_KEY}`);
  if (!result.ok) return res.status(400).json(result);
  const { external_payload_preview, ...saved } = result;
  db.prepare('INSERT INTO transport_plans (plan_date, kind, vehicle_id, driver_id, result_json, created_by) VALUES (?,?,?,?,?,?)')
    .run(date || alerts.todayStr(), kind, vehicle.id, driver.id, JSON.stringify(saved), req.user.id);
  res.json(result);
}));

// ---- 書類 ----
api.get('/doc-types', (req, res) => res.json(db.prepare('SELECT * FROM doc_types ORDER BY id').all()));
api.put('/doc-types/:id', auth.requireAdmin, (req, res) => {
  const days = String(req.body?.alert_days || '').split(',').map((s) => parseInt(s, 10)).filter((n) => n > 0 && n <= 365);
  if (!days.length) return res.status(400).json({ error: 'アラート日数は「90,60,30」の形式で入力してください' });
  db.prepare('UPDATE doc_types SET alert_days=? WHERE id=?').run(days.join(','), req.params.id);
  req.audit('update_doc_type', req.params.id, days.join(',')); res.json({ ok: true });
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (r, f, cb) => cb(null, ['application/pdf', 'image/jpeg', 'image/png'].includes(f.mimetype)) });
api.post('/clients/:id/documents', upload.single('file'), (req, res) => {
  const { doc_type_id, expires_on, note } = req.body || {};
  if (!db.prepare('SELECT 1 FROM doc_types WHERE id=?').get(doc_type_id)) return res.status(400).json({ error: '書類種別が不正です' });
  if (expires_on && !/^\d{4}-\d{2}-\d{2}$/.test(expires_on)) return res.status(400).json({ error: '期限は YYYY-MM-DD 形式です' });
  let filePath = null; let fileName = null;
  if (req.file) {
    filePath = `${crypto.randomUUID()}.enc`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filePath), encryptBuffer(req.file.buffer), { mode: 0o600 });
    fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  }
  const existing = db.prepare('SELECT id, file_path FROM documents WHERE client_id=? AND doc_type_id=?').get(req.params.id, doc_type_id);
  let id;
  if (existing) { // 更新（再掲を止める＝新しい期限を登録）
    db.prepare(`UPDATE documents SET expires_on=?, note=?, file_name=COALESCE(?, file_name), file_path=COALESCE(?, file_path),
      updated_at=datetime('now') WHERE id=?`).run(expires_on || null, note || null, fileName, filePath, existing.id);
    if (filePath && existing.file_path) fs.rmSync(path.join(UPLOAD_DIR, existing.file_path), { force: true });
    id = existing.id;
  } else {
    id = Number(db.prepare('INSERT INTO documents (client_id, doc_type_id, expires_on, note, file_name, file_path) VALUES (?,?,?,?,?,?)')
      .run(req.params.id, doc_type_id, expires_on || null, note || null, fileName, filePath).lastInsertRowid);
  }
  req.audit(existing ? 'update_document' : 'create_document', String(id)); res.json({ id });
});
api.get('/documents/:id/file', (req, res) => {
  const d = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
  if (!d || !d.file_path) return res.status(404).json({ error: 'ファイルがありません' });
  req.audit('download_document', String(d.id));
  const buf = decryptBuffer(fs.readFileSync(path.join(UPLOAD_DIR, d.file_path)));
  const ext = path.extname(d.file_name || '').toLowerCase();
  res.set('Content-Type', ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg');
  res.set('Content-Disposition', 'inline'); res.send(buf);
});

// ---- CSV取込（姓,名,姓イニシャル,電話,住所,緊急連絡先,車椅子） ----
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
api.post('/import/clients', (req, res) => {
  const rows = parseCsv(String(req.body?.csv || '').replace(/^﻿/, ''));
  if (rows.length < 2) return res.status(400).json({ error: 'ヘッダ行とデータ行が必要です' });
  const existing = new Set(db.prepare('SELECT surname_enc, given_enc FROM clients').all().map((c) => decrypt(c.surname_enc) + '|' + decrypt(c.given_enc)));
  let created = 0; const skipped = []; const errors = [];
  rows.slice(1).forEach((r, i) => {
    const [surname, given, ini, phone, address, emergency, wc] = r.map((x) => x.trim());
    try {
      if (existing.has(`${surname}|${given}`)) { skipped.push(`${i + 2}行目: 重複のためスキップ`); return; }
      saveClient({ surname, given, surname_initial: ini, phone, address, emergency, wheelchair: ['1', '○', '有', 'はい'].includes(wc) });
      existing.add(`${surname}|${given}`); created++;
    } catch (e) { errors.push(`${i + 2}行目: ${e.message}`); }
  });
  req.audit('import_clients', null, `created=${created} skipped=${skipped.length} errors=${errors.length}`);
  res.json({ created, skipped, errors });
});

// ---- 管理（管理者のみ）: 端末/セッション、操作ログ、バックアップ、ユーザー ----
api.get('/admin/sessions', auth.requireAdmin, (req, res) => res.json(db.prepare(
  `SELECT substr(s.token_hash,1,12) id, u.username, s.device, s.ip, s.created_at, s.last_seen, s.revoked
   FROM sessions s JOIN users u ON u.id=s.user_id ORDER BY s.last_seen DESC LIMIT 100`).all()));
api.post('/admin/sessions/:id/revoke', auth.requireAdmin, (req, res) => {
  const r = db.prepare('UPDATE sessions SET revoked=1 WHERE token_hash LIKE ?').run(req.params.id.replace(/[^0-9a-f]/g, '') + '%');
  req.audit('revoke_session', req.params.id); res.json({ revoked: Number(r.changes) });
});
api.post('/admin/users/:id/revoke-all', auth.requireAdmin, (req, res) => { // 紛失時: 全端末を即時無効化
  const r = db.prepare('UPDATE sessions SET revoked=1 WHERE user_id=?').run(req.params.id);
  req.audit('revoke_all_sessions', req.params.id); res.json({ revoked: Number(r.changes) });
});
api.get('/admin/audit', auth.requireAdmin, (req, res) => res.json(db.prepare(
  `SELECT a.id, a.at, u.username, a.action, a.target, a.detail, a.ip FROM audit_log a LEFT JOIN users u ON u.id=a.user_id
   ORDER BY a.id DESC LIMIT 300`).all()));
api.post('/admin/users', auth.requireAdmin, (req, res) => {
  try {
    const id = auth.createUser(req.body?.username, req.body?.display_name, req.body?.password, req.body?.role === 'admin' ? 'admin' : 'staff');
    req.audit('create_user', String(id)); res.json({ id: Number(id) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
api.post('/admin/backup', auth.requireAdmin, (req, res) => {
  const file = path.join(BACKUP_DIR, `app-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  req.audit('backup', path.basename(file)); res.json({ file: path.basename(file), note: '暗号鍵(data/.key)は別媒体で保管してください' });
});

app.use('/api', api);
app.use((req, res) => res.status(404).end());

if (require.main === module) {
  const port = Number(process.env.PORT || 3100);
  const host = process.env.HOST || '0.0.0.0'; // LAN/VPNからの接続用。ルーターのポート開放は絶対に行わないこと
  app.listen(port, host, () => console.log(`ショートステイAI秘書 起動: http://localhost:${port}`));
}
module.exports = { app, isAllowedIp };
