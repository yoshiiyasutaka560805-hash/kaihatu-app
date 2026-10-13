'use strict';

const cron = require('node-cron');
const { getSettings } = require('../database/db');
const { deactivateExpired } = require('./postingStore');
const provision = require('./sources/hwProvisionService');
const crawler = require('./sources/hwWebCrawler');

let task = null;

async function runAll() {
  const results = {};
  try { results.provision = await provision.run(); } catch (e) { results.provision = { error: e.message }; }
  try { results.crawler = await crawler.run(); } catch (e) { results.crawler = { error: e.message }; }
  results.deactivated = deactivateExpired();
  return results;
}

// 夜間1日1回（既定 2:30）。各ソースは設定で無効なら skipped を記録するだけ
function startScheduler() {
  if (task) task.stop();
  const expr = getSettings().crawler_cron || '30 2 * * *';
  if (!cron.validate(expr)) {
    console.warn(`[scheduler] cron式が不正です: ${expr}`);
    return;
  }
  task = cron.schedule(expr, () => {
    runAll().then(r => console.log('[scheduler] 求人取込', JSON.stringify(r)));
  });
}

module.exports = { startScheduler, runAll };
