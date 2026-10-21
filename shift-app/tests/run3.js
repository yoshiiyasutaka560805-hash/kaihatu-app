// 祝日・台帳（採用/退職/休職・入れるシフト）のテスト: node tests/run3.js <TSV>
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const code = html.split('//#ENGINE-START')[1].split('//#ENGINE-END')[0];
const api = new Function(code + '; return {importText,validateAll,generateAll,jpHolidays,unavail};')();
const H = api.jpHolidays(2026); console.log('2026祝日', Object.keys(H).length, ['2026-05-06', '2026-09-22', '2026-09-23', '2026-10-12', '2026-03-20'].map(k => k + ':' + (H[k] || '-')).join(' '));
const H27 = api.jpHolidays(2027); console.log('2027', ['2027-03-21', '2027-03-22', '2027-09-23', '2027-01-11'].map(k => k + ':' + (H27[k] || '-')).join(' '));
const S = api.importText(fs.readFileSync(process.argv[2], 'utf8'));
console.log('取込月の祝日', S.holidays);
const autos = S.staff.filter(t => t.auto), a = autos[0], b = autos[1], c = S.staff.find(t => !t.auto && t.part);
a.hireDate = '2026-10-10'; b.leaveStart = '2026-10-05'; b.leaveEnd = '2026-10-12'; c.holidayOk = false; c.retireDate = '2026-10-25';
S.staff.filter(t => t.auto).slice(2, 5).forEach(t => { t.canEarly = false; });
api.generateAll(S, 'rebuild'); const v = api.validateAll(S);
const cnt = {}; v.issues.forEach(x => { const k = x.sev + ' ' + x.msg.replace(/\d+/g, 'N'); cnt[k] = (cnt[k] || 0) + 1; }); console.log(cnt);
console.log('採用日あり 1-12日', a.cells.slice(0, 12).join(','));
console.log('休職あり 4-13日', b.cells.slice(3, 13).join(','));
console.log('祝日出勤不可・退職あり 全', c.cells.join(','));
console.log('早なし職員の早:', S.staff.filter(t => t.auto).slice(2, 5).map(t => t.cells.filter(x => x === '早').length));
