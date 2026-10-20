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
function adduser(...a) { const r = spawnSync(process.execPath, [path.join(ROOT, 'adduser.js'), ...a], { env: { ...process.env, DATA_DIR: DATA }, encoding: 'utf8' }); assert.strictEqual(r.status, 0, r.stderr + r.stdout); return r.stdout; }

const PW = 'Test-Pass-12345';
let base, child;
async function api(method, url, { body, cookie, headers, noCsrf } = {}) {
  const h = { ...(headers || {}) };
  if (method !== 'GET' && !noCsrf) h['X-Requested-With'] = 'shiftapp';
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (cookie) h.Cookie = cookie;
  const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  let j = null; try { j = await r.json(); } catch (e) { /* html */ }
  return { status: r.status, json: j, headers: r.headers };
}
async function login(id, pw = PW) {
  const r = await api('POST', '/api/login', { body: { id, password: pw } });
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

  console.log(`\n${pass} passed, ${failN} failed`);
  child.kill(); fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); try { child.kill(); } catch (x) { /* */ } process.exit(1); });
