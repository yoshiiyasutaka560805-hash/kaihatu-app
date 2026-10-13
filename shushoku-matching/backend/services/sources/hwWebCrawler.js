'use strict';

// 自動巡回アダプタ（既定：無効）
//
// 【前提ゲート】ハローワークインターネットサービスの利用規約上、機械的な取得が
// 認められるかは未確認。以下の2つの設定が両方 '1' のときのみ稼働する。
//   crawler_enabled         … 巡回を有効化
//   crawler_terms_confirmed … 利用規約・運営元への確認が済んだことの記録
// さらに robots.txt を遵守し、1リクエストごとに crawler_interval_ms（最低3秒）待機する。
//
// ページ構造の解析（parser）はサイト側の仕様に依存するため、規約確認後に
// 実際の画面に合わせて実装する。parser は以下のインタフェースを満たすこと：
//   listUrls(condition, html, baseUrl) → 求人詳細URLの配列
//   searchUrl(condition, baseUrl)      → 検索結果ページURL
//   parseDetail(html, url)             → 求人オブジェクト（postingStore の項目名）

const fetch = require('node-fetch');
const { getDb, getSettings } = require('../../database/db');
const { importRows } = require('../postingStore');

const USER_AGENT = 'RianetJobMatching/1.0 (internal use; contact: admin)';
const MIN_INTERVAL_MS = 3000;
const MAX_PAGES_PER_RUN = 200;

const notImplementedParser = {
  searchUrl() { throw new Error('parser 未実装：規約確認後に対象サイトの画面仕様に合わせて実装してください'); },
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// robots.txt の User-agent: * セクションの Disallow を確認（簡易実装）
async function isAllowedByRobots(url, fetchImpl) {
  const u = new URL(url);
  const res = await fetchImpl(`${u.origin}/robots.txt`, { headers: { 'User-Agent': USER_AGENT } });
  if (res.status === 404) return true;
  if (!res.ok) return false; // 取得できない場合は安全側（不許可）に倒す
  const lines = (await res.text()).split(/\r?\n/);
  let applies = false;
  const disallow = [];
  for (const line of lines) {
    const [k, ...rest] = line.split(':');
    const key = k.trim().toLowerCase();
    const val = rest.join(':').trim();
    if (key === 'user-agent') applies = val === '*';
    else if (applies && key === 'disallow' && val) disallow.push(val);
  }
  return !disallow.some(d => u.pathname.startsWith(d));
}

async function run({ parser = notImplementedParser, fetchImpl = fetch } = {}) {
  const s = getSettings();
  const db = getDb();
  const logSkip = msg => db.prepare(`INSERT INTO fetch_runs (source, finished_at, status, message)
    VALUES ('hw_crawler', datetime('now','localtime'), 'skipped', ?)`).run(msg);

  if (s.crawler_enabled !== '1') { logSkip('自動巡回は無効です'); return { skipped: true }; }
  if (s.crawler_terms_confirmed !== '1') {
    logSkip('利用規約の確認が未記録のため実行しません');
    return { skipped: true };
  }
  if (!s.crawler_base_url) { logSkip('巡回先URLが未設定です'); return { skipped: true }; }

  const interval = Math.max(MIN_INTERVAL_MS, parseInt(s.crawler_interval_ms, 10) || 0);
  const conditions = JSON.parse(s.crawler_conditions || '[]');
  const get = async url => {
    if (!(await isAllowedByRobots(url, fetchImpl))) throw new Error(`robots.txt により不許可: ${url}`);
    await sleep(interval);
    const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 15000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return res.text();
  };

  const rows = [];
  const errors = [];
  let pages = 0;
  for (const cond of conditions) {
    try {
      const listUrl = parser.searchUrl(cond, s.crawler_base_url);
      const urls = parser.listUrls(cond, await get(listUrl), s.crawler_base_url);
      pages++;
      for (const url of urls) {
        if (pages >= MAX_PAGES_PER_RUN) break;
        rows.push({ ...parser.parseDetail(await get(url), url), source_url: url });
        pages++;
      }
    } catch (e) {
      errors.push(e.message);
    }
  }

  if (!rows.length) {
    db.prepare(`INSERT INTO fetch_runs (source, finished_at, status, message)
      VALUES ('hw_crawler', datetime('now','localtime'), 'error', ?)`)
      .run(errors.join('\n') || '取得件数0件');
    return { inserted: 0, updated: 0, errors };
  }
  const r = importRows(rows, 'hw_crawler');
  return { ...r, errors: [...errors, ...r.errors] };
}

module.exports = { run, isAllowedByRobots, MIN_INTERVAL_MS };
