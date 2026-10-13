'use strict';

// 日付ユーティリティ。業務日付はすべて日本時間（Asia/Tokyo）で扱う

const ERAS = { 令和: 2018, 平成: 1988, 昭和: 1925, R: 2018, H: 1988, S: 1925 };

function pad(n) { return String(n).padStart(2, '0'); }

// Date → 'YYYY-MM-DD'（日本時間）
function ymdJst(date = new Date()) {
  const j = new Date(date.getTime() + 9 * 3600 * 1000);
  return `${j.getUTCFullYear()}-${pad(j.getUTCMonth() + 1)}-${pad(j.getUTCDate())}`;
}

function todayJst() { return ymdJst(new Date()); }

function toHalfWidth(s) {
  return String(s).replace(/[０-９Ａ-Ｚａ-ｚ．／－：]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

function valid(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// 各種表記の日付を 'YYYY-MM-DD' に正規化。解釈できなければ null
//   2026-12-31 / 2026/12/31 / 2026.12.31 / 2026年12月31日 / 令和8年12月31日 / R8.12.31 / 20261231
function normalizeDate(v) {
  if (v == null || v === '') return null;
  let s = toHalfWidth(String(v)).trim().replace(/\s+/g, '');
  let y, m, d, mt;
  if ((mt = s.match(/^(令和|平成|昭和|R|H|S)(元|\d{1,2})[年.\/-](\d{1,2})[月.\/-](\d{1,2})日?$/i))) {
    const era = ERAS[mt[1].toUpperCase()] ?? ERAS[mt[1]];
    y = era + (mt[2] === '元' ? 1 : Number(mt[2]));
    m = Number(mt[3]); d = Number(mt[4]);
  } else if ((mt = s.match(/^(\d{4})[年.\/-](\d{1,2})[月.\/-](\d{1,2})日?/))) {
    y = Number(mt[1]); m = Number(mt[2]); d = Number(mt[3]);
  } else if ((mt = s.match(/^(\d{4})(\d{2})(\d{2})$/))) {
    y = Number(mt[1]); m = Number(mt[2]); d = Number(mt[3]);
  } else return null;
  return valid(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
}

function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmt(dt) { return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`; }

function addDays(ymd, n) {
  const dt = parseYmd(ymd);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fmt(dt);
}

// 月末を超える場合は月末に丸める（1/31 + 1か月 → 2/28）
function addMonths(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12), nm = total % 12 + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${pad(nm)}-${pad(Math.min(d, last))}`;
}

function addYears(ymd, n) { return addMonths(ymd, n * 12); }

function diffDays(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 86400000); }

function ageOn(birthDate, today = todayJst()) {
  const b = normalizeDate(birthDate);
  if (!b) return null;
  const [by, bm, bd] = b.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age;
}

// 年度（4月始まり）
function fiscalYearRange(fy) { return { from: `${fy}-04-01`, to: `${fy + 1}-03-31` }; }

function normalizeTime(v) {
  if (v == null || v === '') return null;
  const m = toHalfWidth(String(v)).match(/(\d{1,2})\s*[:時]\s*(\d{1,2})?/);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2] || 0);
  if (h > 29 || mi > 59) return null;
  return `${pad(h)}:${pad(mi)}`;
}

module.exports = { ymdJst, todayJst, normalizeDate, normalizeTime, addDays, addMonths, addYears, diffDays,
  ageOn, fiscalYearRange, toHalfWidth };
