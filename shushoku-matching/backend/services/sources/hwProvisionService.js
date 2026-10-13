'use strict';

// 「求人情報オンライン提供」（管轄労働局へ利用申請）のCSV取込
// 受領したCSVを設定「provision_dir」に置くと、未処理ファイルを取り込み imported/ へ移動する。
// 列名が既定の対応表と異なる場合は設定「provision_column_map」（{ "CSV列名": "項目名" }）で対応させる。
// 利用規約上、職業紹介以外の目的での利用・第三者提供・インターネット等での公開は禁止（取込データは外部出力しない）

const fs = require('fs');
const path = require('path');
const { getDb, getSettings } = require('../../database/db');
const { csvToObjects } = require('../csv');
const { importRows } = require('../postingStore');
const { decodeText } = require('../../utils/encoding');

const MAX_FILE_BYTES = 200 * 1024 * 1024;

async function run() {
  const s = getSettings();
  const db = getDb();
  if (s.provision_enabled !== '1' || !s.provision_dir) {
    db.prepare(`INSERT INTO fetch_runs (source, finished_at, status, message) VALUES ('hw_provision', datetime('now','localtime'), 'skipped', ?)`)
      .run('オンライン提供の取込は無効です（利用承認後に設定で有効化）');
    return { skipped: true };
  }
  if (!fs.existsSync(s.provision_dir)) throw new Error(`取込フォルダが見つかりません: ${s.provision_dir}`);
  const doneDir = path.join(s.provision_dir, 'imported');
  fs.mkdirSync(doneDir, { recursive: true });
  const files = fs.readdirSync(s.provision_dir).filter(f => f.toLowerCase().endsWith('.csv')).sort();
  const results = [];
  for (const f of files) {
    const full = path.join(s.provision_dir, f);
    try {
      if (fs.statSync(full).size > MAX_FILE_BYTES) throw new Error('ファイルが大きすぎます（200MB超）');
      const r = importRows(csvToObjects(decodeText(fs.readFileSync(full))), 'hw_provision', { sourceFile: f, terms: s.provision_terms });
      fs.renameSync(full, path.join(doneDir, `${Date.now()}_${f}`));
      results.push({ file: f, inserted: r.inserted, updated: r.updated, errors: r.errors.length });
    } catch (e) {
      results.push({ file: f, error: e.message });
    }
  }
  return { files: results };
}

module.exports = { run };
