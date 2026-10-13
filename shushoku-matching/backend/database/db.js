'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.MATCHING_DB_PATH
  || path.join(__dirname, '../..', 'data', 'matching.db');

let _db = null;

function getDb() {
  if (_db) return _db;

  if (DB_PATH !== ':memory:') fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  return _db;
}

function getSettings() {
  const rows = getDb().prepare('SELECT key, value FROM app_settings').all();
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  return s;
}

function audit(action, target, detail) {
  getDb().prepare('INSERT INTO audit_log (action, target, detail) VALUES (?,?,?)')
    .run(action, target == null ? null : String(target), detail ? JSON.stringify(detail) : null);
}

module.exports = { getDb, getSettings, audit };
