'use strict';

const fetch = require('node-fetch');
const crypto = require('crypto');
const cron = require('node-cron');
const { getDb } = require('../database/db');

async function fetchPageHash(url) {
  try {
    const res = await fetch(url, { timeout: 10000 });
    if (!res.ok) return null;
    const text = await res.text();
    // 本文のみ抽出（<main>または<body>タグの内容をハッシュ化）
    const body = text.replace(/<script[\s\S]*?<\/script>/gi, '')
                     .replace(/<style[\s\S]*?<\/style>/gi, '')
                     .replace(/<[^>]+>/g, '')
                     .replace(/\s+/g, ' ')
                     .trim()
                     .slice(0, 5000); // 先頭5000文字
    return crypto.createHash('md5').update(body).digest('hex');
  } catch {
    return null;
  }
}

async function checkAll() {
  const db = getDb();
  const sources = db.prepare('SELECT * FROM law_update_sources WHERE is_active = 1').all();
  let newAlerts = 0;

  for (const source of sources) {
    let newValue = null;

    if (source.check_method === 'content_hash') {
      newValue = await fetchPageHash(source.source_url);
    }

    if (!newValue) continue;

    if (source.last_known_value && source.last_known_value !== newValue) {
      db.prepare(`
        INSERT INTO law_update_alerts (source_id, old_value, new_value, alert_message)
        VALUES (?,?,?,?)
      `).run(
        source.id,
        source.last_known_value,
        newValue,
        `${source.source_name}のページが更新されました。介護保険関連の改定情報を確認してください。`,
      );
      newAlerts++;
    }

    db.prepare('UPDATE law_update_sources SET last_known_value = ? WHERE id = ?')
      .run(newValue, source.id);
  }

  return newAlerts;
}

function startScheduler() {
  // 毎月1日の深夜0時に実行
  cron.schedule('0 0 1 * *', async () => {
    console.log('[法改正チェック] 実行中...');
    const found = await checkAll();
    console.log(`[法改正チェック] 完了: ${found}件の更新を検知`);
  });
  console.log('[法改正チェック] スケジューラーを開始しました（毎月1日実行）');
}

module.exports = { checkAll, startScheduler };
