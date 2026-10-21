// 本番規模（職員約130名・夜勤4フロア）の検証。架空データのみ。
// 実行: node tests/run5.js [--quick]   （結果を表で出力。FAIL があれば終了コード1）
'use strict';
const fs = require('fs');
const { build } = require('./gen_fixture.js');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const code = html.split('//#ENGINE-START')[1].split('//#ENGINE-END')[0];
const api = new Function(code + `; return {importText,validateAll,generateAll,genUnit,genPart,calcFte,newMonth,applyRequests,jpHolidays,unavail,unitsOf,dayInfo,dowOf,toTSV,parseTSV,syncHolidays,normSym,cls,isWorkish,hmToH};`)();
const rows = []; let fails = 0;
let warns = 0;
// soft=true：設計上の既知課題（WARN・終了コードに影響しない）。false=確定した不具合（FAIL）
const rec = (id, item, ok, detail, soft) => { const r = ok === null ? 'INFO' : ok ? 'PASS' : soft ? 'WARN' : 'FAIL'; rows.push([id, item, r, detail]); if (r === 'FAIL') fails++; if (r === 'WARN') warns++; };
const ms = f => { const t0 = process.hrtime.bigint(); const r = f(); return [r, Number(process.hrtime.bigint() - t0) / 1e6]; };
const imp = (tsv) => api.importText(tsv);
const sum = a => a.reduce((x, y) => x + y, 0);

// ---- 共通の指標 ----
function metrics(S, from = 0){
  const v = api.validateAll(S);
  const o = { E: 0, W: 0, minStaff: 0, consec: 0, restE: 0, ake: 0, other: 0, maxRun: 0, restBad: 0, nightSpread: 0, junSpread: 0, bytype: {} };
  for (const x of v.issues){
    if (from && x.d >= 0 && x.d < from) continue;
    o[x.sev]++;
    if (x.sev === 'E'){
      if (/最低/.test(x.msg)) o.minStaff++; else if (/連続勤務/.test(x.msg)) o.consec++; else if (/公休が/.test(x.msg)) o.restE++;
      else if (/明け|夜勤の翌日/.test(x.msg)) o.ake++; else o.other++;
    }
  }
  o.maxRunPart = 0; o.partRuns = 0;
  for (const t of S.staff){
    let run = 0; t.cells.forEach(c => { if (api.isWorkish(c)){ run++; if (t.auto) o.maxRun = Math.max(o.maxRun, run); else { o.maxRunPart = Math.max(o.maxRunPart, run); if (run === S.maxConsec + 1) o.partRuns++; } } else run = 0; });
    if (t.auto && t.target > 0 && t.cells.filter(c => c === '公').length !== t.target) o.restBad++;
  }
  for (const U of api.unitsOf(S)){
    const n = U.staff.filter(t => t.canNight && t.nightFixed == null).map(t => t.cells.filter(c => c === '夜').length);
    const j = U.staff.filter(t => t.canJun).map(t => t.cells.filter(c => c === '準夜勤').length);
    if (n.length) o.nightSpread = Math.max(o.nightSpread, Math.max(...n) - Math.min(...n));
    // 採用日・休職・休暇で出られる日数が少ない人を除いた「通常の人」だけの差
    const nf = U.staff.filter(t => t.canNight && t.nightFixed == null && t.from === 0 && !t.cells.some(c => api.cls(c) === 'leave')).map(t => t.cells.filter(c => c === '夜').length);
    if (nf.length) o.nightSpreadFull = Math.max(o.nightSpreadFull || 0, Math.max(...nf) - Math.min(...nf));
    if (j.length) o.junSpread = Math.max(o.junSpread, Math.max(...j) - Math.min(...j));
  }
  o.score = v.score; return o;
}
const fmt = m => `E${m.E}(最低${m.minStaff}/連勤${m.consec}/公休${m.restE}/明け${m.ake}/他${m.other}) W${m.W} 夜差${m.nightSpread}(通常職員のみ${m.nightSpreadFull}) 準夜差${m.junSpread} 最長連勤${m.maxRun}(日勤系${m.maxRunPart})`;

const base = build({ y: 2026, m: 10, seed: 20261 });

// ===== a. 取込 =====
{
  const [S, t] = ms(() => imp(base.tsv));
  const titles = S.sections.map(s => s.title);
  rec('a', 'セクション数（期待10：2〜5階+介護助手+相談員+事務+デイ+看護+居宅=9→2,3,4,5,助手,相談,事務,デイ,看護,居宅）', S.sections.length === 10, `${S.sections.length}件 ${titles.join('/')}`);
  rec('a', '職員数', S.staff.length === base.total, `取込${S.staff.length} / 生成${base.total}`);
  const autoSecs = S.sections.filter(s => s.auto).map(s => s.title);
  rec('a', '自動作成対象=夜勤4フロアのみ', autoSecs.join() === '2階,3階,4階,5階', autoSecs.join());
  const autoN = S.staff.filter(t => t.auto).length, stuAuto = S.staff.filter(t => /\(学\)/.test(t.name) && t.auto).length;
  rec('a', '学生バイト・産休者は自動対象外', stuAuto === 0, `自動対象${autoN}名／学生で自動=${stuAuto}`);
  const partNo = S.staff.filter(t => !t.auto && !t.part).map(t => t.name);
  rec('a', '非自動で働き方が推定できない職員（産休等）', null, `${partNo.length}名 ${partNo.slice(0, 3).join(',')}`);
  const part = S.staff.filter(t => t.part && t.koyo === '非' && /^\d/.test(t.part.sym));
  const okDow = part.filter(t => t.part.allowed.some(Boolean)).length;
  rec('a', '非常勤の個別条件推定（記号・曜日・日数）', part.length > 10 && okDow === part.length, `${part.length}名推定 例:${part[0] && part[0].part.sym}/週${part[0] && part[0].part.perWeek}`);
  const names = new Set(S.staff.map(t => t.name));
  rec('a', '氏名の前後空白・全角空白の正規化', ![...names].some(n => /^\s|\s$|　/.test(n)), `重複なし=${names.size === S.staff.length}`);
  const quoted = S.staff.filter(t => t.cells.some(c => /17時/.test(c))).length;
  rec('a', '引用符つき改行セルの取込（"日\\n17時"）', quoted > 0 && S.staff.every(t => t.cells.length === S.D), `${quoted}名 / 全員D=${S.D}列`);
  const unk = S.staff.reduce((a, t) => a + t.cells.filter(c => api.cls(c) === 'work' && !/^(早|日|遅|遅E|夜|準夜勤|\d+(\.\d+)?-\d+(\.\d+)?)$/.test(c)).length, 0);
  rec('a', '時間の無い特殊記号（AM休/PM休/こもり/改行入り）の件数', null, `${unk}セル`);
  rec('a', '取込時間', t < 1000, `${t.toFixed(0)}ms`);
  global.__S0 = S;
}

// ===== b. 一括作成 =====
function freshBig(){ return imp(base.tsv); }
for (const mode of ['rebuild', 'fill']){
  const S = freshBig();
  if (mode === 'fill'){ // 後半10日を空欄にして追記モード
    for (const t of S.staff) if (t.auto) for (let d = S.D - 10; d < S.D; d++){ if (!t.pins[d]) t.cells[d] = ''; }
  }
  const [, t] = ms(() => api.generateAll(S, mode));
  const m = metrics(S, mode === 'fill' ? S.D - 10 + 1 : 0);
  rec('b', `一括作成(${mode}) 所要時間（目標10s以内）`, t < 10000, `${(t / 1000).toFixed(2)}s`);
  rec('b', `一括作成(${mode}) 結果${mode === 'fill' ? '（追記した後半10日のみ集計）' : ''}`, m.E <= 5, fmt(m));
  rec('b', `一括作成(${mode}) 夜勤の均等性（最大−最小≦1）`, m.nightSpread <= 1 && m.junSpread <= 1, `夜勤差${m.nightSpread}(通常職員のみ${m.nightSpreadFull}) / 準夜勤差${m.junSpread}`, true);
  rec('b', `一括作成(${mode}) 公休数一致`, m.restBad === 0, `不一致${m.restBad}名`);
  rec('b', `一括作成(${mode}) 連続勤務上限(5)`, m.maxRun <= 5, `最長${m.maxRun}日 / 超過E${m.consec}`);
  rec('b', `一括作成(${mode}) 最低人員違反`, m.minStaff === 0, `${m.minStaff}件`, true);
  if (mode === 'rebuild') global.__R = S;
}
{ // 希望休を大量に入れる（充足不能の挙動）
  for (const [label, perPerson, sameDay] of [['各自3〜5日(分散)', 4, false], ['全員が同じ2日に集中', 2, true], ['全員に10日(過大)', 10, false]]){
    const S = freshBig(); const rnd = (() => { let a = 7; return () => (a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
    for (const t of S.staff){
      if (!t.auto) continue;
      if (sameDay){ t.req[9] = '希望休'; t.req[10] = '希望休'; continue; }
      for (let k = 0; k < perPerson; k++){ const d = (rnd() * S.D) | 0; if (!t.req[d]) t.req[d] = '希望休'; }
    }
    let err = null, t = 0, m = null;
    try { [, t] = ms(() => api.generateAll(S, 'rebuild')); m = metrics(S); } catch (e){ err = e; }
    rec('b', `希望休：${label}`, !err && t < 20000, err ? '例外 ' + err.message : `${(t / 1000).toFixed(2)}s ${fmt(m)}`);
  }
}

{ // 乱数シードを変えた別データ5種で、所要時間・クラッシュ・エラー件数を確認
  const res = [];
  for (let sd = 1; sd <= 5; sd++){
    const S = imp(build({ y: 2026, m: 10, seed: 900 + sd }).tsv); let err = null, t = 0, m = null;
    try { [, t] = ms(() => api.generateAll(S, 'rebuild')); m = metrics(S); } catch (e){ err = e; }
    res.push(err ? 'ERR:' + err.message : `${(t / 1000).toFixed(1)}s/E${m.E}`);
  }
  rec('b', '別データ5種（seed 901〜905）の一括作成', res.every(x => !/ERR/.test(x) && parseFloat(x) < 10 && +x.split('/E')[1] <= 3), res.join(' '));
}
// ===== c. 月長・月またぎ =====
for (const [y, mo, label] of [[2027, 2, '28日(2027年2月)'], [2028, 2, '29日(閏年2028年2月)'], [2026, 11, '30日(2026年11月)'], [2026, 12, '31日(2026年12月)']]){
  const g = build({ y, m: mo, seed: 777 + mo });
  const S = imp(g.tsv);
  const dow1 = new Date(y, mo - 1, 1).getDay();
  rec('c', `${label} 取込（年月・日数・曜日）`, S.y === y && S.m === mo && S.D === g.D, `${S.y}/${S.m} D=${S.D} 初日曜日=${api.dowOf(S, 0)}(期待${dow1})`);
  const [, t] = ms(() => api.generateAll(S, 'rebuild')); const m = metrics(S);
  rec('c', `${label} 一括作成`, t < 10000 && m.maxRun <= 5 && m.E <= 3, `${(t / 1000).toFixed(2)}s ${fmt(m)}`);
}
{
  const H = api.jpHolidays(2027), H28 = api.jpHolidays(2028);
  rec('c', '祝日 2027（成人1/11・春分3/21→振替3/22・秋分9/23）', H['2027-01-11'] && H['2027-03-21'] && H['2027-03-22'] === '振替休日' && H['2027-09-23'], `元日:${H['2027-01-01']} 成人:${H['2027-01-11']} 振替:${H['2027-03-22']}`);
  rec('c', '祝日 2028（元日が土曜・成人1/10・2/29閏日）', H28['2028-01-01'] && H28['2028-01-10'] === '成人の日' && H28['2028-02-23'] && !H28['2028-02-29'], `${Object.keys(H28).length}件`);
  { // 振替休日・国民の休日・春秋分（既知の年で照合）
    const chk = { 2023: ['2023-01-02:振替休日', '2023-03-21:春分の日', '2023-09-23:秋分の日'], 2024: ['2024-02-12:振替休日', '2024-05-06:振替休日', '2024-08-12:振替休日', '2024-09-23:振替休日', '2024-11-04:振替休日', '2024-03-20:春分の日', '2024-09-22:秋分の日'],
      2025: ['2025-02-24:振替休日', '2025-05-06:振替休日', '2025-11-24:振替休日', '2025-03-20:春分の日', '2025-09-23:秋分の日'], 2026: ['2026-05-06:振替休日', '2026-09-22:国民の休日', '2026-09-23:秋分の日'], 2029: ['2029-04-30:振替休日', '2029-09-24:振替休日'] };
    const ng = []; for (const y in chk){ const Hy = api.jpHolidays(+y); for (const cc of chk[y]){ const [k, n] = cc.split(':'); if (Hy[k] !== n) ng.push(`${k}=${Hy[k]}`); } }
    rec('c', '祝日 2023〜2029 の振替・国民の休日・春秋分（既知日と照合）', ng.length === 0, ng.length ? ng.join(',') : '全一致');
  }
  const S = imp(base.tsv); // 10月 → 11月 → 12月 → 翌1月
  const night = S.staff.filter(t => t.cells[t.cells.length - 1] === '夜').map(t => t.id);
  const seq = [[2026, 11], [2026, 12], [2027, 1]]; let ok = true, det = [];
  api.generateAll(S, 'rebuild');
  for (const [y, m] of seq){
    const lastNight = S.staff.filter(t => t.cells[t.cells.length - 1] === '夜').map(t => t.id);
    api.newMonth(S, y, m);
    const carried = S.staff.filter(t => t.cells[0] === '／').map(t => t.id);
    const same = lastNight.length === carried.length && lastNight.every(id => carried.includes(id));
    api.generateAll(S, 'rebuild'); const mt = metrics(S);
    const hol = S.holidays.join(',');
    const bad = S.staff.filter(t => t.cells.length !== S.D).length;
    if (!same || bad || mt.maxRun > 5 || mt.E > 3) ok = false;
    det.push(`${y}/${m} D=${S.D} 祝日[${hol}] 引継ぎ${carried.length}/${lastNight.length}${same ? '' : '×'} 初日曜=${api.dowOf(S, 0)} E${mt.E} 夜差${mt.nightSpread}`);
  }
  rec('c', '月またぎ 10→11→12→1月（夜勤明け引継ぎ・祝日・曜日）', ok, det.join(' | '));
  const S2 = imp(base.tsv); api.newMonth(S2, 2027, 1);
  rec('c', '2027年1月の祝日(1,11)・曜日(金=5)', S2.holidays.join() === '1,11' && api.dowOf(S2, 0) === 5, `祝日[${S2.holidays}] 初日曜${api.dowOf(S2, 0)}`);
  const S3 = imp(base.tsv); api.newMonth(S3, 2028, 2);
  rec('c', 'newMonth 2028/2 → D=29', S3.D === 29 && S3.staff.every(t => t.cells.length === 29 && t.req.length === 29 && t.pins.length === 29), `D=${S3.D}`);
}

// ===== d. 台帳 =====
{
  const S = freshBig(); const A = S.staff.filter(t => t.auto), P = S.staff.filter(t => t.part && !t.auto && t.koyo === '非');
  const hire = A[3], ret = A[7], leave = A[11], noHol = P[0], noHol2 = P[1];
  hire.hireDate = '2026-10-12'; ret.retireDate = '2026-10-20'; leave.leaveStart = '2026-10-08'; leave.leaveEnd = '2026-10-18';
  noHol.holidayOk = false; noHol2.holidayOk = false;
  const [, t] = ms(() => api.generateAll(S, 'rebuild'));
  const v = api.validateAll(S), m = metrics(S);
  const blank = (p, a, b) => p.cells.slice(a, b).every(c => c === '' || c === '公' && false || c === '');
  rec('d', '採用日(10/12)前は空欄', hire.cells.slice(0, 11).every(c => c === ''), hire.cells.slice(0, 13).join(','));
  rec('d', '退職日(10/20)後は空欄', ret.cells.slice(20).every(c => c === ''), ret.cells.slice(17).join(','));
  rec('d', '休職(10/8〜10/18)は空欄', leave.cells.slice(7, 18).every(c => c === ''), leave.cells.slice(6, 20).join(','));
  rec('d', '台帳違反のE（採用前・休職中・退職後）', !v.issues.some(x => /採用前/.test(x.msg)), `${v.issues.filter(x => /採用前/.test(x.msg)).length}件`);
  const hw = [noHol, noHol2].map(p => p.cells.filter((c, d) => api.cls(c) === 'work' && S.holidays.includes(d + 1)).length);
  rec('d', '祝日出勤不可の非常勤に祝日勤務なし（10/12スポーツの日）', hw.every(x => x === 0), `祝日勤務 ${hw.join(',')} / 祝日[${S.holidays}]`);
  rec('d', '台帳設定後の全体', m.E <= 5, fmt(m) + ` ${(t / 1000).toFixed(2)}s`);
  const unitsRest = [hire, ret, leave].map(p => p.cells.filter(c => c === '公').length + '/' + p.target);
  rec('d', '台帳対象者の公休数／目標（空欄日が多い場合は不足がありうる）', null, unitsRest.join(' '));
}

// ===== e. 常勤換算 =====
{
  const S = global.__R, F = api.calcFte(S);
  const full = S.staff.filter(t => t.fte.calc === '1固定');
  const fullFte = sum(F.rows.filter(r => S.staff[r.id].fte.calc === '1固定').map(r => r.fte));
  rec('e', '常勤は1固定', fullFte === full.length, `${full.length}名 合計${fullFte}`);
  const partRows = F.rows.filter(r => S.staff[r.id].fte.calc === '計算');
  const p0 = partRows.find(r => S.staff[r.id].cells.some(c => c === '9-15') && r.hours > 0);
  if (p0){ const t = S.staff[p0.id], n = t.cells.filter(c => c === '9-15').length;
    const exp = n * 6 / (40 * S.D / 7); // 9-15: 6h（休憩なし表記→legalBrk後は0.75h控除の可能性）
    rec('e', '非常勤FTE=時間/(週基本×週数)', Math.abs(p0.fte - p0.hours / (40 * S.D / 7)) < 1e-9, `${t.name} 9-15×${n} hours=${p0.hours.toFixed(2)} fte=${p0.fte.toFixed(3)} (休憩無し参考${exp.toFixed(3)})`);
  }
  const total = sum(F.rows.map(r => r.fte)), partSum = sum(partRows.map(r => r.fte));
  rec('e', '全体FTE合計の妥当性（職員数以下）', total < S.staff.length && partSum > 0, `合計${total.toFixed(1)} / 常勤${fullFte} 非常勤${partSum.toFixed(1)} / ${S.staff.length}名`);
  const unk = sum(F.rows.map(r => r.unknown)); const unkNames = {};
  S.staff.forEach(t => t.cells.forEach(c => { if (api.cls(c) === 'work' && !(c in S.fte.hours) && !/^\d+(\.\d+)?-\d+(\.\d+)?$/.test(c)) unkNames[c] = (unkNames[c] || 0) + 1; }));
  rec('e', '時間不明の記号の件数', null, `${unk}セル ${JSON.stringify(unkNames)}`);
  const nightH = sum(F.rows.map(r => r.night)), nNight = sum(S.staff.map(t => t.cells.filter(c => c === '夜').length)), nJun = sum(S.staff.map(t => t.cells.filter(c => c === '準夜勤').length));
  const expN = nNight * (17 - 1.5) + nJun * (22 - 16 >= 0 ? (7 + 24 - 22 - 0 /*22-24 + 0-7 は夜勤帯外の0-7も含む*/) : 0);
  rec('e', '延べ夜勤時間（夜15.5h/回 + 準夜勤）の整合', Math.abs(nightH - (nNight * 15.5 + nJun * (nightH - nNight * 15.5) / Math.max(1, nJun))) < 1e-6 && nightH > nNight * 15.5 * 0.99, `延べ${nightH.toFixed(1)}h 夜${nNight}回(${(nNight * 15.5).toFixed(1)}h) 準夜勤${nJun}回`);
  const per = Object.entries(F.nightAvg).filter(([k, v]) => v > 0).map(([k, v]) => k + ':' + v.toFixed(2));
  rec('e', '夜勤時間帯平均人数（16:00〜09:00=17h）', null, per.join(' ') + ` 帯${F.nightWin}h`);
}

// ===== f. 異常入力 =====
{
  const hdr = (D, t = '') => [t, '', ...Array.from({ length: D }, (_, i) => i + 1)].join('\t');
  const dow = D => ['No', '氏　名', ...Array.from({ length: D }, (_, i) => '月火水木金土日'[i % 7])].join('\t');
  const row = (k, n, D, v = '日') => [k, n, ...Array(D).fill(v)].join('\t');
  const T = '令和8年11月度\t勤務予定表\n';
  const cases = [
    ['空文字', ''],
    ['空白のみ', '  \n\t\n'],
    ['見出し行なし', T + row('常', '氏名A', 30) + '\n' + row('常', '氏名B', 30)],
    ['見出し行のみ（職員0）', T + hdr(30, '部署') + '\n' + dow(30)],
    ['列数バラバラ', T + hdr(30, '部署') + '\n' + dow(30) + '\n' + ['常', 'A', '日', '日'].join('\t') + '\n' + row('常', 'B', 40) + '\n' + row('常', 'C', 10)],
    ['31日列だが11月(30日)', T + hdr(31, '部署') + '\n' + dow(31) + '\n' + row('常', 'A', 31) + '\n' + row('常', 'B', 31, '公')],
    ['同名職員の重複（兼務2部署）', T + hdr(30, '部署甲') + '\n' + dow(30) + '\n' + row('常', '兼務 太郎', 30) + '\n\n' + hdr(30, '部署乙') + '\n' + dow(30) + '\n' + row('常', '兼務 太郎', 30, '公')],
    ['極端に長い名前（500字）', T + hdr(30, '部署') + '\n' + dow(30) + '\n' + row('常', 'あ'.repeat(500), 30)],
    ['全角Ｅ混在（遅Ｅ・ＡＢ・全角数字）', T + hdr(30, '部署') + '\n' + dow(30) + '\nＡＢ\n' + row('常', 'A', 30, '遅Ｅ') + '\n' + row('常', 'B', 30, '９－１５')],
    ['数式風（=SUM(・+cmd・@）', T + hdr(30, '=SUM(A1)') + '\n' + dow(30) + '\n' + row('=1+1', '=SUM(A1:A9)', 30, '=SUM(B1)') + '\n' + row('+cmd', '@A', 30, '-1')],
    ['HTML風（<img onerror>）', T + hdr(30, '<b>x</b>') + '\n' + dow(30) + '\n' + row('常', '<img src=x onerror=alert(1)>', 30, '<script>')],
    ['月が令和でなく「2026年10月」', '2026年10月\n' + hdr(31, '部署') + '\n' + dow(31) + '\n' + row('常', 'A', 31)],
    ['引用符が閉じない', T + hdr(30, '部署') + '\n' + dow(30) + '\n' + '常\t"A\t日'],
    ['CRLF改行', (T + hdr(30, '部署') + '\n' + dow(30) + '\n' + row('常', 'A', 30)).replace(/\n/g, '\r\n')],
    ['部署見出しのみ空（部署名なし）', T + hdr(30, '') + '\n' + dow(30) + '\n' + row('常', 'A', 30)],
    ['夜勤のみ・明けなし（／欠落）', T + hdr(30, '一階') + '\n' + dow(30) + '\nAB\n' + row('常', 'A', 30, '夜') + '\n' + row('常', 'B', 30, '日')],
  ];
  for (const [name, text] of cases){
    let S, err = null, gen = null;
    try { S = imp(text); } catch (e){ err = e; }
    if (S){ try { api.generateAll(S, 'rebuild'); api.validateAll(S); api.calcFte(S); api.toTSV(S); } catch (e){ gen = e; } }
    const ok = !gen && (!err || /見つかりません|見出し/.test(err.message) || !(err instanceof TypeError || err instanceof RangeError));
    rec('f', name, ok, err ? `取込エラー: ${err.message}` : gen ? `作成時に例外: ${gen.message}` : `取込OK ${S.y}/${S.m} D=${S.D} 職員${S.staff.length} 祝日[${S.holidays}]` + (S.D > new Date(S.y, S.m, 0).getDate() ? ` 注意:D=${S.D}は${S.m}月の日数${new Date(S.y, S.m, 0).getDate()}を超過` : ''));
  }
  // 症状の個別確認
  let S = imp(T + hdr(30, '部署') + '\n' + dow(30) + '\nＡＢ\n' + row('常', 'A', 30, '遅Ｅ'));
  rec('f', '全角「遅Ｅ」は半角「遅E」と同一に扱われる', S.staff[0].cells[0] === '遅E', `実際: "${S.staff[0].cells[0]}"`);
  S = imp(T + hdr(30, '部署') + '\n' + dow(30) + '\n' + row('常', 'A', 30, '９－１５'));
  rec('f', '全角時間表記「９－１５」は「9-15」と同一に扱われる', S.staff[0].cells[0] === '9-15', `実際: "${S.staff[0].cells[0]}"`);
  S = imp(T + hdr(31, '部署') + '\n' + dow(31) + '\n' + row('常', 'A', 31));
  rec('f', '11月(30日)に31日列：日数が実際の月に揃う', S.D === 30, `D=${S.D}`);
}

// ---- 出力 ----
const w = [3, 0, 5, 0];
console.log('\n結果表 (a=取込 b=一括作成 c=月長/月またぎ d=台帳 e=常勤換算 f=異常入力)');
for (const r of rows) console.log(`[${r[0]}] ${r[2].padEnd(4)} ${r[1]} ｜ ${r[3]}`);
console.log(`\n合計 ${rows.length} 件 / FAIL ${fails} 件 / WARN(既知の課題) ${warns} 件`);
process.exit(fails ? 1 : 0);
