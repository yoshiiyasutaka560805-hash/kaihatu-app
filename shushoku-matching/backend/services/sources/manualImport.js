'use strict';

// 手動取込：ハローワークインターネットサービスで確認した求人を CSV または1件ずつ登録
const { csvToObjects } = require('../csv');
const { importRows } = require('../postingStore');

function importCsv(text) {
  return importRows(csvToObjects(text), 'manual');
}

function importOne(posting) {
  return importRows([posting], 'manual');
}

module.exports = { importCsv, importOne };
