// 勤怠向け出力（CSV生成の純粋関数）のテスト: node tests/run4.js <TSV>
const fs = require('fs'), assert = require('assert');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const eng = html.split('//#ENGINE-START')[1].split('//#ENGINE-END')[0];
const exp = html.split('// ==== EXPORT-START ====')[1].split('// ==== EXPORT-END ====')[0];
const api = new Function('const $=()=>null,esc=s=>String(s),emptyState=()=>"",show=()=>{},document={addEventListener(){}};' + eng + exp +
  ';return {importText,validateAll,buildAttendanceCsv,buildAttendanceRows,buildCodeTable,buildCodeCsv,exportCheck,expCsvCell};')();
const S = api.importText(fs.readFileSync(process.argv[2], 'utf8'));
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('ok', m); };
// 行数 = 非空セル数
const nonEmpty = S.staff.reduce((a, t) => a + t.cells.filter(Boolean).length, 0);
const r = api.buildAttendanceCsv(S);
ok(r.count === nonEmpty && r.lines.length === nonEmpty + 1, `行数 ${r.count} = 非空セル数`);
ok(r.bom.charCodeAt(0) === 0xFEFF && !r.csv.startsWith('﻿'), 'BOMはbomのみ');
ok(r.header.join(',') === '職員ID,氏名,部署,日付,記号,パターンコード,パターン名,始業,終業,休憩(h),実働(h),備考', '既定ヘッダ');
const rows = api.buildAttendanceRows(S);
ok(rows.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x.date)) && rows[0].date === `${S.y}-${String(S.m).padStart(2, '0')}-01`, '日付 YYYY-MM-DD');
const k = rows.find(x => x.sym === '公'); ok(k && k.code === '996', '公→996');
const y = rows.find(x => x.sym === '有休'); if (y) ok(y.code === '997', '有休→997');
const noKou = api.buildAttendanceCsv(S, { koukyu: false });
ok(noKou.count === nonEmpty - (r.bySym['公'] || 0) && !noKou.bySym['公'], '公休なしオプション');
ok(Object.values(r.bySym).reduce((a, b) => a + b, 0) === r.count, '記号別件数の合計');
const c2 = api.buildAttendanceCsv(S, { cols: ['date', 'name', 'code'] });
ok(c2.header.join() === '日付,氏名,パターンコード' && c2.lines[1].split(',').length >= 3, '列の選択・順序');
// エスケープ
const T = S.staff[0], keepName = T.name, keepMemo = T.memo; T.name = '架空,太郎'; T.memo = '引用"符"\n改行';
const e = api.buildAttendanceCsv(S, { cols: ['name', 'memo', 'sym'] });
ok(e.lines[1].startsWith('"架空,太郎","引用""符""\n改行",'), 'カンマ・引用符・改行のエスケープ');
T.name = keepName; T.memo = keepMemo;
ok(api.expCsvCell('a') === 'a' && api.expCsvCell('a,b') === '"a,b"', 'expCsvCell');
// 職員ID・チェック
S.staff[0].empId = 'E001';
const r2 = api.buildAttendanceRows(S); ok(r2[0].empId === 'E001', '職員ID反映');
const ck = api.exportCheck(S); ok(ck.noId.length >= 1, `職員ID未入力 ${ck.noId.length}名`);
ok(typeof ck.errs === 'number', 'エラー件数 ' + ck.errs);
const tb = api.buildCodeTable(S); ok(tb.some(x => x.sym === '公' && x.code === '996'), '対応表');
ok(api.buildCodeCsv(S).split('\r\n')[0] === '記号,パターンコード,パターン名,始業,終業,休憩(h),実働(h),今月の使用数', '対応表CSVヘッダ');
console.log('run4 全', n, '件OK');
