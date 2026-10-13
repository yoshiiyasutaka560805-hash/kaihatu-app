'use strict';

// 入力検証：フィールド定義に従って型変換・検証し、未知のフィールドは捨てる
const { normalizeDate, normalizeTime } = require('./dates');
const { parseYen, parseIntLoose, parseNum, parseBool, safeUrl } = require('./values');

class ValidationError extends Error {
  constructor(message) { super(message); this.status = 400; }
}

// spec: { field: 'text' | 'text:500' | 'date' | 'time' | 'datetime' | 'int' | 'yen' | 'num' | 'bool' | 'url' | ['選択肢', ...] }
function validate(body, spec, { required = [] } = {}) {
  const out = {};
  for (const [field, type] of Object.entries(spec)) {
    if (body[field] === undefined) continue;
    const raw = body[field];
    const empty = raw === null || raw === '';
    let v;
    if (Array.isArray(type)) {
      if (empty) v = null;
      else if (!type.includes(raw)) throw new ValidationError(`${field}: 選択肢にない値です`);
      else v = raw;
    } else {
      const [t, lenStr] = type.split(':');
      const max = Number(lenStr) || (t === 'text' ? 200 : 0);
      switch (t) {
        case 'text':
          v = empty ? null : String(raw).trim();
          if (v && v.length > max) throw new ValidationError(`${field}: ${max}文字以内で入力してください`);
          break;
        case 'date':
          v = empty ? null : normalizeDate(raw);
          if (!empty && !v) throw new ValidationError(`${field}: 日付の形式が正しくありません`);
          break;
        case 'time':
          v = empty ? null : normalizeTime(raw);
          if (!empty && !v) throw new ValidationError(`${field}: 時刻の形式が正しくありません`);
          break;
        case 'datetime': {
          if (empty) { v = null; break; }
          const m = String(raw).match(/^(\S+?)[ T](\d{1,2}:\d{2})/);
          const d = m && normalizeDate(m[1]);
          const tm = m && normalizeTime(m[2]);
          if (!d || !tm) throw new ValidationError(`${field}: 日時の形式が正しくありません`);
          v = `${d} ${tm}`;
          break;
        }
        case 'int': v = empty ? null : parseIntLoose(raw); if (!empty && v == null) throw new ValidationError(`${field}: 数値を入力してください`); break;
        case 'yen': v = empty ? null : parseYen(raw); if (!empty && v == null) throw new ValidationError(`${field}: 金額を入力してください`); break;
        case 'num': v = empty ? null : parseNum(raw); if (!empty && v == null) throw new ValidationError(`${field}: 数値を入力してください`); break;
        case 'bool': v = empty ? 0 : (parseBool(raw) ?? (raw ? 1 : 0)); break;
        case 'url': v = empty ? null : safeUrl(raw); if (!empty && !v) throw new ValidationError(`${field}: http(s) のURLのみ登録できます`); break;
        default: throw new Error(`unknown type ${type}`);
      }
    }
    out[field] = v;
  }
  for (const f of required) {
    if (out[f] == null || out[f] === '') throw new ValidationError(`${f} は必須です`);
  }
  return out;
}

// 動的SQLの列名は必ずこの関数を通す（spec に定義された列のみ）
function columnsOf(obj, spec) {
  const cols = Object.keys(obj).filter(c => Object.prototype.hasOwnProperty.call(spec, c));
  for (const c of cols) if (!/^[a-z_][a-z0-9_]*$/.test(c)) throw new Error(`invalid column ${c}`);
  return cols;
}

// express の async ハンドラ用ラッパ
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { validate, columnsOf, ValidationError, ah };
