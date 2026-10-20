// 希望休・非常勤・新月のテスト: node tests/run2.js <TSV>
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const code = html.split('//#ENGINE-START')[1].split('//#ENGINE-END')[0];
const api = new Function(code + '; return {importText,validateAll,generateAll,newMonth,applyRequests};')();
const S = api.importText(fs.readFileSync(process.argv[2], 'utf8'));
const show = t => console.log(t.name.padEnd(8), t.cells.map(c => (c || '・').padEnd(3, '　').slice(0, 4)).join(' '));
S.staff.filter(t => !t.auto).forEach(t => console.log(t.name, JSON.stringify(t.part)));
// 希望休を追加
const a = S.staff.find(t => t.name === '山中 菜々'); a.req[10] = '希望休'; a.req[11] = '希望休';
const b = S.staff.find(t => t.name === '今関 悠'); b.req[8] = '有休';
api.generateAll(S, 'rebuild');
const v = api.validateAll(S); console.log('E', v.issues.filter(x => x.sev === 'E').length, 'W', v.issues.filter(x => x.sev === 'W').length);
[a, b, ...S.staff.filter(t => !t.auto)].forEach(show);
const nights = S.staff.filter(t => t.auto && t.canNight).map(t => t.cells.filter(c => c === '夜').length); console.log('夜回数', nights.join(','));
const jun = S.staff.filter(t => t.auto && t.canJun).map(t => t.cells.filter(c => c === '準夜勤').length); console.log('準夜回数', jun.join(','));
console.log('山中の11,12日', a.cells[10], a.cells[11]);
api.newMonth(S, 2026, 11); console.log('新月', S.y, S.m, S.D, S.staff[0].cells.length, S.staff.filter(t => t.cells[0] === '／').map(t => t.name));
api.generateAll(S, 'rebuild'); const v2 = api.validateAll(S); console.log('11月 E', v2.issues.filter(x => x.sev === 'E').length);
