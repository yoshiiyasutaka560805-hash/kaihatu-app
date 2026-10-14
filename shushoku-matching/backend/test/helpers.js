'use strict';

// テスト共通：インメモリDB・APIクライアント
process.env.MATCHING_DB_PATH = ':memory:';
process.env.TZ = process.env.TZ || 'Asia/Tokyo';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;
delete process.env.RIANET_ANTHROPIC_API_KEY;
delete process.env.BACKUP_PASSWORD;

const http = require('node:http');
const { createApp } = require('../server');

let server, base, cookie = '';
async function start() {
  if (server) return base;
  server = http.createServer(createApp());
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  const h = { 'X-Rianet-App': '1', 'Content-Type': 'application/json' };
  let r = await fetch(`${base}/api/auth/setup`, { method: 'POST', headers: h, body: JSON.stringify({ password: 'test-password' }) });
  if (r.status === 409) r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: h, body: JSON.stringify({ password: 'test-password' }) });
  cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  return base;
}
function stop() { server?.close(); server = null; }

async function api(method, path, body, headers = {}) {
  await start();
  const res = await fetch(base + path, {
    method,
    headers: { Cookie: cookie, 'X-Rianet-App': '1', 'X-Operator': encodeURIComponent('テスト担当'), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json, headers: res.headers };
}

module.exports = { api, start, stop, getBase: () => base };
