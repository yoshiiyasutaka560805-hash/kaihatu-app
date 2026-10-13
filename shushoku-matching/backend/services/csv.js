'use strict';

// RFC4180 準拠の簡易CSVパーサ（ダブルクォート・改行入りセル対応、BOM除去）
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

// 1行目をヘッダとしてオブジェクト配列に変換
function csvToObjects(text) {
  const [header, ...body] = parseCsv(text);
  if (!header) return [];
  const keys = header.map(h => h.trim());
  return body.map(r => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
}

module.exports = { parseCsv, csvToObjects };
