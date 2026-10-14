const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const { DATA_DIR } = require('./crypto');

const db = new DatabaseSync(process.env.DB_PATH || path.join(DATA_DIR, 'app.db'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'staff',
  failed_count INTEGER NOT NULL DEFAULT 0, locked_until TEXT, active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
  device TEXT, ip TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')), revoked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY, at TEXT NOT NULL DEFAULT (datetime('now')), user_id INTEGER,
  action TEXT NOT NULL, target TEXT, detail TEXT, ip TEXT);
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY, surname_enc TEXT NOT NULL, given_enc TEXT NOT NULL,
  surname_initial TEXT NOT NULL, phone_enc TEXT, address_enc TEXT, emergency_enc TEXT, note_enc TEXT,
  wheelchair INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, wheelchair INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 3, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS drivers (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS pickup_patterns (
  id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  kind TEXT NOT NULL CHECK (kind IN ('迎え','送り')), time TEXT NOT NULL,
  default_vehicle_id INTEGER REFERENCES vehicles(id), default_driver_id INTEGER REFERENCES drivers(id),
  note TEXT);
CREATE TABLE IF NOT EXISTS doc_types (
  id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, alert_days TEXT NOT NULL DEFAULT '90,60,30,14,7',
  required INTEGER NOT NULL DEFAULT 1, has_expiry INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  doc_type_id INTEGER NOT NULL REFERENCES doc_types(id), expires_on TEXT, note TEXT,
  file_name TEXT, file_path TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS transport_plans (
  id INTEGER PRIMARY KEY, plan_date TEXT NOT NULL, kind TEXT NOT NULL, vehicle_id INTEGER, driver_id INTEGER,
  result_json TEXT NOT NULL, created_by INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')));
`);

// 既存DBへの列追加（歩行状態・注意事項など）
const have = new Set(db.prepare('PRAGMA table_info(clients)').all().map((c) => c.name));
for (const [col, ddl] of [
  ['wheelchair_type', "TEXT NOT NULL DEFAULT ''"],      // '' | '車椅子' | 'リクライニング車椅子'
  ['gait', "TEXT NOT NULL DEFAULT ''"],                 // 独歩/歩行/杖/シルバーカー/歩行器/手引き/片手引き
  ['tags', "TEXT NOT NULL DEFAULT ''"],                 // カンマ区切りの標準注意タグ
  ['vehicle_hint', "TEXT NOT NULL DEFAULT ''"],         // 車種指定（例: タント / バネット）
  ['escort_enc', 'TEXT'],                               // 入所・退所時の立会者（ヘルパー/夫/息子 等）
  ['attention_enc', 'TEXT'],                            // 注意事項（自由記述）
  ['keybox_enc', 'TEXT'],                               // キーボックス暗証番号（別欄で暗号化）
]) if (!have.has(col)) db.exec(`ALTER TABLE clients ADD COLUMN ${col} ${ddl}`);

const seedTypes = [
  ['契約書', '90,60,30,14,7', 1, 1], ['重要事項説明書', '90,60,30,14,7', 1, 1],
  ['計画書（居宅/施設サービス計画）', '60,30,14,7', 1, 1], ['負担限度額認定証', '90,60,30,14,7', 1, 1],
  ['負担割合証', '90,60,30,14,7', 1, 1], ['診断書', '60,30,14,7', 1, 1],
];
const ins = db.prepare('INSERT OR IGNORE INTO doc_types (name, alert_days, required, has_expiry) VALUES (?,?,?,?)');
for (const t of seedTypes) ins.run(...t);

module.exports = db;
