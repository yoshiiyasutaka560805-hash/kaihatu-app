'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const DEFAULTS = require('./defaults');

const DB_PATH = process.env.MATCHING_DB_PATH
  || path.join(__dirname, '../..', 'data', 'matching.db');

// スキーマ変更は末尾に追加していく（PRAGMA user_version で適用済みを管理）
const MIGRATIONS = [
  db => db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')),
  // v2：初回面接ヒアリングシートの項目
  db => {
    const cols = [
      'contact_method TEXT', 'contact_time TEXT', 'referral_source TEXT', 'sheet_date TEXT',
      'shift_pattern TEXT', 'oncall_ok INTEGER', 'unavailable_times TEXT', 'must_conditions TEXT', 'motivation TEXT',
      'desired_wage_target INTEGER', 'current_wage INTEGER', 'required_benefits TEXT', 'holiday_pref TEXT', 'fixed_day_off TEXT',
      'driver_license TEXT', 'experience_settings TEXT', 'night_experience TEXT', 'nurse_specialty TEXT', 'jft_basic INTEGER',
      'employment_status TEXT', 'resignation_date TEXT', 'job_search_status TEXT', 'offer_deadline TEXT', 'other_agencies INTEGER',
      'interview_availability TEXT', 'current_employer_check INTEGER', 'disclosure_scope TEXT', 'special_considerations TEXT',
    ];
    for (const c of cols) db.exec(`ALTER TABLE job_seekers ADD COLUMN ${c}`);
  },
];

let _db = null;

function migrate(db) {
  const current = db.pragma('user_version', { simple: true });
  if (current === 0) {
    const legacy = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='job_postings'").get();
    if (legacy) {
      throw new Error(`試作版のDBが残っています。${DB_PATH} をバックアップして削除してから起動してください`);
    }
  }
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      MIGRATIONS[v](db);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
  const ins = db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULTS)) ins.run(k, v);
}

function getDb() {
  if (_db) return _db;
  if (DB_PATH !== ':memory:') fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');
  migrate(_db);
  return _db;
}

function getSettings() {
  const s = { ...DEFAULTS };
  for (const r of getDb().prepare('SELECT key, value FROM app_settings').all()) s[r.key] = r.value;
  return s;
}

function setSetting(key, value) {
  getDb().prepare('INSERT INTO app_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}

// 操作者は API リクエストの X-Operator ヘッダから設定される（middleware/context.js）
const { currentOperator } = require('../middleware/context');

function audit(action, target, detail) {
  getDb().prepare('INSERT INTO audit_log (operator, action, target, detail) VALUES (?,?,?,?)')
    .run(currentOperator(), action, target == null ? null : String(target), detail ? JSON.stringify(detail) : null);
}

module.exports = { getDb, getSettings, setSetting, audit, DB_PATH };
