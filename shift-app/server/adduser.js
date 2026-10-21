#!/usr/bin/env node
'use strict';
// 使い方:
//   node server/adduser.js <職員ID> <氏名> <role> <グループ,グループ> [パスワード]
//   node server/adduser.js --csv <ファイル.csv> [--out <出力ファイル>] [--dry-run]
//        CSV列: 職員ID,氏名,ロール,グループ（グループは ; 区切り。1行目の見出しは任意）
//        初期パスワードはランダム生成し標準出力にのみ表示（--out 指定時は 0600 の新規ファイルにのみ書き、標準出力には出さない）
//   node server/adduser.js --passwd <職員ID> [新パスワード]
//   node server/adduser.js --disable <職員ID> / --enable <職員ID>
//   node server/adduser.js --grant finalize <職員ID> / --revoke finalize <職員ID>
//        「確定（ロック）・確定解除」の権限フラグ（canFinalize）を付け外し。admin は常に可能。
//   node server/adduser.js --list
// 共通オプション: --no-change-required  初期/再発行パスワードの「初回ログイン時の変更必須」を付けない（自動化・テスト用）
// role: admin(システム管理者) / editor(編集者：全部署の下書きを編集。監査ログ閲覧・確定は不可) / manager1(管理者Ⅰ) / manager2(管理者Ⅱ) / staff(一般職員)
// グループ = 勤務表の部署名（例 2階,3階）。admin・editor は全部署のため '*' でよい。
const fs = require('fs');
const crypto = require('crypto');
const { ROLES, hashPassword, loadUsers, saveUsers, dataDir } = require('./userstore');

const ALPHA = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genPassword(n = 16) { let s = ''; while (s.length < n) { const b = crypto.randomBytes(1)[0]; if (b < 256 - (256 % ALPHA.length)) s += ALPHA[b % ALPHA.length]; } return s; }
function die(m) { console.error('エラー: ' + m); process.exit(1); }
function checkPw(p) { if (p.length < 12) die('パスワードは12文字以上にしてください'); }
const ID_RE = /^[A-Za-z0-9_.@-]{1,40}$/;

// 簡易CSVパーサ（引用符・改行・BOM対応）
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], cur = '', q = false, line = 1, start = 1;
  const endRow = () => { row.push(cur); cur = ''; if (row.some(c => c.trim() !== '')) rows.push({ line: start, cells: row }); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else { if (c === '\n') line++; cur += c; } continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { endRow(); line++; start = line; }
    else cur += c;
  }
  if (cur !== '' || row.length) endRow();
  return rows;
}

(async () => {
  const raw = process.argv.slice(2), a = [];
  const opt = { noChange: false, dry: false, csv: null, out: null };
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '--no-change-required') opt.noChange = true;
    else if (raw[i] === '--dry-run') opt.dry = true;
    else if (raw[i] === '--out') { opt.out = raw[++i]; if (!opt.out) die('--out にはファイル名が必要です'); }
    else if (raw[i] === '--csv') { opt.csv = raw[++i]; if (!opt.csv) die('--csv にはファイル名が必要です'); }
    else a.push(raw[i]);
  }
  const users = loadUsers();
  const now = () => new Date().toISOString();

  if (opt.csv) {
    let text; try { text = fs.readFileSync(opt.csv, 'utf8'); } catch (e) { die('CSVを読めません: ' + e.message); }
    let rows = parseCsv(text);
    if (rows.length && rows[0].cells[0].trim() === '職員ID') rows = rows.slice(1);
    if (!rows.length) die('CSVに登録対象の行がありません');
    const errs = [], seen = new Set(), list = [];
    for (const { line, cells } of rows) {
      const [id0, name0, role0, groups0] = cells.map(s => s.trim());
      const e = m => errs.push(`${line}行目: ${m}`);
      const id = id0 || '', name = name0 || '', role = role0 || '';
      if (cells.length > 4 && cells.slice(4).some(c => c.trim())) e('列が多すぎます（グループは ; 区切りで1列に）');
      if (!ID_RE.test(id)) e(`職員ID「${id}」が不正です（英数字と _ . @ - のみ、40文字まで）`);
      if (!name || name.length > 50 || /[\u0000-\u001f]/.test(name)) e('氏名が空、または不正です');
      if (!Object.prototype.hasOwnProperty.call(ROLES, role)) e(`ロール「${role}」が不正です（admin / editor / manager1 / manager2 / staff）`);
      if (id && seen.has(id)) e(`職員ID「${id}」がCSV内で重複しています`);
      if (id && Object.prototype.hasOwnProperty.call(users, id)) e(`職員ID「${id}」は既に登録済みです`);
      seen.add(id);
      const groups = (role === 'admin' || role === 'editor') ? ['*'] : (groups0 || '').split(';').map(s => s.trim()).filter(Boolean);
      if (role !== 'admin' && role !== 'editor' && ROLES[role] && !groups.length) e('グループ（部署名）が必要です');
      if (groups.some(g => /[\u0000-\u001f,]/.test(g))) e('グループ名に使えない文字があります');
      list.push({ id, name, role, groups });
    }
    if (errs.length) { console.error('エラー: CSVに問題があるため、1件も登録していません。'); errs.forEach(m => console.error('  ' + m)); process.exit(1); }
    if (opt.dry) { console.log(`検証OK: ${list.length} 件（--dry-run のため登録していません）`); return; }
    if (opt.out && fs.existsSync(opt.out)) die('--out のファイルが既に存在します（上書きしません）: ' + opt.out);
    const lines = ['職員ID\t氏名\tロール\tグループ\t初期パスワード'];
    for (const u of list) {
      const pw = genPassword();
      users[u.id] = { name: u.name, role: u.role, groups: u.groups, hash: await hashPassword(pw), createdAt: now() };
      if (!opt.noChange) users[u.id].mustChange = true;
      lines.push([u.id, u.name, u.role, u.groups.join(';'), pw].join('\t'));
    }
    saveUsers(users);
    if (opt.out) {
      try { fs.writeFileSync(opt.out, lines.join('\n') + '\n', { mode: 0o600, flag: 'wx' }); } catch (e) { console.error('警告: 出力ファイルを書けませんでした。ユーザーは登録済みです。--passwd で再発行してください: ' + e.message); process.exit(2); }
      console.log(`登録しました: ${list.length} 件。初期パスワード一覧を ${opt.out}（0600）に書き出しました。配布後は安全に削除してください。`);
    } else {
      console.log('初期パスワード一覧（この画面にのみ表示。控えを安全に保管/配布し、画面履歴は消去してください）');
      lines.forEach(l => console.log(l));
      console.log(`登録しました: ${list.length} 件 / 保存先: ${dataDir()}`);
    }
    if (!opt.noChange) console.log('※ 初回ログイン時に本人によるパスワード変更が必須です。');
    return;
  }

  if (a[0] === '--list') {
    const rows = Object.entries(users);
    if (!rows.length) console.log('(ユーザーなし)');
    for (const [id, u] of rows) console.log(`${id}\t${u.name}\t${u.role}\t${(u.groups || []).join(',')}${u.canFinalize ? '\t[確定権限]' : ''}${u.disabled ? '\t[無効]' : ''}${u.mustChange ? '\t[要PW変更]' : ''}`);
    return;
  }
  if (a[0] === '--passwd') {
    const id = a[1]; if (!id || !users[id]) die('職員IDが見つかりません');
    const pw = a[2] || genPassword(); checkPw(pw);
    users[id].hash = await hashPassword(pw); users[id].pwChangedAt = now();
    if (opt.noChange) delete users[id].mustChange; else users[id].mustChange = true;
    saveUsers(users);
    console.log(a[2] ? 'パスワードを更新しました（既存のログインは失効します）。' : `新しいパスワード（この画面に一度だけ表示）: ${pw}`);
    return;
  }
  if (a[0] === '--grant' || a[0] === '--revoke') {
    const flag = a[1], id = a[2];
    if (flag !== 'finalize') die('付け外しできる権限は finalize（確定）のみです');
    if (!id || !users[id]) die('職員IDが見つかりません');
    if (a[0] === '--grant') users[id].canFinalize = true; else delete users[id].canFinalize;
    saveUsers(users); console.log(`${id}: 確定権限を${a[0] === '--grant' ? '付与' : '取り消'}しました` + (users[id].role === 'admin' ? '（admin は常に確定できます）' : '')); return;
  }
  if (a[0] === '--disable' || a[0] === '--enable') {
    const id = a[1]; if (!id || !users[id]) die('職員IDが見つかりません');
    users[id].disabled = a[0] === '--disable'; saveUsers(users); console.log('更新しました'); return;
  }
  const [id, name, role, groupsArg, pwArg] = a;
  if (!id || !name || !role) die('使い方: node server/adduser.js <職員ID> <氏名> <role> <グループ,グループ> [パスワード]  または --csv ファイル');
  if (!ID_RE.test(id)) die('職員IDは英数字と _ . @ - のみ（40文字まで）');
  if (!ROLES[role]) die('role は admin / editor / manager1 / manager2 / staff のいずれか');
  if (users[id]) die('その職員IDは既に存在します（パスワード変更は --passwd）');
  const groups = (role === 'admin' || role === 'editor') ? ['*'] : (groupsArg || '').split(',').map(s => s.trim()).filter(Boolean);
  if (role !== 'admin' && role !== 'editor' && !groups.length) die('グループ（部署名）を指定してください');
  const pw = pwArg || genPassword(); checkPw(pw);
  users[id] = { name, role, groups, hash: await hashPassword(pw), createdAt: now() };
  if (!opt.noChange) users[id].mustChange = true;
  saveUsers(users);
  console.log(`作成しました: ${id} / ${name} / ${ROLES[role]} / ${groups.join(',')}`);
  if (!pwArg) console.log(`初期パスワード（この画面に一度だけ表示）: ${pw}`);
  if (!opt.noChange) console.log('※ 初回ログイン時に本人によるパスワード変更が必須です。');
  console.log(`保存先: ${dataDir()}`);
})();
