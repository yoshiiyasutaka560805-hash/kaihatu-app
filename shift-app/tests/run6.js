// 夜勤の均等化・個別制限（夜勤上限・連続勤務上限・夜勤不可）のテスト: node tests/run6.js
const fs = require('fs'), cp = require('child_process');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const code = html.split('//#ENGINE-START')[1].split('//#ENGINE-END')[0];
const api = new Function(code + '; return {importText,validateAll,generateAll,unitsOf,spreadOf,awayDays};')();
const tsv = cp.execFileSync('node', [__dirname + '/gen_fixture.js', '2026', '10', process.argv[2] || '7'], { encoding: 'utf8', maxBuffer: 1 << 26 });
const S = api.importText(tsv);
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
// 個別制限
const units = api.unitsOf(S), U = units[0];
const a = U.staff.find(t => t.canNight), b = U.staff.filter(t => t.canNight)[1], c = U.staff.filter(t => t.canJun)[0];
a.nightMax = 1; b.canNight = false; c.junMax = 0;
const part = S.staff.find(t => !t.auto && t.part && t.part.restSym === '公'); if (part) part.maxConsec = 3;
api.generateAll(S, 'rebuild');
const cnt = (t, k) => t.cells.filter(x => x === k).length;
ok(cnt(a, '夜') <= 1, `夜勤の月上限1回：${cnt(a, '夜')}回`);
ok(cnt(b, '夜') === 0, `夜勤不可の職員に夜勤なし：${cnt(b, '夜')}回`);
ok(cnt(c, '準夜勤') === 0, `準夜勤の上限0回：${cnt(c, '準夜勤')}回`);
if (part){ let run = 0, mx = 0; part.cells.forEach(v => { if (v && v !== '公' && !/休/.test(v)) { run++; mx = Math.max(mx, run); } else run = 0; }); ok(mx <= 3, `非常勤の連続勤務上限3日：最長${mx}日`); }
// 均等性：出られる日数が7割以上・個別指定なしの職員で、各グループの回数差が1以内か
for (const u of api.unitsOf(S)){
  for (const [key, can] of [['夜', 'canNight'], ['準夜勤', 'canJun']]){
    for (const lab of (key === '夜' ? u.labels : [null])){
      const m = u.staff.filter(t => (lab === null || t.label === lab) && t[can] && t.nightFixed == null && (key === '夜' ? t.nightMax == null : t.junMax == null) && api.awayDays(S, t) <= S.D * 0.2);
      if (m.length < 2) continue; const n = m.map(t => cnt(t, key)), df = Math.max(...n) - Math.min(...n);
      ok(df <= 1, `${u.key}${lab ? ' ' + lab : ''} ${key}の回数差 ${df}（${Math.min(...n)}〜${Math.max(...n)}回・${m.length}名）`);
    }
  }
}
const v = api.validateAll(S); const E = v.issues.filter(x => x.sev === 'E');
ok(!E.some(x => /上限/.test(x.msg)), '上限超過のエラーなし');
console.log(fail ? 'FAILED ' + fail : 'ALL PASS'); process.exit(fail ? 1 : 0);
