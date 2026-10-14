'use strict';

const { csvToObjects } = require('../csv');
const { importRows } = require('../postingStore');
const { decodeText } = require('../../utils/encoding');
const { addDays, todayJst } = require('../../utils/dates');
const jobMedley = require('./jobMedleyImport');

const MAX_ROWS = 20000;
const WEB_VALID_DAYS = 14; // 掲載情報は取込から2週間で自動的に無効（再取込で更新）

function importCsvBuffer(buf, fileName) {
  const rows = csvToObjects(decodeText(buf));
  if (rows.length > MAX_ROWS) throw Object.assign(new Error(`行数が多すぎます（上限${MAX_ROWS}行）`), { status: 400 });
  if (jobMedley.isJobMedley(rows)) {
    const expiry = addDays(todayJst(), WEB_VALID_DAYS);
    const converted = [];
    const errors = [];
    for (const [i, r] of rows.entries()) {
      try { converted.push(jobMedley.toPosting(r, expiry)); } catch (e) { errors.push(`${i + 2}行目: ${e.message}`); }
    }
    const res = importRows(converted, 'web_csv', { sourceFile: 'ジョブメドレー',
      terms: 'ネット掲載情報（ジョブメドレー。掲載元の利用規約に従う。案内前に掲載元で最新情報を確認し、紹介する場合は事業所から求人の申込みを受ける）' });
    return { ...res, format: 'ジョブメドレー', errors: [...errors, ...res.errors] };
  }
  return importRows(rows, 'manual', { sourceFile: fileName });
}

module.exports = { importCsvBuffer };
