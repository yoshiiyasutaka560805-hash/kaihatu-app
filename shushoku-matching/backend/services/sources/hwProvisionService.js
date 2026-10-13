'use strict';

// 「ハローワーク求人・求職情報提供サービス」の提供データ取込
//
// 前提：労働局へ利用申請し、承認を受けていること（職業紹介事業者として利用可否・
// 提供条件・二次利用範囲は申請時に要確認）。
// 提供データは CSV で受領する想定。受領ファイルを設定「provision_dir」に置くと、
// 未処理のファイルを取り込む。実際の提供ファイルの項目名が FIELD_ALIASES と異なる
// 場合は postingStore.js の FIELD_ALIASES に項目名を追加すること。

const fs = require('fs');
const path = require('path');
const { getDb, getSettings } = require('../../database/db');
const { csvToObjects } = require('../csv');
const { importRows } = require('../postingStore');

function decode(buf) {
  // 提供データが Shift_JIS の場合に備える（UTF-8 として不正なら Shift_JIS で再デコード）
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('shift_jis').decode(buf);
  }
}

async function run() {
  const s = getSettings();
  const db = getDb();
  if (s.provision_enabled !== '1' || !s.provision_dir) {
    db.prepare(`INSERT INTO fetch_runs (source, finished_at, status, message)
      VALUES ('hw_provision', datetime('now','localtime'), 'skipped', ?)`)
      .run('提供サービス取込は無効です（利用承認後に設定で有効化）');
    return { skipped: true };
  }

  const doneDir = path.join(s.provision_dir, 'imported');
  fs.mkdirSync(doneDir, { recursive: true });
  const files = fs.readdirSync(s.provision_dir).filter(f => f.toLowerCase().endsWith('.csv'));
  const results = [];
  for (const f of files) {
    const full = path.join(s.provision_dir, f);
    const r = importRows(csvToObjects(decode(fs.readFileSync(full))), 'hw_provision');
    fs.renameSync(full, path.join(doneDir, `${Date.now()}_${f}`));
    results.push({ file: f, ...r });
  }
  return { files: results };
}

module.exports = { run };
