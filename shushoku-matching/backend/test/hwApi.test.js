'use strict';

process.env.MATCHING_DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const hwApi = require('../services/sources/hwApi');
const { getDb, getSettings } = require('../database/db');

test('Web API：トークン取得→ページ取得→項目変換→都道府県で絞込→取込→トークン破棄', async () => {
  const calls = [];
  const server = http.createServer((req, res) => {
    calls.push(`${req.method} ${req.url}`);
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      if (req.url === '/auth') {
        assert.match(body, /id=user1&pass=secret/);
        return res.end('<result><token>TKN123</token></result>');
      }
      if (req.url.startsWith('/data/D01/1')) {
        assert.equal(req.headers.authorization, 'Bearer TKN123');
        return res.end(`<data><kyujin><no>27010-00000001</no><name>堺の特養</name><pref>大阪府</pref><city>堺市北区</city><job>介護職</job><wmin>230000</wmin></kyujin>
          <kyujin><no>13010-00000002</no><name>東京の病院</name><pref>東京都</pref><city>府中市</city><job>看護師</job></kyujin></data>`);
      }
      if (req.url.startsWith('/data/D01/2')) return res.end('<data></data>');
      if (req.url === '/logout') return res.end('<ok/>');
      res.statusCode = 404; res.end();
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.HW_API_ID = 'user1'; process.env.HW_API_PASSWORD = 'secret';
  const settings = { ...getSettings(), hwapi_enabled: '1', hwapi_token_url: `${base}/auth`, hwapi_data_url: `${base}/data/{dataId}/{page}`,
    hwapi_logout_url: `${base}/logout`, hwapi_data_ids: 'D01', hwapi_record_tag: 'kyujin', hwapi_prefectures: '大阪府', hwapi_interval_ms: '1000',
    hwapi_field_map: JSON.stringify({ no: 'posting_no', name: 'company_name', pref: 'prefecture', city: 'city', job: 'job_title', wmin: 'wage_min' }) };
  const r = await hwApi.run({ settings });
  server.close();
  assert.equal(r.fetchedRecords, 2);
  assert.equal(r.targeted, 1);
  assert.equal(r.inserted, 1);
  assert.deepEqual(calls, ['POST /auth', 'GET /data/D01/1', 'GET /data/D01/2', 'POST /logout']);
  const p = getDb().prepare("SELECT * FROM job_postings WHERE posting_no = '27010-00000001'").get();
  assert.equal(p.source, 'hw_api');
  assert.equal(p.wage_min, 230000);
  assert.ok(p.provision_terms.includes('第三者提供'));
});

test('Web API：無効・設定不足・認証情報なしのときは実行しない', async () => {
  assert.equal((await hwApi.run({ settings: { ...getSettings(), hwapi_enabled: '0' } })).skipped, true);
  await assert.rejects(hwApi.run({ settings: { ...getSettings(), hwapi_enabled: '1' } }), /設定が未完了/);
});
