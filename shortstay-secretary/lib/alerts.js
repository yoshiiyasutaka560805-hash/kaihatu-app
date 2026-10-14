// ルールベースの「AI秘書」: 書類期限と今日の送迎を判定し、行動を促す文面を生成する。
// 個人情報は外部へ送らない（このモジュールは完全ローカル）。
const db = require('./db');
const { decrypt } = require('./crypto');

const DAY = 86400000;
const toDay = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const todayStr = (now = new Date()) => {
  const j = new Date(now.getTime() + 9 * 3600000); // JST
  return j.toISOString().slice(0, 10);
};
const weekdayOf = (dateStr) => new Date(toDay(dateStr)).getUTCDay();

function displayName(c) { return `${decrypt(c.surname_enc)} ${decrypt(c.given_enc)}`; }
// 外部送信・共有用: 姓はイニシャル、名は実名
function maskedName(c) { return `${c.surname_initial} ${decrypt(c.given_enc)}`; }

function level(days, thresholds) {
  if (days < 0) return 'overdue';
  const hit = thresholds.filter((t) => days <= t).sort((a, b) => a - b)[0];
  if (hit === undefined) return null;
  return days <= 7 ? 'urgent' : 'warn';
}

function documentAlerts(today = todayStr()) {
  const rows = db.prepare(`SELECT d.id, d.client_id, d.expires_on, t.name type_name, t.alert_days, c.surname_enc, c.given_enc
    FROM documents d JOIN doc_types t ON t.id=d.doc_type_id JOIN clients c ON c.id=d.client_id
    WHERE c.active=1 AND t.has_expiry=1 AND d.expires_on IS NOT NULL`).all();
  const out = [];
  for (const r of rows) {
    const days = Math.round((toDay(r.expires_on) - toDay(today)) / DAY);
    const th = r.alert_days.split(',').map(Number).filter(Boolean);
    const lv = level(days, th);
    if (!lv) continue;
    const name = displayName(r);
    const message = days < 0
      ? `${name}さんの「${r.type_name}」は ${-days}日前に期限切れです。至急更新手続きを行ってください。`
      : `${name}さんの「${r.type_name}」は ${r.expires_on} が期限です（あと${days}日）。更新書類の準備を始めてください。`;
    out.push({ document_id: r.id, client_id: r.client_id, client: name, type: r.type_name,
      expires_on: r.expires_on, days_left: days, level: lv, message });
  }
  return out.sort((a, b) => a.days_left - b.days_left);
}

// 必須書類が未登録の利用者
function missingDocuments() {
  const clients = db.prepare('SELECT * FROM clients WHERE active=1').all();
  const types = db.prepare('SELECT * FROM doc_types WHERE required=1').all();
  const have = db.prepare('SELECT client_id, doc_type_id FROM documents').all();
  const set = new Set(have.map((h) => `${h.client_id}:${h.doc_type_id}`));
  const out = [];
  for (const c of clients) for (const t of types) {
    if (!set.has(`${c.id}:${t.id}`)) {
      const name = displayName(c);
      out.push({ client_id: c.id, client: name, type: t.name, level: 'missing',
        message: `${name}さんの「${t.name}」が未登録です。` });
    }
  }
  return out;
}

function todaysPickups(today = todayStr()) {
  const wd = weekdayOf(today);
  const rows = db.prepare(`SELECT p.*, c.surname_enc, c.given_enc, c.surname_initial, c.address_enc, c.phone_enc, c.wheelchair, c.wheelchair_type, c.gait, c.tags, c.vehicle_hint, c.escort_enc, c.attention_enc,
      v.name vehicle_name, v.wheelchair v_wc, d.name driver_name
    FROM pickup_patterns p JOIN clients c ON c.id=p.client_id
    LEFT JOIN vehicles v ON v.id=p.default_vehicle_id LEFT JOIN drivers d ON d.id=p.default_driver_id
    WHERE p.weekday=? AND c.active=1 ORDER BY p.time`).all(wd);
  return rows.map((r) => {
    const name = displayName(r);
    const warn = [];
    if (r.wheelchair && !r.v_wc) warn.push(r.default_vehicle_id ? '車椅子対応でない車両が指定されています' : '車椅子対応車両が未指定です');
    if (!r.default_driver_id) warn.push('運転手が未指定です');
    const tags = r.tags ? r.tags.split(',') : [];
    if (r.vehicle_hint && r.vehicle_name && !r.vehicle_name.includes(r.vehicle_hint)) warn.push(`車種指定は「${r.vehicle_hint}」です`);
    if (tags.includes('出発前に電話')) warn.push('出発前に電話連絡してください');
    if (tags.includes('オートロック')) warn.push('オートロックあり（インターホン/待ち合わせを確認）');
    if (tags.includes('道が狭い')) warn.push('道が狭いです（車両サイズに注意）');
    return { pattern_id: r.id, client_id: r.client_id, client: name, kind: r.kind, time: r.time,
      wheelchair: !!r.wheelchair, wheelchair_type: r.wheelchair_type, gait: r.gait, tags, vehicle_hint: r.vehicle_hint,
      escort: decrypt(r.escort_enc), attention: decrypt(r.attention_enc), vehicle: r.vehicle_name, driver: r.driver_name, note: r.note, warnings: warn,
      message: `${r.time} ${name}さん ${r.kind}${r.wheelchair_type ? `（${r.wheelchair_type}）` : r.gait ? `（${r.gait}）` : ''} 車両:${r.vehicle_name || '未指定'} 運転手:${r.driver_name || '未指定'}` };
  });
}

function briefing(today = todayStr()) {
  const docs = documentAlerts(today);
  const missing = missingDocuments();
  const pickups = todaysPickups(today);
  const todo = [
    ...docs.filter((d) => d.level !== 'warn').map((d) => d.message),
    ...pickups.flatMap((p) => p.warnings.map((w) => `${p.time} ${p.client}さん ${p.kind}: ${w}`)),
  ];
  return { date: today, pickups, document_alerts: docs, missing_documents: missing, todo };
}

module.exports = { briefing, documentAlerts, missingDocuments, todaysPickups, todayStr, weekdayOf, displayName, maskedName, level };
