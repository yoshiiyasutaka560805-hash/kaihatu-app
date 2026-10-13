'use strict';

// 同一プロセス内の排他（取込の二重実行・同じ求職者の判定の並行実行を防ぐ）
const held = new Set();

async function withLock(key, fn) {
  if (held.has(key)) {
    const e = new Error('同じ処理を実行中です。完了までお待ちください');
    e.status = 409;
    throw e;
  }
  held.add(key);
  try { return await fn(); } finally { held.delete(key); }
}

module.exports = { withLock, isLocked: key => held.has(key) };
