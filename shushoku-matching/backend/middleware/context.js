'use strict';

// リクエスト単位の操作者名を保持（監査ログ・履歴に記録する）
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

function contextMiddleware(req, res, next) {
  let op = req.get('X-Operator');
  try { op = op ? decodeURIComponent(op).slice(0, 40) : null; } catch { op = null; }
  als.run({ operator: op }, next);
}

function currentOperator() {
  return als.getStore()?.operator || 'system';
}

function runAs(operator, fn) { return als.run({ operator }, fn); }

module.exports = { contextMiddleware, currentOperator, runAs };
