'use strict';

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const DB_PATH   = path.join(__dirname, '../..', 'data', 'kaihatu.db');
const BACKUP_DIR = path.join(__dirname, '../..', 'data', 'backups');

function runBackup() {
  if (!fs.existsSync(DB_PATH)) return;

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const dest = path.join(BACKUP_DIR, `kaihatu-${date}.db`);
  fs.copyFileSync(DB_PATH, dest);

  // 7日以上古いバックアップを削除
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('kaihatu-') && f.endsWith('.db'))
    .sort();
  while (files.length > 7) {
    fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  }
}

function startBackupScheduler() {
  cron.schedule('0 2 * * *', () => {
    runBackup();
    console.log('[バックアップ] 完了');
  });
  console.log('[バックアップ] スケジューラーを開始しました（毎日深夜2時実行）');
}

module.exports = { runBackup, startBackupScheduler };
