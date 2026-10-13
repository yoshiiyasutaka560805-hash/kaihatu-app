'use strict';

process.env.MATCHING_DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert');
const { encrypt, decrypt } = require('../services/backup');

test('バックアップの暗号化・復号（改ざん検知）', () => {
  const data = Buffer.from('SQLite format 3\0' + 'x'.repeat(1000));
  const enc = encrypt(data, 'pass');
  assert.ok(!enc.includes(Buffer.from('SQLite')));
  assert.deepEqual(decrypt(enc, 'pass'), data);
  assert.throws(() => decrypt(enc, 'wrong'));
  enc[enc.length - 1] ^= 1;
  assert.throws(() => decrypt(enc, 'pass'));
});
