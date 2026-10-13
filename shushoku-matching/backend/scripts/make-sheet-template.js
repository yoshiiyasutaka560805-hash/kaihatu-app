'use strict';

// 条件表テンプレート（Excel）を生成：node scripts/make-sheet-template.js
// 出力先：frontend/public/joken-template.xlsx（画面からダウンロード）
const path = require('path');
const ExcelJS = require('exceljs');

const ROWS = [
  ['基本情報', null, null],
  ['氏名', '', '必須'], ['フリガナ', '', ''], ['生年月日', '', '例：1990/4/1'], ['電話番号', '', ''], ['メールアドレス', '', ''], ['住所', '', ''],
  ['通勤・勤務地', null, null],
  ['都道府県', '', '例：大阪府'], ['市区町村', '', '例：堺市'], ['最寄り駅', '', ''], ['通勤可能な市区町村', '', '例：和泉市,高石市（カンマ区切り）'],
  ['通勤手段', '', '例：車,公共交通'], ['通勤時間の上限（分）', '', '例：40'],
  ['希望の仕事', null, null],
  ['希望職種', '', '例：介護'], ['希望職務', '', '介護職/生活相談員/看護職/ケアマネ/機能訓練/送迎/調理/事務/その他'],
  ['希望施設', '', '特養/老健/介護医療院/GH/有料/サ高住/デイ/訪問/小多機/障害/病院/保育/その他'], ['希望しない施設', '', ''],
  ['希望雇用形態', '', '例：正社員,パート'], ['賃金形態', '', '月給/時給/日給/年俸'], ['希望賃金', '', '例：22万'],
  ['働き方', null, null],
  ['勤務可能時間（開始）', '', '例：8:30'], ['勤務可能時間（終了）', '', '例：18:00'], ['夜勤・交替制', '', '可/不可'],
  ['夜勤回数の上限（月）', '', '例：4（0=不可）'], ['夜勤専従希望', '', 'はい/いいえ'], ['週の勤務日数上限', '', '例：5'],
  ['希望年間休日', '', '例：105'], ['就業可能日', '', '例：2026/11/1'],
  ['資格・経験', null, null],
  ['保有資格', '', '例：介護福祉士,普通自動車免許'], ['経験年数', '', '例：3'], ['職務経歴', '', ''], ['優先順位', '', '例：家から近いこと、夜勤なし'],
  ['外国籍の方', null, null],
  ['外国籍', '', 'はい/いいえ'], ['在留資格', '', '例：特定技能1号'], ['在留期限', '', ''], ['日本語能力', '', 'N1〜N5/なし'],
  ['介護日本語評価試験', '', '合格/未'], ['技能試験', '', '例：介護技能評価試験'],
  ['その他', null, null], ['備考', '', '本籍・宗教・家族の職業などは記入不要です'],
];

(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('条件表');
  ws.columns = [{ header: '項目', width: 26 }, { header: '記入欄', width: 40 }, { header: '記入例・選択肢', width: 60 }];
  ws.getRow(1).font = { bold: true };
  for (const [label, value, hint] of ROWS) {
    const row = ws.addRow([label, value ?? '', hint ?? '']);
    if (value === null) { row.font = { bold: true, color: { argb: 'FFFFFFFF' } }; row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; }
    else { row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }; row.getCell(3).font = { color: { argb: 'FF6B7280' } }; }
  }
  const out = path.join(__dirname, '..', '..', 'frontend', 'public', 'joken-template.xlsx');
  await wb.xlsx.writeFile(out);
  console.log('written', out);
})();
