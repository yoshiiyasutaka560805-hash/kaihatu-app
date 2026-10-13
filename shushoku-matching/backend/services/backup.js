'use strict';

// バックアップ：SQLite オンラインバックアップ → AES-256-GCM で暗号化（BACKUP_PASSWORD）→ 世代管理
// ・暗号化パスワード未設定時は data/backups にのみ平文で保存（外部媒体への出力は暗号化必須）
// ・復元は scripts/restore.js（アプリ停止中に実行）

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDb, getSettings, DB_PATH } = require('../database/db');

const LOCAL_DIR = path.join(path.dirname(DB_PATH === ':memory:' ? path.join(__dirname, '../../data/x') : DB_PATH), 'backups');
const MAGIC = Buffer.from('RNBK1');

function encrypt(buf, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(password, salt, 32);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), enc]);
}

function decrypt(buf, password) {
  if (!buf.subarray(0, 5).equals(MAGIC)) throw new Error('暗号化バックアップの形式ではありません');
  const salt = buf.subarray(5, 21), iv = buf.subarray(21, 33), tag = buf.subarray(33, 49);
  const key = crypto.scryptSync(password, salt, 32);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(buf.subarray(49)), d.final()]);
}

function stamp() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

async function runBackup() {
  const s = getSettings();
  const password = process.env.BACKUP_PASSWORD;
  const targetDir = s.backup_dir || LOCAL_DIR;
  if (s.backup_dir && !password) throw new Error('外部フォルダへのバックアップには環境変数 BACKUP_PASSWORD（暗号化キー）が必要です');
  fs.mkdirSync(targetDir, { recursive: true });
  const tmp = path.join(LOCAL_DIR, `.tmp-${process.pid}.db`);
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
  await getDb().backup(tmp);
  const raw = fs.readFileSync(tmp);
  fs.unlinkSync(tmp);
  const name = password ? `matching-${stamp()}.db.enc` : `matching-${stamp()}.db`;
  fs.writeFileSync(path.join(targetDir, name), password ? encrypt(raw, password) : raw, { mode: 0o600 });
  const keep = Math.max(1, Number(s.backup_keep || 30));
  const files = fs.readdirSync(targetDir).filter(f => /^matching-\d{14}\.db(\.enc)?$/.test(f)).sort();
  for (const f of files.slice(0, Math.max(0, files.length - keep))) fs.unlinkSync(path.join(targetDir, f));
  return { file: path.join(targetDir, name), encrypted: Boolean(password), kept: Math.min(files.length, keep) };
}

function listBackups() {
  const dirs = [...new Set([getSettings().backup_dir || LOCAL_DIR, LOCAL_DIR])];
  const out = [];
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter(x => /^matching-\d{14}\.db(\.enc)?$/.test(x))) {
      out.push({ dir: d, file: f, size: fs.statSync(path.join(d, f)).size });
    }
  }
  return out.sort((a, b) => b.file.localeCompare(a.file));
}

module.exports = { runBackup, listBackups, encrypt, decrypt };
