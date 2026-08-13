'use strict';

const cron = require('node-cron');
const { getDb } = require('../database/db');

const THRESHOLDS = [90, 60, 30, 14, 0];

function daysUntil(dateStr) {
  const today = new Date(new Date().toDateString());
  const target = new Date(dateStr);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function checkAll() {
  const db = getDb();
  const workers = db.prepare(`
    SELECT id, name_native, residence_period_to, passport_expiry_date
    FROM foreign_workers
    WHERE is_active = 1 AND employment_status != 'resigned'
  `).all();

  const insert = db.prepare(`
    INSERT OR IGNORE INTO residence_alerts
      (foreign_worker_id, alert_type, source_date, threshold_days, message)
    VALUES (?,?,?,?,?)
  `);

  let created = 0;

  const checkField = (worker, dateValue, alertType, labelJa) => {
    if (!dateValue) return;
    const remaining = daysUntil(dateValue);
    for (const threshold of THRESHOLDS) {
      if (remaining > threshold) continue;
      const message = remaining < 0
        ? `${worker.name_native}さんの${labelJa}が${dateValue}に切れています。至急対応してください。`
        : `${worker.name_native}さんの${labelJa}が残り${remaining}日です（${dateValue}まで）。`;
      const result = insert.run(worker.id, alertType, dateValue, threshold, message);
      if (result.changes > 0) created++;
    }
  };

  for (const worker of workers) {
    checkField(worker, worker.residence_period_to, 'residence_expiry', '在留期限');
    checkField(worker, worker.passport_expiry_date, 'passport_expiry', 'パスポート有効期限');
  }

  return created;
}

function startScheduler() {
  // 毎日午前6時に実行
  cron.schedule('0 6 * * *', () => {
    console.log('[在留期限チェック] 実行中...');
    const created = checkAll();
    console.log(`[在留期限チェック] 完了: ${created}件のアラートを新規作成`);
  });
  console.log('[在留期限チェック] スケジューラーを開始しました（毎日午前6時実行）');
}

module.exports = { checkAll, startScheduler };
