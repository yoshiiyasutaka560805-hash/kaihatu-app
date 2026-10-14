// サンプル（架空）データへ置き換える。実データがあるDBでは実行しないこと。
//   node scripts/seed-sample.js --yes      （アプリを停止してから実行）
// 実行前に暗号化DBを data/backups/ へ自動バックアップし、利用者・書類・送迎パターンを全て置き換える。
const fs = require('node:fs');
const path = require('node:path');
const db = require('../lib/db');
const { DATA_DIR } = require('../lib/crypto');
const { importClients } = require('../server');

if (!process.argv.includes('--yes')) {
  const n = db.prepare('SELECT COUNT(*) n FROM clients').get().n;
  console.log(`現在の利用者 ${n} 名を全て削除し、サンプルに置き換えます。実行するには --yes を付けてください。`);
  process.exit(1);
}
fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true });
const bk = path.join(DATA_DIR, 'backups', `before-seed-${Date.now()}.db`);
db.exec(`VACUUM INTO '${bk.replace(/'/g, "''")}'`);
console.log('バックアップ:', bk);

for (const d of db.prepare('SELECT file_path FROM documents WHERE file_path IS NOT NULL').all())
  fs.rmSync(path.join(DATA_DIR, 'uploads', d.file_path), { force: true });
db.exec('DELETE FROM documents; DELETE FROM pickup_patterns; DELETE FROM clients;');

const csv = fs.readFileSync(path.join(__dirname, '..', 'samples', 'clients_sample_dummy.csv'), 'utf8');
const r = importClients(csv);
if (r.errors.length) { console.error(r.errors); process.exit(1); }

// 車両・運転手（無ければ作成）
const ensure = (table, name, extra) => {
  const f = db.prepare(`SELECT id FROM ${table} WHERE name=?`).get(name);
  return f ? f.id : Number(db.prepare(extra.sql).run(...extra.args).lastInsertRowid);
};
const van = ensure('vehicles', 'バネット', { sql: 'INSERT INTO vehicles (name, wheelchair, capacity) VALUES (?,?,?)', args: ['バネット', 1, 4] });
const tant = ensure('vehicles', 'タント', { sql: 'INSERT INTO vehicles (name, wheelchair, capacity) VALUES (?,?,?)', args: ['タント', 0, 3] });
const drivers = ['運転手A', '運転手B', '運転手C'].map((n) => ensure('drivers', n, { sql: 'INSERT INTO drivers (name) VALUES (?)', args: [n] }));

// 固定送迎（サンプル）: 各利用者に 迎え(月〜金の午前) と 送り(月〜金の午後) を1つずつ
let seed = 7; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const hhmm = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const ins = db.prepare('INSERT INTO pickup_patterns (client_id, weekday, kind, time, default_vehicle_id, default_driver_id) VALUES (?,?,?,?,?,?)');
for (const c of db.prepare('SELECT id, wheelchair, vehicle_hint FROM clients').all()) {
  const veh = c.wheelchair || c.vehicle_hint === 'バネット' ? van : c.vehicle_hint === 'タント' ? tant : (rnd(2) ? van : tant);
  const wd = 1 + rnd(5), drv = drivers[rnd(drivers.length)];
  ins.run(c.id, wd, '迎え', hhmm(9 + rnd(2), rnd(4) * 15), veh, drv);
  ins.run(c.id, 1 + rnd(5), '送り', hhmm(14 + rnd(3), rnd(4) * 15), veh, drv);
}
console.log(`サンプル ${r.created} 名を登録しました（架空データ）。アプリを再起動してください。`);
process.exit(0);
