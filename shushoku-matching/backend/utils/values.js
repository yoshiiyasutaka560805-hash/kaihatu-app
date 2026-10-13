'use strict';

const { toHalfWidth } = require('./dates');

// 金額の解釈：「22万円」→220000、「２２０，０００円」→220000、「21.5万」→215000
function parseYen(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
  let s = toHalfWidth(String(v)).replace(/[,，円\s]/g, '');
  const man = s.match(/^(\d+(?:\.\d+)?)万(\d+)?$/);
  if (man) return Math.round(Number(man[1]) * 10000 + Number(man[2] || 0));
  const n = s.match(/^\d+(?:\.\d+)?$/);
  return n ? Math.round(Number(s)) : null;
}

function parseIntLoose(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null;
  const m = toHalfWidth(String(v)).replace(/[,，]/g, '').match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function parseNum(v) {
  if (v == null || v === '') return null;
  const n = Number(toHalfWidth(String(v)).replace(/[,，]/g, '').match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(n) ? n : null;
}

const TRUE_WORDS = ['1', 'true', 'あり', '有', '可', 'はい', 'yes', '○', '〇'];
const FALSE_WORDS = ['0', 'false', 'なし', '無', '不可', 'いいえ', 'no', '×'];
function parseBool(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const s = toHalfWidth(String(v)).trim().toLowerCase();
  if (TRUE_WORDS.includes(s)) return 1;
  if (FALSE_WORDS.includes(s)) return 0;
  return null;
}

const WAGE_TYPES = { 月給: 'monthly', 月額: 'monthly', 時給: 'hourly', 時間給: 'hourly', 日給: 'daily',
  日額: 'daily', 年俸: 'annual', 年俸制: 'annual', monthly: 'monthly', hourly: 'hourly', daily: 'daily', annual: 'annual' };
function parseWageType(v) {
  if (!v) return null;
  return WAGE_TYPES[String(v).trim()] || null;
}

// http/https 以外のURLは保存しない（javascript: 等によるXSS対策）
function safeUrl(v) {
  if (!v) return null;
  try {
    const u = new URL(String(v).trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch { return null; }
}

const splitList = v => (v ? String(v).split(/[,、，\n]/).map(x => x.trim()).filter(Boolean) : []);

module.exports = { parseYen, parseIntLoose, parseNum, parseBool, parseWageType, safeUrl, splitList };
