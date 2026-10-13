'use strict';

// バックアップからの復元（アプリを停止してから実行）
//   node scripts/restore.js <バックアップファイル>
// 暗号化ファイル（.enc）は環境変数 BACKUP_PASSWORD が必要。現在のDBは matching.db.before-restore-<日時> に退避する

const fs = require('fs');
const path = require('path');
const { decrypt } = require('../services/backup');

const file = process.argv[2];
if (!file) { console.error('使い方: node scripts/restore.js <バックアップファイル>'); process.exit(1); }
const dbPath = process.env.MATCHING_DB_PATH || path.join(__dirname, '../..', 'data', 'matching.db');
let buf = fs.readFileSync(file);
if (file.endsWith('.enc')) {
  if (!process.env.BACKUP_PASSWORD) { console.error('BACKUP_PASSWORD を設定してください'); process.exit(1); }
  buf = decrypt(buf, process.env.BACKUP_PASSWORD);
}
if (!buf.subarray(0, 15).toString().startsWith('SQLite format 3')) { console.error('SQLite のデータではありません'); process.exit(1); }
if (fs.existsSync(dbPath)) {
  const bak = `${dbPath}.before-restore-${Date.now()}`;
  fs.renameSync(dbPath, bak);
  for (const ext of ['-wal', '-shm']) if (fs.existsSync(dbPath + ext)) fs.renameSync(dbPath + ext, bak + ext);
  console.log(`現在のDBを退避しました: ${bak}`);
}
fs.writeFileSync(dbPath, buf, { mode: 0o600 });
console.log(`復元しました: ${dbPath}`);
