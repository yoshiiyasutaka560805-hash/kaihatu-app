'use strict';

process.env.MATCHING_DB_PATH = ':memory:';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { getDb } = require('../database/db');
const { importRows } = require('../services/postingStore');
const { pseudonymizeSeeker } = require('../services/matching/aiAdvisor');
const { runForSeeker } = require('../services/matching/runner');
const crawler = require('../services/sources/hwWebCrawler');

const future = '2099-12-31';

test('CSV相当の取込→upsert→期限切れ無効化', () => {
  const r1 = importRows([
    { 求人番号: 'T-1', 事業所名: 'A', 職種: '介護職', 市区町村: '堺市', 賃金下限: '200,000円', 紹介期限日: future },
    { 求人番号: 'T-2', 事業所名: 'B', 職種: '事務', 市区町村: '堺市', 紹介期限日: '2000-01-01' },
    { 事業所名: '番号なし', 職種: 'x' },
  ], 'manual');
  assert.equal(r1.inserted, 2);
  assert.equal(r1.errors.length, 1);
  assert.equal(r1.deactivated, 1);
  const r2 = importRows([{ 求人番号: 'T-1', 事業所名: 'A2', 職種: '介護職', 紹介期限日: future }], 'manual');
  assert.equal(r2.updated, 1);
  const p = getDb().prepare("SELECT * FROM job_postings WHERE posting_no='T-1'").get();
  assert.equal(p.company_name, 'A2');
});

test('APIキー未設定ならルール判定のみで動作', async () => {
  const db = getDb();
  const id = db.prepare(`INSERT INTO job_seekers (name, city, desired_categories, consent_date, ai_consent)
    VALUES ('テスト', '堺市', '介護', '2026-10-13', 1)`).run().lastInsertRowid;
  const r = await runForSeeker(id);
  assert.equal(r.candidates, 1);
  assert.match(r.aiStatus, /APIキー未設定/);
});

test('仮名化：氏名・連絡先・住所・生年月日を含めない', () => {
  const s = { name: '山田太郎', name_kana: 'ヤマダ', phone: '090-1111-2222', email: 'a@b.jp',
    address: '堺市北区1-2-3', birth_date: '1990-04-01', city: '堺市', licenses: '介護福祉士' };
  const json = JSON.stringify(pseudonymizeSeeker(s));
  for (const v of ['山田', 'ヤマダ', '090-1111-2222', 'a@b.jp', '北区1-2-3', '1990-04-01']) {
    assert.ok(!json.includes(v), `${v} が含まれている`);
  }
  assert.ok(json.includes('30代'));
});

test('自動巡回：既定無効・規約確認未記録なら実行しない', async () => {
  let called = 0;
  const fetchImpl = async () => { called++; return { ok: true, status: 200, text: async () => '' }; };
  assert.deepEqual(await crawler.run({ fetchImpl }), { skipped: true });
  getDb().prepare("UPDATE app_settings SET value='1' WHERE key='crawler_enabled'").run();
  assert.deepEqual(await crawler.run({ fetchImpl }), { skipped: true });
  assert.equal(called, 0);
});

test('自動巡回：robots.txt 遵守とレート制限', async () => {
  const hits = [];
  const server = http.createServer((req, res) => {
    hits.push({ url: req.url, t: Date.now() });
    if (req.url === '/robots.txt') return res.end('User-agent: *\nDisallow: /private\n');
    res.end(`<p>${req.url}</p>`);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const db = getDb();
  const set = (k, v) => db.prepare('UPDATE app_settings SET value=? WHERE key=?').run(v, k);
  set('crawler_enabled', '1'); set('crawler_terms_confirmed', '1'); set('crawler_base_url', base);
  set('crawler_interval_ms', '0'); // 最低 MIN_INTERVAL_MS が適用されること
  set('crawler_conditions', JSON.stringify([{ city: '堺市' }]));

  const parser = {
    searchUrl: (c, b) => `${b}/search`,
    listUrls: (c, html, b) => [`${b}/detail/C-1`, `${b}/private/C-2`],
    parseDetail: (html, url) => ({ 求人番号: url.split('/').pop(), 事業所名: 'X', 職種: '介護', 紹介期限日: future }),
  };
  const r = await crawler.run({ parser });
  server.close();

  assert.equal(r.inserted, 1);
  assert.ok(r.errors.some(e => e.includes('robots.txt')));
  assert.ok(!hits.some(h => h.url.startsWith('/private')));
  const pages = hits.filter(h => h.url !== '/robots.txt');
  assert.ok(pages[1].t - pages[0].t >= crawler.MIN_INTERVAL_MS - 50);
});
