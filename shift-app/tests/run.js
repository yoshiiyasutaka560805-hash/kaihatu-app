// 使い方: node tests/run.js <取込テキスト(TSV)ファイル>
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const code = html.split('//#ENGINE-START')[1].split('//#ENGINE-END')[0];
const api = new Function(code + '; return {importText,validateAll,generateAll,unitsOf,toTSV,inferNeeds,dayInfo};')();
const S = api.importText(fs.readFileSync(process.argv[2], 'utf8'));
console.log('ym', S.y, S.m, 'D', S.D, 'sections', S.sections.map(s => s.title + (s.auto ? '*' : '')).join(' | '));
console.log('staff', S.staff.length, 'auto units', api.unitsOf(S).map(u => u.key + ':' + u.staff.length).join(', '));
console.log(JSON.stringify(S.needs));
const sum = v => { const E = v.issues.filter(x => x.sev === 'E'); return `score=${v.score} E=${E.length} W=${v.issues.length - E.length}`; };
let v = api.validateAll(S); console.log('手作業の表:', sum(v));
const cnt = {}; v.issues.forEach(x => cnt[x.msg.replace(/\d+/g, 'N')] = (cnt[x.msg.replace(/\d+/g, 'N')] || 0) + 1);
console.log(cnt);
const t0 = Date.now(); api.generateAll(S, 'rebuild'); console.log('生成', Date.now() - t0, 'ms');
v = api.validateAll(S); console.log('自動作成後:', sum(v));
const c2 = {}; v.issues.forEach(x => c2[x.msg.replace(/\d+/g, 'N')] = (c2[x.msg.replace(/\d+/g, 'N')] || 0) + 1);
console.log(c2);
const u = api.unitsOf(S)[0]; u.staff.forEach(t => console.log(t.name.padEnd(8), t.cells.map(c => (c || '・').padEnd(2, '　').slice(0, 3)).join(' ')));
