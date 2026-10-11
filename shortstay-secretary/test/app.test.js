const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-'));
process.env.DATA_DIR = tmp;
process.env.FACILITY_ADDRESS = '東京都千代田区1-1-1';
const { app, isAllowedIp } = require('../server');
const db = require('../lib/db');
const alerts = require('../lib/alerts');
const routing = require('../lib/routing');

let server; let base; let token;
const call = async (method, url, body, tk = token) => {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
before(async () => { await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); }); base = `http://127.0.0.1:${server.address().port}/api`; });
after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('LAN/VPN以外のIPは拒否', () => {
  assert.ok(isAllowedIp('192.168.1.5') && isAllowedIp('100.100.1.1') && isAllowedIp('::ffff:10.0.0.3'));
  assert.ok(!isAllowedIp('8.8.8.8') && !isAllowedIp('172.32.0.1'));
});
test('未認証は401、弱いパスワードは設定不可', async () => {
  assert.equal((await call('GET', '/clients', null, null)).status, 401);
  assert.equal((await call('POST', '/setup', { username: 'a', display_name: 'A', password: 'short' }, null)).status, 400);
  assert.equal((await call('POST', '/setup', { username: 'admin', display_name: '管理者', password: 'correct-horse-1' }, null)).status, 200);
  const r = await call('POST', '/login', { username: 'admin', password: 'correct-horse-1' }, null);
  token = r.body.token; assert.ok(token);
});
test('5回失敗でロック', async () => {
  const { createUser } = require('../lib/auth');
  createUser('locktest', 'L', 'long-password-1');
  for (let i = 0; i < 5; i++) await call('POST', '/login', { username: 'locktest', password: 'x' }, null);
  const r = await call('POST', '/login', { username: 'locktest', password: 'long-password-1' }, null);
  assert.equal(r.status, 401); assert.match(r.body.error, /ロック/);
});
let wcClient; let normalClient; let vanWc; let car; let driver;
test('利用者はDB上で暗号化され、APIでは復号される', async () => {
  wcClient = (await call('POST', '/clients', { surname: '山田', given: '太郎', surname_initial: 'y', phone: '090-1111-2222', address: '東京都新宿区2-2-2', wheelchair: true })).body.id;
  normalClient = (await call('POST', '/clients', { surname: '佐藤', given: '花子', surname_initial: 'S', address: '東京都豊島区3-3-3' })).body.id;
  const raw = db.prepare('SELECT * FROM clients WHERE id=?').get(wcClient);
  assert.ok(!JSON.stringify(raw).includes('山田') && !JSON.stringify(raw).includes('新宿'));
  const c = (await call('GET', `/clients/${wcClient}`)).body;
  assert.equal(c.surname, '山田'); assert.equal(c.masked_name, 'Y 太郎');
});
test('書類期限アラート（閾値・期限切れ・未登録・再掲停止）', async () => {
  const t = (await call('GET', '/doc-types')).body.find((x) => x.name === '負担割合証').id;
  const today = '2026-10-11';
  const set = (d) => { db.prepare('DELETE FROM documents WHERE client_id=? AND doc_type_id=?').run(wcClient, t);
    db.prepare('INSERT INTO documents (client_id, doc_type_id, expires_on) VALUES (?,?,?)').run(wcClient, t, d); };
  const get = () => alerts.documentAlerts(today).find((a) => a.type === '負担割合証' && a.client_id === wcClient);
  set('2027-03-01'); assert.equal(get(), undefined);           // 141日前: まだ通知しない
  set('2026-12-31'); assert.equal(get().level, 'warn');        // 81日前: 90日閾値内
  set('2026-10-15'); assert.equal(get().level, 'urgent');      // 4日前
  set('2026-10-01'); assert.equal(get().level, 'overdue');     // 期限切れ
  set('2028-10-01'); assert.equal(get(), undefined);           // 更新登録で再掲停止
  assert.ok(alerts.missingDocuments().some((m) => m.type === '契約書')); // 未登録検出
});
test('送迎: 車椅子の利用者は非対応車両で不可、同乗は最大3名', async () => {
  vanWc = (await call('POST', '/vehicles', { name: 'バネット', wheelchair: true, capacity: 4 })).body.id;
  car = (await call('POST', '/vehicles', { name: '普通車', wheelchair: false, capacity: 3 })).body.id;
  driver = (await call('POST', '/drivers', { name: '運転手A' })).body.id;
  const p1 = (await call('POST', `/clients/${wcClient}/patterns`, { weekday: 1, kind: '迎え', time: '09:00' })).body.id;
  const p2 = (await call('POST', `/clients/${normalClient}/patterns`, { weekday: 1, kind: '迎え', time: '09:20' })).body.id;
  let r = await call('POST', '/transport/plan', { kind: '迎え', vehicle_id: car, driver_id: driver, pattern_ids: [p1] });
  assert.equal(r.status, 400); assert.match(r.body.errors.join(), /車椅子/);
  r = await call('POST', '/transport/plan', { kind: '迎え', vehicle_id: vanWc, driver_id: driver, pattern_ids: [p1, p2] });
  assert.equal(r.status, 200); assert.equal(r.body.stops.length, 2);
  assert.match(r.body.maps_url, /google\.com\/maps\/dir/);
});
test('外部送信ペイロードに氏名・電話が含まれない／表示名は姓イニシャル', async () => {
  const cs = db.prepare('SELECT c.*, p.time FROM clients c JOIN pickup_patterns p ON p.client_id=c.id').all();
  let sent;
  const r = await routing.planRoute({ kind: '迎え', vehicle: { name: 'v', wheelchair: 1, capacity: 4 }, driver: { name: 'd' }, clients: cs,
    fetchRoute: async (payload) => { sent = JSON.stringify(payload); return { duration: '1500s' }; } });
  for (const bad of ['山田', '佐藤', '太郎', '花子', '090-1111-2222']) assert.ok(!sent.includes(bad), `外部送信に ${bad} が含まれる`);
  assert.equal(r.total_minutes, 25);
  assert.deepEqual(r.stops.map((s) => s.label), ['Y 太郎', 'S 花子']);
});
test('本日の送迎一覧の警告・ダッシュボード', async () => {
  const d = (await call('GET', '/dashboard?date=2026-10-12')).body; // 月曜
  assert.equal(d.pickups.length, 2);
  assert.ok(d.pickups.some((p) => p.warnings.some((w) => w.includes('運転手'))));
});
test('端末の無効化・操作ログ・CSV取込', async () => {
  const csv = '姓,名,姓イニシャル,電話,住所,緊急連絡先,車椅子\n鈴木,一郎,S,03-0000-0000,東京都港区4-4-4,家族,1\n山田,太郎,Y,,,,\n';
  const r = (await call('POST', '/import/clients', { csv })).body;
  assert.equal(r.created, 1); assert.equal(r.skipped.length, 1);
  assert.ok((await call('GET', '/admin/audit')).body.some((a) => a.action === 'import_clients'));
  const t2 = (await call('POST', '/login', { username: 'admin', password: 'correct-horse-1' }, null)).body.token;
  assert.equal((await call('GET', '/me', null, t2)).status, 200);
  const uid = (await call('GET', '/me', null, t2)).body.id;
  await call('POST', `/admin/users/${uid}/revoke-all`);
  assert.equal((await call('GET', '/me', null, t2)).status, 401); // 紛失端末を無効化
});
