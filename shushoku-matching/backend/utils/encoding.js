'use strict';

// CSV の文字コード判定：BOM → UTF-8（厳格）→ Shift_JIS の順
function decodeText(buf) {
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) return new TextDecoder('utf-8').decode(buf.subarray(3));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { /* fallthrough */ }
  return new TextDecoder('shift_jis').decode(buf);
}

module.exports = { decodeText };
