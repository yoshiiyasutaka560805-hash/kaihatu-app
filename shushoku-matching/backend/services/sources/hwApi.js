'use strict';

// ハローワーク「求人情報提供サービス」の Web API（XML）による求人の自動取得
//
// 前提：管轄労働局へ利用申請し承認を受けること（有料職業紹介事業の許可が必要）。
//       承認後に受け取る「API インタフェース仕様書」に合わせて、設定画面の URL・タグ名・項目対応を入力する。
//       ※この環境からは仕様書を参照できなかったため、URL・タグ名は既定値を持たず、すべて設定値で動く汎用実装としている。
// 認証情報：環境変数 HW_API_ID / HW_API_PASSWORD（DBには保存しない）
// 取得の流れ：①トークン取得 → ②データIDごとにページを順に取得（XML）→ ③レコードを求人に変換 → ④取込 → ⑤トークン破棄
// 利用規約上、職業紹介以外への利用・第三者提供・公開は禁止。取得頻度は仕様書の指定に従う（既定は1日1回）

const fetch = require('node-fetch');
const { XMLParser } = require('fast-xml-parser');
const { getSettings } = require('../../database/db');
const { importRows } = require('../postingStore');
const { normalizePref } = require('../../utils/area');

const MAX_PAGES = 2000;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', parseTagValue: false, trimValues: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

function config(s = getSettings()) {
  let fieldMap = {};
  try { fieldMap = JSON.parse(s.hwapi_field_map || '{}'); } catch { fieldMap = {}; }
  return {
    enabled: s.hwapi_enabled === '1',
    tokenUrl: s.hwapi_token_url, dataUrl: s.hwapi_data_url, logoutUrl: s.hwapi_logout_url,
    dataIds: String(s.hwapi_data_ids || '').split(',').map(x => x.trim()).filter(Boolean),
    tokenTag: s.hwapi_token_tag || 'token', recordTag: s.hwapi_record_tag, fieldMap,
    idParam: s.hwapi_id_param || 'id', passParam: s.hwapi_pass_param || 'pass',
    prefectures: String(s.hwapi_prefectures || '').split(',').map(x => normalizePref(x.trim())).filter(Boolean),
    intervalMs: Math.max(1000, Number(s.hwapi_interval_ms || 1000)),
    terms: s.provision_terms,
  };
}

// XML 内の指定タグをすべて集める（階層を問わない）
function collect(node, tag, out = []) {
  if (node == null || typeof node !== 'object') return out;
  for (const [k, v] of Object.entries(node)) {
    if (k === tag) (Array.isArray(v) ? v : [v]).forEach(x => out.push(x));
    else if (Array.isArray(v)) v.forEach(x => collect(x, tag, out));
    else if (typeof v === 'object') collect(v, tag, out);
  }
  return out;
}

function findFirst(node, tag) { return collect(node, tag)[0]; }

// XMLレコード → 取込行（項目対応表：{ "XMLタグ名": "求人の項目名" }。値が「A+B」の形なら連結）
function recordToRow(rec, fieldMap) {
  const row = {};
  for (const [xmlTag, field] of Object.entries(fieldMap)) {
    const tags = xmlTag.split('+');
    const vals = tags.map(t => { const v = rec[t]; return v == null ? '' : (typeof v === 'object' ? (v['#text'] ?? '') : String(v)); }).filter(Boolean);
    if (vals.length) row[field] = row[field] ? `${row[field]} ${vals.join(' ')}` : vals.join(' ');
  }
  return row;
}

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(vars[k] ?? ''));
}

async function run({ fetchImpl = fetch, settings } = {}) {
  const c = config(settings);
  if (!c.enabled) return { skipped: true, message: 'ハローワーク求人API取得は無効です（承認後に設定で有効化）' };
  const missing = [['hwapi_token_url', c.tokenUrl], ['hwapi_data_url', c.dataUrl], ['hwapi_data_ids', c.dataIds.length], ['hwapi_record_tag', c.recordTag],
    ['hwapi_field_map', Object.keys(c.fieldMap).length]].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`API接続設定が未完了です（${missing.join(', ')}）。仕様書に合わせて設定してください`);
  const id = process.env.HW_API_ID, pass = process.env.HW_API_PASSWORD;
  if (!id || !pass) throw new Error('環境変数 HW_API_ID / HW_API_PASSWORD が未設定です');

  const call = async (url, opts = {}) => {
    const res = await fetchImpl(url, { timeout: 60000, ...opts });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url.replace(/token=[^&]+/, 'token=***')}`);
    return parser.parse(await res.text());
  };

  // ① トークン取得
  const body = new URLSearchParams({ [c.idParam]: id, [c.passParam]: pass });
  const authXml = await call(c.tokenUrl, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  const tokenNode = findFirst(authXml, c.tokenTag);
  const token = typeof tokenNode === 'object' ? tokenNode?.['#text'] : tokenNode;
  if (!token) throw new Error(`トークンを取得できませんでした（タグ「${c.tokenTag}」が見つかりません）`);

  const rows = [];
  let fetchedRecords = 0, pages = 0;
  try {
    // ② データIDごとにページ取得（レコードが0件になるまで）
    for (const dataId of c.dataIds) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        await sleep(c.intervalMs);
        const xml = await call(fill(c.dataUrl, { dataId, page, token }), { headers: { Authorization: `Bearer ${token}` } });
        pages++;
        const recs = collect(xml, c.recordTag);
        if (!recs.length) break;
        fetchedRecords += recs.length;
        for (const rec of recs) {
          const row = recordToRow(rec, c.fieldMap);
          if (c.prefectures.length && !c.prefectures.includes(normalizePref(row.prefecture || row['都道府県'] || ''))) continue;
          rows.push(row);
        }
      }
    }
  } finally {
    // ⑤ トークン破棄（失敗しても続行）
    if (c.logoutUrl) await call(fill(c.logoutUrl, { token }), { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }

  const r = importRows(rows, 'hw_api', { sourceFile: `API ${c.dataIds.join(',')}`, terms: c.terms });
  return { pages, fetchedRecords, targeted: rows.length, inserted: r.inserted, updated: r.updated, deactivated: r.deactivated, errors: r.errors.length };
}

// 接続テスト：トークンを取得して破棄するだけ
async function testConnection({ fetchImpl = fetch, settings } = {}) {
  const c = config(settings);
  if (!c.tokenUrl) throw Object.assign(new Error('トークン取得URLが未設定です'), { status: 400 });
  const id = process.env.HW_API_ID, pass = process.env.HW_API_PASSWORD;
  if (!id || !pass) throw Object.assign(new Error('環境変数 HW_API_ID / HW_API_PASSWORD が未設定です'), { status: 400 });
  const res = await fetchImpl(c.tokenUrl, { method: 'POST', timeout: 30000, body: new URLSearchParams({ [c.idParam]: id, [c.passParam]: pass }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  const text = await res.text();
  if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
  const node = findFirst(parser.parse(text), c.tokenTag);
  const token = typeof node === 'object' ? node?.['#text'] : node;
  if (token && c.logoutUrl) await fetchImpl(fill(c.logoutUrl, { token }), { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  return token ? { ok: true, message: 'トークンを取得できました（接続成功）' } : { ok: false, message: `応答にタグ「${c.tokenTag}」が見つかりません`, sample: text.slice(0, 300) };
}

module.exports = { run, recordToRow, collect, config, testConnection };
