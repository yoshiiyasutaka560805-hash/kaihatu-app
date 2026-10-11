// 個人情報の列暗号化（AES-256-GCM）。鍵は環境変数 APP_DATA_KEY(hex64) か data/.key（初回自動生成）。
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

function loadKey() {
  if (process.env.APP_DATA_KEY) return Buffer.from(process.env.APP_DATA_KEY, 'hex');
  const keyFile = path.join(DATA_DIR, '.key');
  if (!fs.existsSync(keyFile)) {
    fs.writeFileSync(keyFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
    console.warn('[warn] 暗号鍵を data/.key に生成しました。DBと別の場所にバックアップしてください（紛失するとデータは復号不能）。');
  }
  return Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'hex');
}
const KEY = loadKey();
if (KEY.length !== 32) throw new Error('暗号鍵は32バイト(hex64文字)である必要があります');

function encrypt(text) {
  if (text == null || text === '') return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
function decrypt(b64) {
  if (!b64) return '';
  const buf = Buffer.from(b64, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}
function encryptBuffer(buf) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]);
}
function decryptBuffer(buf) {
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]);
}
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
module.exports = { encrypt, decrypt, encryptBuffer, decryptBuffer, sha256, DATA_DIR };
