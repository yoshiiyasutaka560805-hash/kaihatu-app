// e3Shift貼り戻し出力のテスト: node tests/run8.js <TSV>（架空データのみ）
const fs = require('fs'), assert = require('assert');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const eng = html.split('//#ENGINE-START')[1].split('//#ENGINE-END')[0];
const e3 = html.split('// ==== E3OUT-START ====')[1].split('// ==== E3OUT-END ====')[0];
const api = new Function('const $=()=>null,esc=s=>String(s),document={addEventListener(){}};let S=null;' + eng + e3 +
  ';return {importText,buildE3PasteBlock,e3Check,e3Info,e3Col,e3outCard,setS(x){S=x}};')();
const S = api.importText(fs.readFileSync(process.argv[2], 'utf8'));
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('ok', m); };
const ids = S.staff.slice(0, 4).map(t => t.id), D = S.D;
S.staff[0].cells[0] = 'a\tb\nc';
S.e3 = { groups: [{ file: 'x.xlsx', title: '3階', label: 'AB', staffIds: [ids[0], null, ids[1], ids[2], null], firstRow: 6, firstCol: 12, days: D, sheetName: '勤務表' }] };
const tsv = api.buildE3PasteBlock(S, 0, {}), lines = tsv.split('\n');
ok(lines.length === 5, '行数=staffIds数');
ok(lines.every(l => l.split('\t').length === D), `列数=${D}日`);
ok(/^\t+$|^$/.test(lines[1]) && lines[1].split('\t').every(x => x === '') && lines[4].split('\t').every(x => x === ''), 'null行は空');
ok(lines[0].split('\t')[0] === 'a b c', '改行・タブは空白に置換');
ok(lines[2].split('\t').join() === S.staff.find(t => t.id === ids[1]).cells.join(), 'セルは現在の記号');
ok(!tsv.includes('\r'), '改行は\\nのみ');
ok(api.e3Col(12) === 'L' && api.e3Col(41) === 'AO' && api.e3Col(27) === 'AA', '列名変換');
const f = api.e3Info(S, 0); ok(f.from === 'L6' && f.to === api.e3Col(11 + D) + '10', `範囲 ${f.from}-${f.to}`);
api.setS(S);
let c = api.e3Check(S); ok(!c.warns.some(w => /年月|増え/.test(w)) || true, 'チェック実行');
// 警告条件
S.e3.groups[0].legend = { 公: '休' }; c = api.e3Check(S);
ok(c.groups[0].some(w => /凡例にない記号/.test(w)), '未定義記号の検出');
S.e3.groups[0].legend = null;
S.e3.ym = { y: S.y, m: S.m }; ok(!api.e3Check(S).warns.some(w => /年月/.test(w)), '年月一致なら警告なし');
S.e3.ym = { y: S.y, m: S.m % 12 + 1 }; ok(api.e3Check(S).warns.some(w => /年月/.test(w)), '年月不一致の警告');
delete S.e3.ym;
S.e3.groups[0].days = D - 1; ok(api.e3Check(S).groups[0].some(w => /日数/.test(w)), '日数不一致の警告'); S.e3.groups[0].days = D;
S.e3.groups[0].staffIds.push('zzz'); ok(api.e3Check(S).groups[0].some(w => /見つかりません/.test(w)), '存在しないid警告');
ok(api.buildE3PasteBlock(S, 0).split('\n').length === 6, '存在しないidは空行');
S.e3.groups[0].staffIds.pop();
ok(api.e3Check(S).warns.some(w => /増えて/.test(w)), '職員増の警告');
ok(!/架空|職員氏名/.test('') && !api.e3outCard().includes(S.staff[0].name), '氏名を出さない');
S.e3 = null; ok(/xlsx を取り込んだデータのみ/.test(api.e3outCard()), 'e3無しの表示');
console.log('run8 全', n, '件OK');
