'use strict';
// 単独実行: node shift-app/server/tests/server.test.js  （一時DATA_DIR・空きポート・架空データのみ）
const { spawn, spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftapp-test-'));
let pass = 0, failN = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('PASS', name); } catch (e) { failN++; console.log('FAIL', name, '\n  ', e.message); } };

function freePort() { return new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); }); }
function adduserIn(dir, a, expect = 0) { const r = spawnSync(process.execPath, [path.join(ROOT, 'adduser.js'), ...a], { env: { ...process.env, DATA_DIR: dir }, encoding: 'utf8' }); assert.strictEqual(r.status, expect, r.stderr + r.stdout); return r.stdout + (expect ? r.stderr : ''); }
// 既存テストは初回パスワード変更を要求しない（--no-change-required）。mustChange は別テストで検証
function adduser(...a) { return adduserIn(DATA, [...a, '--no-change-required']); }

const PW = 'Test-Pass-12345';
let base, child;
async function api(method, url, { body, cookie, headers, noCsrf, base: b0 } = {}) {
  const h = { ...(headers || {}) };
  if (method !== 'GET' && !noCsrf) h['X-Requested-With'] = 'shiftapp';
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (cookie) h.Cookie = cookie;
  const r = await fetch((b0 || base) + url, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  let j = null; try { j = await r.json(); } catch (e) { /* html */ }
  return { status: r.status, json: j, headers: r.headers };
}
async function login(id, pw = PW, o = {}) {
  const r = await api('POST', '/api/login', { body: { id, password: pw }, ...o });
  const sc = r.headers.get('set-cookie');
  return { r, cookie: sc ? sc.split(';')[0] : null };
}

// 架空データ：3部署（2階 / 3階 / 相談）
function mkState(marker) {
  const D = 31, cells = (v) => Array(D).fill(v);
  const mk = (id, sec, name, v) => ({ id, sec, label: 'AB', koyo: '常', name, cells: cells(v), memo: marker });
  return {
    y: 2026, m: 10, D, holidays: [12], maxConsec: 5,
    sections: [{ id: 0, title: '2階', D, auto: true }, { id: 1, title: '3階', D, auto: true }, { id: 2, title: '相談', D, auto: false }],
    staff: [mk(0, 0, '架空一郎', '日'), mk(1, 0, '架空二郎', '早'), mk(2, 1, '架空三郎', '遅'), mk(3, 1, '架空四郎', '夜'), mk(4, 2, '架空五郎', '公')],
    needs: { '2階/AB': { '早': { wk: 1, we: 1 } }, '3階/AB': { '早': { wk: 2, we: 2 } }, '相談/*': { '日': { wk: 1, we: 1 } } },
    minNeeds: { '2階/AB': {}, '3階/AB': {}, '相談/*': {} },
  };
}
const names = st => st.staff.map(t => t.name);
async function startServer(dir, env = {}) {
  const port = await freePort();
  const c = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; c.stdout.on('data', d => { out += d; }); c.stderr.on('data', d => { out += d; });
  await new Promise((res, rej) => { c.stdout.on('data', d => /listening/.test(d) && res()); c.on('exit', code => rej(new Error('server exited ' + code + out))); setTimeout(() => rej(new Error('start timeout')), 10000); });
  const stop = () => new Promise(r => { c.on('exit', r); c.kill(); });
  return { child: c, base: `http://127.0.0.1:${port}`, stop, out: () => out };
}
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'shiftapp-test2-'));

(async () => {
  adduser('sys01', 'システム管理者A', 'admin', '*', PW);
  adduser('m1a', '管理者一A', 'manager1', '2階', PW);
  adduser('m2a', '管理者二A', 'manager2', '3階', PW);
  adduser('st01', '一般A', 'staff', '2階', PW);
  const gen = adduser('gen01', '自動生成A', 'staff', '2階');
  const genPw = (gen.match(/一度だけ表示）: (\S+)/) || [])[1];
  const port = await freePort(); base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: DATA, BACKUP_KEEP: '30' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res, rej) => { child.stdout.on('data', d => /listening/.test(d) && res()); child.on('exit', c => rej(new Error('server exited ' + c))); setTimeout(() => rej(new Error('start timeout')), 10000); });

  await test('静的配信とセキュリティヘッダ', async () => {
    const r = await fetch(base + '/');
    assert.strictEqual(r.status, 200);
    const csp = r.headers.get('content-security-policy');
    assert.ok(csp.includes("default-src 'none'") && csp.includes("connect-src 'self'"));
    assert.strictEqual(r.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(r.headers.get('referrer-policy'), 'no-referrer');
    assert.strictEqual(r.headers.get('cache-control'), 'no-store');
    const html = await r.text(); assert.ok(html.includes('<html'));
    assert.ok(!html.includes("connect-src 'none'") && html.includes("connect-src 'self'"), 'meta CSP をサーバー用に置換');
    assert.strictEqual((await fetch(base + '/..%2fserver.js')).status, 404);
    assert.strictEqual((await fetch(base + '/server.js')).status, 404);
    assert.strictEqual((await api('GET', '/api/month/..%2f..%2fusers')).status, 401);
  });

  await test('未ログインは401', async () => { assert.strictEqual((await api('GET', '/api/me')).status, 401); assert.strictEqual((await api('GET', '/api/months')).status, 401); });

  await test('ログイン成功（Cookie属性）と /api/me', async () => {
    const { r, cookie } = await login('sys01');
    assert.strictEqual(r.status, 200);
    const sc = r.headers.get('set-cookie');
    assert.ok(/HttpOnly/i.test(sc) && /SameSite=Strict/i.test(sc) && !/Secure/i.test(sc));
    assert.ok(/sid=[0-9a-f]{64}/.test(sc));
    const me = await api('GET', '/api/me', { cookie });
    assert.strictEqual(me.json.role, 'admin'); assert.strictEqual(me.json.id, 'sys01');
    assert.ok(!JSON.stringify(me.json).includes('hash'));
  });

  await test('ランダム生成パスワードでログインできる', async () => { assert.ok(genPw && genPw.length >= 16); assert.strictEqual((await login('gen01', genPw)).r.status, 200); });

  await test('ログイン失敗と5回でロックアウト（正しいPWでもロック）', async () => {
    assert.strictEqual((await login('st01', 'wrong-password-1')).r.status, 401);
    for (let i = 0; i < 3; i++) assert.strictEqual((await login('st01', 'wrong-password-x')).r.status, 401);
    assert.strictEqual((await login('st01', 'wrong-password-5')).r.status, 401);
    const locked = await login('st01', PW);
    assert.strictEqual(locked.r.status, 429); assert.ok(locked.r.headers.get('retry-after'));
    assert.strictEqual((await login('m1a')).r.status, 200, '他IDには影響しない');
    assert.strictEqual((await login('nobody', 'whatever-pass-1')).r.status, 401);
  });
  adduser('st02', '一般B', 'staff', '3階', PW); // ロック済みst01の代わり
  adduser('m2b', '管理者二B', 'manager2', '2階', PW);

  const sys = (await login('sys01')).cookie, m1 = (await login('m1a')).cookie, m2 = (await login('m2a')).cookie, m2b = (await login('m2b')).cookie, st = (await login('st02')).cookie;
  const MARK = 'SECRETMEMO-ZZZ';
  let ver = 0;

  await test('CSRFヘッダ無しの変更系は拒否', async () => {
    assert.strictEqual((await api('POST', '/api/login', { body: { id: 'sys01', password: PW }, noCsrf: true })).status, 403);
    assert.strictEqual((await api('PUT', '/api/month/2026-10', { cookie: sys, body: { version: 0, state: mkState(MARK) }, noCsrf: true })).status, 403);
    assert.strictEqual((await api('POST', '/api/logout', { cookie: sys, noCsrf: true })).status, 403);
    assert.strictEqual((await api('POST', '/api/login', { body: { id: 'sys01', password: PW }, headers: { Origin: 'http://evil.example' } })).status, 403);
  });

  await test('不正JSON=400、年月不一致=400、巨大=413', async () => {
    assert.strictEqual((await api('PUT', '/api/month/2026-10', { cookie: sys, body: '{bad' })).status, 400);
    assert.strictEqual((await api('PUT', '/api/month/2026-13', { cookie: sys, body: { version: 0, state: mkState('') } })).status, 400);
    assert.strictEqual((await api('PUT', '/api/month/2026-11', { cookie: sys, body: { version: 0, state: mkState('') } })).status, 400);
    assert.strictEqual((await api('PUT', '/api/month/2026-10', { cookie: sys, body: { version: 0, state: { y: 2026, m: 10 } } })).status, 400);
    const big = JSON.stringify({ version: 0, state: mkState('x'.repeat(6 * 1024 * 1024)) });
    let s = 0; try { s = (await api('PUT', '/api/month/2026-10', { cookie: sys, body: big })).status; } catch (e) { s = 413; }
    assert.strictEqual(s, 413);
  });

  await test('一般職員は保存403', async () => {
    const r = await api('PUT', '/api/month/2026-10', { cookie: st, body: { version: 0, state: mkState(MARK) } });
    assert.strictEqual(r.status, 403);
  });

  await test('システム管理者が新規作成（version 0→1）', async () => {
    const r = await api('PUT', '/api/month/2026-10', { cookie: sys, body: { version: 0, state: mkState(MARK) } });
    assert.strictEqual(r.status, 200); assert.strictEqual(r.json.version, 1); ver = 1;
    const g = await api('GET', '/api/month/2026-10', { cookie: sys });
    assert.strictEqual(g.json.state.sections.length, 3); assert.strictEqual(g.json.state.staff.length, 5);
  });

  await test('閲覧フィルタ：管理者(Ⅰ)は全部署、管理者(Ⅱ)・一般は自グループのみ（needsも除外）', async () => {
    const a = (await api('GET', '/api/month/2026-10', { cookie: m1 })).json;
    assert.strictEqual(a.state.sections.length, 3);
    assert.deepStrictEqual(a.writable, ['2階']);
    const b = (await api('GET', '/api/month/2026-10', { cookie: m2 })).json;
    assert.deepStrictEqual(b.state.sections.map(x => x.title), ['3階']);
    assert.deepStrictEqual(names(b.state), ['架空三郎', '架空四郎']);
    assert.deepStrictEqual(Object.keys(b.state.needs), ['3階/AB']);
    const c = (await api('GET', '/api/month/2026-10', { cookie: st })).json;
    assert.deepStrictEqual(c.state.sections.map(x => x.title), ['3階']);
    assert.ok(!JSON.stringify(c).includes('架空一郎') && !JSON.stringify(c).includes('2階'));
    assert.deepStrictEqual((await api('GET', '/api/months', { cookie: st })).json.months, ['2026-10']);
  });

  await test('管理者(Ⅱ)は自部署のみ更新でき、他部署の変更は反映されない', async () => {
    const g = (await api('GET', '/api/month/2026-10', { cookie: m2 })).json;
    const s = g.state; s.staff[0].cells[0] = '休'; s.staff[0].name = '架空三郎(改)';
    // 越権：他部署のデータを混ぜて送る
    s.sections.push({ id: 7, title: '2階', D: 31, auto: true });
    s.staff.push({ id: 9, sec: 7, label: 'X', koyo: '常', name: '改ざん者', cells: Array(31).fill('休') });
    s.needs['2階/AB'] = { '早': { wk: 99, we: 99 } };
    const r = await api('PUT', '/api/month/2026-10', { cookie: m2, body: { version: g.version, state: s } });
    assert.strictEqual(r.status, 200); assert.deepStrictEqual(r.json.ignored, ['2階']); ver = r.json.version;
    const all = (await api('GET', '/api/month/2026-10', { cookie: sys })).json.state;
    assert.deepStrictEqual(names(all), ['架空一郎', '架空二郎', '架空三郎(改)', '架空四郎', '架空五郎']);
    assert.strictEqual(all.staff[2].cells[0], '休');
    assert.strictEqual(all.needs['2階/AB']['早'].wk, 1);
    assert.deepStrictEqual(all.staff.map(t => t.id), [0, 1, 2, 3, 4]);
    assert.strictEqual(all.sections.find(x => x.id === all.staff[0].sec).title, '2階');
    assert.strictEqual(all.sections.find(x => x.id === all.staff[4].sec).title, '相談');
  });

  await test('管理者(Ⅰ)は自部署のみ更新、他部署の改変は無視', async () => {
    const g = (await api('GET', '/api/month/2026-10', { cookie: m1 })).json;
    const s = g.state;
    s.staff.find(t => t.name === '架空一郎').cells[1] = '有休';
    s.staff.find(t => t.name === '架空四郎').cells[1] = '有休';
    s.staff.find(t => t.name === '架空五郎').name = '改ざん五郎';
    const r = await api('PUT', '/api/month/2026-10', { cookie: m1, body: { version: g.version, state: s } });
    assert.strictEqual(r.status, 200); assert.deepStrictEqual(r.json.ignored.sort(), ['3階', '相談']); ver = r.json.version;
    const all = (await api('GET', '/api/month/2026-10', { cookie: sys })).json.state;
    assert.strictEqual(all.staff.find(t => t.name === '架空一郎').cells[1], '有休');
    assert.strictEqual(all.staff.find(t => t.name === '架空四郎').cells[1], '夜');
    assert.ok(!names(all).includes('改ざん五郎'));
  });

  await test('楽観ロック：古いversionは409と最新version', async () => {
    const g = (await api('GET', '/api/month/2026-10', { cookie: m2b })).json;
    const r1 = await api('PUT', '/api/month/2026-10', { cookie: m2b, body: { version: g.version, state: g.state } });
    assert.strictEqual(r1.status, 200); assert.strictEqual(r1.json.version, g.version + 1);
    const r2 = await api('PUT', '/api/month/2026-10', { cookie: m2b, body: { version: g.version, state: g.state } });
    assert.strictEqual(r2.status, 409); assert.strictEqual(r2.json.version, g.version + 1); ver = g.version + 1;
  });

  await test('管理者が他部署のみのデータを送っても書き込めない(403)', async () => {
    const g = (await api('GET', '/api/month/2026-10', { cookie: sys })).json;
    const s = g.state; s.sections = s.sections.filter(x => x.title === '3階'); s.staff = s.staff.filter(t => t.sec === s.sections[0].id);
    const r = await api('PUT', '/api/month/2026-10', { cookie: m2b, body: { version: g.version, state: s } });
    assert.strictEqual(r.status, 403);
  });

  await test('バックアップ世代（30件で打ち止め）', async () => {
    const dir = path.join(DATA, 'backups', '2026-10');
    assert.ok(fs.readdirSync(dir).length >= 4);
    for (let i = 0; i < 34; i++) {
      const g = (await api('GET', '/api/month/2026-10', { cookie: sys })).json;
      const r = await api('PUT', '/api/month/2026-10', { cookie: sys, body: { version: g.version, state: g.state } });
      assert.strictEqual(r.status, 200);
    }
    const files = fs.readdirSync(dir).sort();
    assert.strictEqual(files.length, 30);
    const cur = JSON.parse(fs.readFileSync(path.join(DATA, 'months', '2026-10.json'), 'utf8')).version;
    assert.ok(files[files.length - 1].includes('_v' + String(cur).padStart(6, '0')));
    assert.ok(!files.some(f => f.includes('_v000001_')), '古い世代は削除');
  });

  await test('別の月（2026-11）を管理者(Ⅰ)が新規作成すると自グループのみ', async () => {
    const s = mkState(MARK); s.m = 11;
    const r = await api('PUT', '/api/month/2026-11', { cookie: m1, body: { version: 0, state: s } });
    assert.strictEqual(r.status, 200);
    const all = (await api('GET', '/api/month/2026-11', { cookie: sys })).json.state;
    assert.deepStrictEqual(all.sections.map(x => x.title), ['2階']);
    assert.deepStrictEqual((await api('GET', '/api/months', { cookie: m2 })).json.months, ['2026-10']);
    assert.strictEqual((await api('GET', '/api/month/2026-11', { cookie: m2 })).status, 403);
  });

  await test('/api/audit はシステム管理者のみ', async () => {
    assert.strictEqual((await api('GET', '/api/audit', { cookie: m1 })).status, 403);
    assert.strictEqual((await api('GET', '/api/audit', { cookie: st })).status, 403);
    const r = await api('GET', '/api/audit?n=5', { cookie: sys });
    assert.strictEqual(r.status, 200); assert.ok(r.json.entries.length <= 5 && r.json.entries.length > 0);
  });

  await test('監査ログに勤務内容・氏名・パスワード・トークンが含まれない', async () => {
    const log = fs.readFileSync(path.join(DATA, 'audit.log'), 'utf8');
    const lines = log.trim().split('\n').map(l => JSON.parse(l));
    const evs = new Set(lines.map(l => l.event));
    for (const e of ['login_ok', 'login_fail', 'login_locked', 'view', 'save', 'save_conflict', 'save_denied']) assert.ok(evs.has(e), 'event ' + e);
    for (const bad of [MARK, '架空', '改ざん', PW, genPw, 'wrong-password', 'password', '"cells"']) assert.ok(!log.includes(bad), '含まれてはいけない: ' + bad);
    for (const c of [sys, m1, m2, st]) assert.ok(!log.includes(c.split('=')[1]), 'token');
    const sv = lines.find(l => l.event === 'save'); assert.ok(sv.user && sv.ts && sv.ym && sv.groups && sv.version);
    assert.ok(!fs.readFileSync(path.join(DATA, 'users.json'), 'utf8').includes(PW));
  });

  await test('ログアウト後はセッション無効', async () => {
    const { cookie } = await login('m2a');
    assert.strictEqual((await api('POST', '/api/logout', { cookie })).status, 200);
    assert.strictEqual((await api('GET', '/api/me', { cookie })).status, 401);
  });


  // ===================== 運用機能（セッション永続化・プロキシ・PW変更・ログ・CSV） =====================
  const D2 = tmpDir();
  adduserIn(D2, ['u1', '利用者A', 'staff', '2階', PW, '--no-change-required']);
  adduserIn(D2, ['u2', '利用者B', 'staff', '2階', PW, '--no-change-required']);
  let s2 = await startServer(D2);

  await test('セッション永続化：再起動後も有効、sessions.json はハッシュのみ・0600', async () => {
    const { cookie } = await login('u1', PW, { base: s2.base });
    assert.strictEqual((await api('GET', '/api/me', { cookie, base: s2.base })).status, 200);
    const f = path.join(D2, 'sessions.json');
    const txt = fs.readFileSync(f, 'utf8'); const tok = cookie.split('=')[1];
    assert.ok(!txt.includes(tok), 'トークン平文を保存しない');
    assert.ok(txt.includes(require('crypto').createHash('sha256').update(tok).digest('hex')));
    assert.strictEqual(fs.statSync(f).mode & 0o777, 0o600);
    await s2.stop(); s2 = await startServer(D2);
    assert.strictEqual((await api('GET', '/api/me', { cookie, base: s2.base })).status, 200, '再起動後も有効');
    assert.strictEqual((await api('POST', '/api/logout', { cookie, base: s2.base })).status, 200);
    await s2.stop(); s2 = await startServer(D2);
    assert.strictEqual((await api('GET', '/api/me', { cookie, base: s2.base })).status, 401, 'ログアウト後は再起動しても無効');
  });

  await test('セッション永続化：期限切れは再起動時に破棄、破損ファイルでも起動', async () => {
    await s2.stop();
    const f = path.join(D2, 'sessions.json');
    fs.writeFileSync(f, JSON.stringify({ sessions: { ['a'.repeat(64)]: { id: 'u1', exp: Date.now() - 1000, pv: '' } }, locks: {} }), { mode: 0o600 });
    s2 = await startServer(D2);
    await login('u1', PW, { base: s2.base }); // 書き込みを発生させる
    assert.ok(!fs.readFileSync(f, 'utf8').includes('a'.repeat(64)));
    await s2.stop(); fs.writeFileSync(f, '{broken');
    s2 = await startServer(D2);
    assert.strictEqual((await login('u1', PW, { base: s2.base })).r.status, 200);
  });

  await test('ロック状態も再起動で解除されない', async () => {
    for (let i = 0; i < 5; i++) await login('u2', 'wrong-password-zz', { base: s2.base });
    assert.strictEqual((await login('u2', PW, { base: s2.base })).r.status, 429);
    await s2.stop(); s2 = await startServer(D2);
    assert.strictEqual((await login('u2', PW, { base: s2.base })).r.status, 429, '再起動後もロック');
  });

  await test('CLIでのパスワード再発行・無効化で既存セッションが失効', async () => {
    adduserIn(D2, ['u3', '利用者C', 'staff', '2階', PW, '--no-change-required']);
    const { cookie } = await login('u3', PW, { base: s2.base });
    assert.strictEqual((await api('GET', '/api/me', { cookie, base: s2.base })).status, 200);
    adduserIn(D2, ['--passwd', 'u3', 'Another-Pass-9876', '--no-change-required']);
    assert.strictEqual((await api('GET', '/api/me', { cookie, base: s2.base })).status, 401);
    const c2 = (await login('u3', 'Another-Pass-9876', { base: s2.base })).cookie;
    adduserIn(D2, ['--disable', 'u3']);
    assert.strictEqual((await api('GET', '/api/me', { cookie: c2, base: s2.base })).status, 401);
  });
  await s2.stop();

  await test('TRUST_PROXY：既定は X-Forwarded-For を無視（ロックはプロキシ=接続元単位）', async () => {
    const D = tmpDir(); adduserIn(D, ['p1', '利用者', 'staff', '2階', PW, '--no-change-required']);
    const s = await startServer(D);
    try {
      for (let i = 0; i < 5; i++) await login('p1', 'wrong-password-zz', { base: s.base, headers: { 'X-Forwarded-For': '10.0.0.' + (i + 1) } });
      const r = await login('p1', PW, { base: s.base, headers: { 'X-Forwarded-For': '10.9.9.9' } });
      assert.strictEqual(r.r.status, 429, 'XFFを変えてもロックされたまま');
      const log = fs.readFileSync(path.join(D, 'audit.log'), 'utf8');
      assert.ok(!log.includes('10.0.0.') && !log.includes('10.9.9.9'), 'XFFは記録されない');
    } finally { await s.stop(); }
  });

  await test('TRUST_PROXY=1：XFF先頭をクライアントIPとして使う（IP別ロック・監査ログ）', async () => {
    const D = tmpDir(); adduserIn(D, ['p1', '利用者', 'staff', '2階', PW, '--no-change-required']);
    const s = await startServer(D, { TRUST_PROXY: '1' });
    try {
      const h1 = { 'X-Forwarded-For': '10.1.1.1, 192.168.0.1' }, h2 = { 'X-Forwarded-For': '10.2.2.2' };
      for (let i = 0; i < 5; i++) await login('p1', 'wrong-password-zz', { base: s.base, headers: h1 });
      assert.strictEqual((await login('p1', PW, { base: s.base, headers: h1 })).r.status, 429);
      assert.strictEqual((await login('p1', PW, { base: s.base, headers: h2 })).r.status, 200, '別IPは影響なし');
      const log = fs.readFileSync(path.join(D, 'audit.log'), 'utf8');
      assert.ok(log.includes('"ip":"10.1.1.1"') && log.includes('"ip":"10.2.2.2"'));
      // 不正な値は無視して接続元IPにフォールバック
      const bad = await login('p1', PW, { base: s.base, headers: { 'X-Forwarded-For': '<script>' } });
      assert.strictEqual(bad.r.status, 200);
      assert.ok(!fs.readFileSync(path.join(D, 'audit.log'), 'utf8').includes('<script>'));
    } finally { await s.stop(); }
  });

  await test('PUBLIC_ORIGIN：指定Originのみ追加許可（未設定・他Originは403）', async () => {
    const D = tmpDir(); adduserIn(D, ['p1', '利用者', 'staff', '2階', PW, '--no-change-required']);
    const s = await startServer(D);
    const s3 = await startServer(D, { PUBLIC_ORIGIN: 'https://shift.example.local' });
    try {
      const o = { Origin: 'https://shift.example.local' };
      assert.strictEqual((await login('p1', PW, { base: s.base, headers: o })).r.status, 403, '未設定なら拒否');
      assert.strictEqual((await login('p1', PW, { base: s3.base, headers: o })).r.status, 200);
      assert.strictEqual((await login('p1', PW, { base: s3.base, headers: { Origin: 'https://evil.example' } })).r.status, 403);
      assert.strictEqual((await login('p1', PW, { base: s3.base, headers: { Origin: 'http://shift.example.local' } })).r.status, 403, 'スキーム違いは拒否');
    } finally { await s.stop(); await s3.stop(); }
  });

  await test('mustChange：初期パスワードのままでは他APIが403、変更後に利用可能', async () => {
    const D = tmpDir();
    const out = adduserIn(D, ['mc1', '変更太郎', 'staff', '2階']); // 既定で変更必須
    const init = (out.match(/一度だけ表示）: (\S+)/) || [])[1];
    assert.ok(/要PW変更|変更が必須/.test(out) || out.includes('変更が必須'));
    assert.ok(adduserIn(D, ['--list']).includes('[要PW変更]'));
    const s = await startServer(D);
    try {
      const { r, cookie } = await login('mc1', init, { base: s.base });
      assert.strictEqual(r.status, 200); assert.strictEqual(r.json.mustChange, true);
      const me = await api('GET', '/api/me', { cookie, base: s.base }); assert.strictEqual(me.status, 200); assert.strictEqual(me.json.mustChange, true);
      for (const u of ['/api/months', '/api/month/2026-10', '/api/audit']) {
        const x = await api('GET', u, { cookie, base: s.base }); assert.strictEqual(x.status, 403, u); assert.strictEqual(x.json.error, 'must_change');
      }
      assert.strictEqual((await api('PUT', '/api/month/2026-10', { cookie, base: s.base, body: { version: 0, state: mkState('') } })).json.error, 'must_change');
      const ch = await api('POST', '/api/password', { cookie, base: s.base, body: { current: init, next: 'Brand-New-Pass-77' } });
      assert.strictEqual(ch.status, 200);
      assert.strictEqual((await api('GET', '/api/me', { cookie, base: s.base })).json.mustChange, false);
      assert.strictEqual((await api('GET', '/api/months', { cookie, base: s.base })).status, 200);
    } finally { await s.stop(); }
  });

  await test('パスワード変更：ポリシー違反・現パスワード誤り・他セッション失効・再ログイン・監査ログ', async () => {
    const D = tmpDir(); adduserIn(D, ['t.yamada', '山田 花子', 'staff', '2階', PW, '--no-change-required']);
    const s = await startServer(D);
    const b = s.base, pwd = (cookie, current, next) => api('POST', '/api/password', { cookie, base: b, body: { current, next } });
    try {
      const A = (await login('t.yamada', PW, { base: b })).cookie, B = (await login('t.yamada', PW, { base: b })).cookie;
      assert.strictEqual((await api('POST', '/api/password', { cookie: A, base: b, noCsrf: true, body: { current: PW, next: 'Good-Password-123' } })).status, 403, 'CSRF');
      assert.strictEqual((await pwd(null, PW, 'Good-Password-123')).status, 401, '未ログイン');
      const bads = [['short1A!', '12文字未満'], ['aaaaaaaaaaaaaaaa', '繰り返し'], ['alllowercaseletters', '1種類のみ'], ['xx-T.YAMADA-xx-99', 'ID含む'], ['山田花子-Secret-123', '氏名含む'], ['Ｔｅｓｔ-Pass-12345', '現在と同じ（全角でも）'], [PW, '現在と同じ']];
      for (const [p, why] of bads) { const r = await pwd(A, PW, p); assert.strictEqual(r.status, 400, why); assert.strictEqual(r.json.error, 'policy', why); }
      const wrong = await pwd(A, 'not-the-password-1', 'Good-Password-123'); assert.strictEqual(wrong.status, 400); assert.strictEqual(wrong.json.error, 'bad_current');
      const ok = await pwd(A, PW, 'Good-Password-123'); assert.strictEqual(ok.status, 200);
      assert.strictEqual((await api('GET', '/api/me', { cookie: A, base: b })).status, 200, '操作したセッションは継続');
      assert.strictEqual((await api('GET', '/api/me', { cookie: B, base: b })).status, 401, '他セッションは失効');
      assert.strictEqual((await login('t.yamada', PW, { base: b })).r.status, 401, '旧パスワード不可');
      const A2 = await login('t.yamada', 'Good-Password-123', { base: b }); assert.strictEqual(A2.r.status, 200); assert.strictEqual(A2.r.json.mustChange, false);
      const back = await pwd(A2.cookie, 'Good-Password-123', PW); assert.strictEqual(back.status, 400, '直近のパスワードへは戻せない');
      // 再起動後も新パスワード有効
      await s.stop(); const s4 = await startServer(D);
      try { assert.strictEqual((await login('t.yamada', 'Good-Password-123', { base: s4.base })).r.status, 200); } finally { await s4.stop(); }
      const log = fs.readFileSync(path.join(D, 'audit.log'), 'utf8'), users = fs.readFileSync(path.join(D, 'users.json'), 'utf8');
      assert.ok(log.includes('"event":"password_change"') && log.includes('password_change_fail'));
      for (const x of ['Good-Password-123', PW, 'Secret-123', 'not-the-password-1', '"current"', '"next"']) assert.ok(!log.includes(x), 'ログに含めない: ' + x);
      assert.ok(!users.includes('Good-Password-123'));
    } finally { try { await s.stop(); } catch (e) { /* 停止済み */ } }
  });

  await test('パスワード変更の現パスワード誤りが続くとロック', async () => {
    const D = tmpDir(); adduserIn(D, ['lk1', '利用者', 'staff', '2階', PW, '--no-change-required']);
    const s = await startServer(D);
    try {
      const { cookie } = await login('lk1', PW, { base: s.base });
      for (let i = 0; i < 5; i++) await api('POST', '/api/password', { cookie, base: s.base, body: { current: 'wrong-wrong-1', next: 'Good-Password-123' } });
      const r = await api('POST', '/api/password', { cookie, base: s.base, body: { current: PW, next: 'Good-Password-123' } });
      assert.strictEqual(r.status, 429);
    } finally { await s.stop(); }
  });

  await test('監査ログ：月が変わるとローテーションして data/audit/ に保存', async () => {
    const D = tmpDir(); adduserIn(D, ['r1', '利用者', 'staff', '2階', PW, '--no-change-required']);
    const lf = path.join(D, 'audit.log');
    fs.writeFileSync(lf, JSON.stringify({ ts: '2020-01-15T00:00:00.000Z', event: 'old_event' }) + '\n', { mode: 0o600 });
    const old = new Date('2020-01-31T12:00:00Z'); fs.utimesSync(lf, old, old);
    const s = await startServer(D);
    try {
      await login('r1', PW, { base: s.base });
      const f = path.join(D, 'audit', 'audit-2020-01.log');
      assert.ok(fs.existsSync(f), 'ローテーション済み');
      assert.ok(fs.readFileSync(f, 'utf8').includes('old_event'));
      const cur = fs.readFileSync(lf, 'utf8');
      assert.ok(cur.includes('audit_rotate') && cur.includes('login_ok') && !cur.includes('old_event'));
      assert.strictEqual(fs.statSync(lf).mode & 0o777, 0o600);
    } finally { await s.stop(); }
  });

  await test('監査ログ：サイズ超過でローテーション／AUDIT_RETENTION_DAYS 超過分のみ削除', async () => {
    const D = tmpDir(); adduserIn(D, ['r1', '利用者', 'staff', '2階', PW, '--no-change-required']);
    fs.mkdirSync(path.join(D, 'audit'), { recursive: true });
    const oldF = path.join(D, 'audit', 'audit-2019-01.log'), newF = path.join(D, 'audit', 'audit-2099-01.log');
    fs.writeFileSync(oldF, 'x\n'); fs.writeFileSync(newF, 'y\n');
    const t = new Date(Date.now() - 400 * 86400000); fs.utimesSync(oldF, t, t);
    const s = await startServer(D, { AUDIT_MAX_BYTES: '300', AUDIT_RETENTION_DAYS: '365' });
    try {
      assert.ok(!fs.existsSync(oldF), '保管期間超過は削除');
      assert.ok(fs.existsSync(newF), '期間内は残す');
      for (let i = 0; i < 6; i++) await login('r1', 'wrong-password-zz', { base: s.base, headers: { 'X-Forwarded-For': '1.1.1.' + i } });
      const rotated = fs.readdirSync(path.join(D, 'audit')).filter(f => /^audit-\d{4}-\d{2}(-\d+)?\.log$/.test(f) && f !== 'audit-2099-01.log');
      assert.ok(rotated.length >= 1, 'サイズでローテーション: ' + rotated);
    } finally { await s.stop(); }
    // 既定（RETENTION未設定）は削除しない
    const D2b = tmpDir(); fs.mkdirSync(path.join(D2b, 'audit'));
    const f2 = path.join(D2b, 'audit', 'audit-2001-01.log'); fs.writeFileSync(f2, 'z\n'); fs.utimesSync(f2, t, t);
    const s5 = await startServer(D2b); try { assert.ok(fs.existsSync(f2), '既定は保持'); } finally { await s5.stop(); }
  });

  await test('--csv 一括登録：初期パスワードは標準出力のみ、ファイルに平文なし、全員 mustChange', async () => {
    const D = tmpDir(), csv = path.join(D, 'in.csv');
    fs.writeFileSync(csv, '﻿職員ID,氏名,ロール,グループ\r\nc01,架空 一,manager1,2階;3階\r\nc02,"架空, 二",staff,2階\r\nc03,架空三,admin,\r\n');
    const out = adduserIn(D, ['--csv', csv]);
    const rows = out.split('\n').filter(l => /^c0\d\t/.test(l)).map(l => l.split('\t'));
    assert.strictEqual(rows.length, 3);
    const pws = rows.map(r => r[4]); assert.ok(pws.every(p => p && p.length >= 16) && new Set(pws).size === 3);
    assert.deepStrictEqual(rows[0].slice(0, 4), ['c01', '架空 一', 'manager1', '2階;3階']);
    const users = JSON.parse(fs.readFileSync(path.join(D, 'users.json'), 'utf8')).users;
    assert.deepStrictEqual(users.c01.groups, ['2階', '3階']); assert.deepStrictEqual(users.c03.groups, ['*']); assert.strictEqual(users.c02.name, '架空, 二');
    assert.ok(Object.values(users).every(u => u.mustChange === true));
    for (const f of fs.readdirSync(D)) { const t = fs.statSync(path.join(D, f)).isFile() ? fs.readFileSync(path.join(D, f), 'utf8') : ''; for (const p of pws) assert.ok(!t.includes(p), f + ' に平文PW'); }
    // ログインできる
    const s = await startServer(D);
    try { assert.strictEqual((await login('c02', pws[1], { base: s.base })).r.json.mustChange, true); } finally { await s.stop(); }
  });

  await test('--csv：不正ロール・重複・既存ID・グループ欠落はエラーで1件も登録しない', async () => {
    const D = tmpDir(); adduserIn(D, ['ex1', '既存', 'staff', '2階', PW, '--no-change-required']);
    const bad = (body) => { const f = path.join(D, 'bad.csv'); fs.writeFileSync(f, body); return adduserIn(D, ['--csv', f], 1); };
    assert.ok(bad('ok1,正常,staff,2階\nng1,不正,boss,2階\n').includes('2行目') );
    assert.ok(bad('d1,甲,staff,2階\nd1,乙,staff,2階\n').includes('重複'));
    assert.ok(bad('ex1,既存,staff,2階\n').includes('既に登録済み'));
    assert.ok(bad('g1,甲,manager2,\n').includes('グループ'));
    assert.ok(bad('bad id,甲,staff,2階\n').includes('職員ID'));
    assert.deepStrictEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(D, 'users.json'), 'utf8')).users), ['ex1'], '1件も登録されない');
    const f = path.join(D, 'ok.csv'); fs.writeFileSync(f, 'n1,甲,staff,2階\n');
    assert.ok(adduserIn(D, ['--csv', f, '--dry-run']).includes('検証OK'));
    assert.ok(!('n1' in JSON.parse(fs.readFileSync(path.join(D, 'users.json'), 'utf8')).users), 'dry-runは登録しない');
  });

  await test('--csv --out：PWはファイル(0600)のみ・標準出力に出さない・既存ファイルは上書きしない', async () => {
    const D = tmpDir(), csv = path.join(D, 'in.csv'), outF = path.join(os.tmpdir(), 'shiftapp-out-' + process.pid + '.tsv');
    fs.writeFileSync(csv, 'o1,甲,staff,2階\no2,乙,staff,3階\n');
    try {
      const so = adduserIn(D, ['--csv', csv, '--out', outF]);
      const txt = fs.readFileSync(outF, 'utf8'); assert.strictEqual(fs.statSync(outF).mode & 0o777, 0o600);
      const pw = txt.split('\n')[1].split('\t')[4]; assert.ok(pw.length >= 16); assert.ok(!so.includes(pw));
      fs.writeFileSync(csv, 'o3,丙,staff,2階\n');
      adduserIn(D, ['--csv', csv, '--out', outF], 1);
      assert.ok(!('o3' in JSON.parse(fs.readFileSync(path.join(D, 'users.json'), 'utf8')).users));
    } finally { fs.rmSync(outF, { force: true }); }
  });

  await test('.gitignore で data/ が除外されている', async () => {
    const gi = fs.readFileSync(path.join(ROOT, '..', '..', '.gitignore'), 'utf8');
    assert.ok(/shift-app\/server\/data\//.test(gi));
  });

  console.log(`\n${pass} passed, ${failN} failed`);
  child.kill(); fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); try { child.kill(); } catch (x) { /* */ } process.exit(1); });
