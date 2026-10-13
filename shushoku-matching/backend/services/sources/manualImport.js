'use strict';

const { csvToObjects } = require('../csv');
const { importRows } = require('../postingStore');
const { decodeText } = require('../../utils/encoding');

const MAX_ROWS = 20000;

function importCsvBuffer(buf, fileName) {
  const rows = csvToObjects(decodeText(buf));
  if (rows.length > MAX_ROWS) throw Object.assign(new Error(`行数が多すぎます（上限${MAX_ROWS}行）`), { status: 400 });
  return importRows(rows, 'manual', { sourceFile: fileName });
}

module.exports = { importCsvBuffer };
