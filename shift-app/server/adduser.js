#!/usr/bin/env node
'use strict';
// 使い方:
//   node server/adduser.js <職員ID> <氏名> <role> <グループ,グループ> [パスワード]
//   node server/adduser.js --passwd <職員ID> [新パスワード]
//   node server/adduser.js --disable <職員ID> / --enable <職員ID>
//   node server/adduser.js --list
// role: admin(システム管理者) / manager1(管理者Ⅰ) / manager2(管理者Ⅱ) / staff(一般職員)
// グループ = 勤務表の部署名（例 2階,3階）。admin は全部署のため '*' でよい。
const crypto = require('crypto');
const { ROLES, hashPassword, loadUsers, saveUsers, dataDir } = require('./userstore');

const ALPHA = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genPassword(n = 16) { let s = ''; while (s.length < n) { const b = crypto.randomBytes(1)[0]; if (b < 256 - (256 % ALPHA.length)) s += ALPHA[b % ALPHA.length]; } return s; }
function die(m) { console.error('エラー: ' + m); process.exit(1); }
function checkPw(p) { if (p.length < 10) die('パスワードは10文字以上にしてください'); }

(async () => {
  const a = process.argv.slice(2);
  const users = loadUsers();
  if (a[0] === '--list') {
    const rows = Object.entries(users);
    if (!rows.length) console.log('(ユーザーなし)');
    for (const [id, u] of rows) console.log(`${id}\t${u.name}\t${u.role}\t${(u.groups || []).join(',')}${u.disabled ? '\t[無効]' : ''}`);
    return;
  }
  if (a[0] === '--passwd') {
    const id = a[1]; if (!id || !users[id]) die('職員IDが見つかりません');
    const pw = a[2] || genPassword(); checkPw(pw);
    users[id].hash = await hashPassword(pw); users[id].pwChangedAt = new Date().toISOString();
    saveUsers(users);
    console.log(a[2] ? 'パスワードを更新しました。' : `新しいパスワード（この画面に一度だけ表示）: ${pw}`);
    return;
  }
  if (a[0] === '--disable' || a[0] === '--enable') {
    const id = a[1]; if (!id || !users[id]) die('職員IDが見つかりません');
    users[id].disabled = a[0] === '--disable'; saveUsers(users); console.log('更新しました'); return;
  }
  const [id, name, role, groupsArg, pwArg] = a;
  if (!id || !name || !role) die('使い方: node server/adduser.js <職員ID> <氏名> <role> <グループ,グループ> [パスワード]');
  if (!/^[A-Za-z0-9_.@-]{1,40}$/.test(id)) die('職員IDは英数字と _ . @ - のみ（40文字まで）');
  if (!ROLES[role]) die('role は admin / manager1 / manager2 / staff のいずれか');
  if (users[id]) die('その職員IDは既に存在します（パスワード変更は --passwd）');
  const groups = role === 'admin' ? ['*'] : (groupsArg || '').split(',').map(s => s.trim()).filter(Boolean);
  if (role !== 'admin' && !groups.length) die('グループ（部署名）を指定してください');
  const pw = pwArg || genPassword(); checkPw(pw);
  users[id] = { name, role, groups, hash: await hashPassword(pw), createdAt: new Date().toISOString() };
  saveUsers(users);
  console.log(`作成しました: ${id} / ${name} / ${ROLES[role]} / ${groups.join(',')}`);
  if (!pwArg) console.log(`初期パスワード（この画面に一度だけ表示）: ${pw}`);
  console.log(`保存先: ${dataDir()}`);
})();
