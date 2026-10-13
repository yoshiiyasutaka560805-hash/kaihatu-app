'use strict';

// 定期処理（node-cron）
//   取込（設定 fetch_cron、既定 毎日2:30）：オンライン提供CSV取込 → 期限切れ無効化 → 活動中求職者の新着照合
//   毎日3:15：保存期限切れデータの削除、バックアップ
const cron = require('node-cron');
const { getSettings } = require('../database/db');
const { deactivateExpired } = require('./postingStore');
const provision = require('./sources/hwProvisionService');
const hwApi = require('./sources/hwApi');
const { rematchActiveSeekers } = require('./matching/runner');
const { purgeExpired } = require('./retention');
const { runBackup } = require('./backup');
const { withLock } = require('../utils/lock');
const { runAs } = require('../middleware/context');

let fetchTask = null;

function logApiError(msg) {
  require('../database/db').getDb().prepare(`INSERT INTO fetch_runs (source, finished_at, status, message) VALUES ('hw_api', datetime('now','localtime'), 'error', ?)`).run(msg);
}
let dailyTask = null;

function runFetch() {
  return runAs('system', () => withLock('fetch', async () => {
    const results = {};
    try { results.provision = await provision.run(); } catch (e) { results.provision = { error: e.message }; }
    try { results.hwApi = await hwApi.run(); } catch (e) { results.hwApi = { error: e.message }; logApiError(e.message); }
    results.deactivated = deactivateExpired();
    results.rematch = await rematchActiveSeekers();
    return results;
  }));
}

function runDaily() {
  return runAs('system', async () => {
    const r = {};
    try { r.purged = purgeExpired(); } catch (e) { r.purgeError = e.message; }
    try { r.backup = await runBackup(); } catch (e) { r.backupError = e.message; }
    return r;
  });
}

function validateCron(expr) { return cron.validate(expr); }

function startScheduler() {
  if (fetchTask) fetchTask.stop();
  const expr = getSettings().fetch_cron;
  fetchTask = cron.schedule(validateCron(expr) ? expr : '30 2 * * *', () => {
    runFetch().then(r => console.log('[scheduler] 求人取込', JSON.stringify(r))).catch(e => console.error('[scheduler]', e.message));
  }, { timezone: 'Asia/Tokyo' });
  if (!dailyTask) {
    dailyTask = cron.schedule('15 3 * * *', () => {
      runDaily().then(r => console.log('[scheduler] 日次処理', JSON.stringify(r)));
    }, { timezone: 'Asia/Tokyo' });
  }
}

function stopScheduler() {
  fetchTask?.stop(); dailyTask?.stop();
  fetchTask = null; dailyTask = null;
}

module.exports = { startScheduler, stopScheduler, runFetch, runDaily, validateCron };
