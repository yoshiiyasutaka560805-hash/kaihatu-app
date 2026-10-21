// 使い方: node tests/run9.js <取込テキスト(TSV)ファイル>  配布用の「休暇の伏せ字」と閲覧用HTML生成（純粋関数）の検証
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const eng = html.split('//#ENGINE-START')[1].split('//#ENGINE-END')[0];
const exp = html.split('// ==== EXPORT-START ====')[1].split('// ==== EXPORT-END ====')[0];
const api = new Function('const $=()=>null,esc=s=>String(s),emptyState=()=>"",show=()=>{},document={addEventListener(){}};' + eng + exp +
  ';return {importText,maskSymbol,maskedState,buildViewHtml,toTSV,buildAttendanceCsv,buildCodeTable,buildCodeCsv,exportCheck,validateAll};')();
let n = 0, bad = 0; const ok = (c, m) => { n++; if (!c){ bad++; console.log('NG', m); } };
const S = api.importText(fs.readFileSync(process.argv[2], 'utf8'));
const SYMS = ['欠', '産休', '忌引', '休職', '有休', 'リ休', '誕休', '特休', '研修', '公(忌引)', '早', '公'];
S.staff.slice(0, SYMS.length).forEach((t, i) => { t.cells[2] = SYMS[i]; t.memo = 'MEMO' + i; });
S.staff.forEach(t => { if (!S.colors['休'] && 0) t.cells[0] = t.cells[0]; });
const snap = JSON.stringify(S);
const colOf = s => S.staff.slice(0, SYMS.length).map(t => t.cells[2]);
const cellsOf = (X, d) => X.staff.slice(0, SYMS.length).map(t => t.cells[d]);
const pol = p => cellsOf(api.maskedState(S, p), 2);
ok(JSON.stringify(pol('none')) === JSON.stringify(SYMS), '伏せない=そのまま');
ok(JSON.stringify(pol('sensitive')) === JSON.stringify(['休', '休', '休', '休', '有休', 'リ休', '誕休', '特休', '研修', '休', '早', '公']), '機微のみ: ' + pol('sensitive'));
ok(JSON.stringify(pol('all')) === JSON.stringify(['休', '休', '休', '休', '休', '休', '休', '休', '休', '休', '早', '公']), 'すべて: ' + pol('all'));
ok(JSON.stringify(pol(undefined)) === JSON.stringify(pol('sensitive')) && JSON.stringify(pol('xx')) === JSON.stringify(pol('sensitive')), '既定は機微のみ');
ok(JSON.stringify(S) === snap, '元データを変更しない');
ok(api.maskedState(S, 'none') === S, 'none は複製しない');
// 色・名称の漏れ
const M = api.maskedState(S, 'all');
ok(M.colors['休'] && !M.colors['有休'] && !M.colors['欠'] && !M.shiftList.includes('有休') && M.shiftList.includes('休'), '色・凡例から伏せた記号を除く');
// 閲覧用HTML
const opts = { createdAt: '2026/10/21 09:00', finalized: null };
const h0 = api.buildViewHtml(S, { ...opts, policy: 'none' }), h1 = api.buildViewHtml(S, { ...opts, policy: 'sensitive' }), h2 = api.buildViewHtml(S, { ...opts, policy: 'all', finalized: { at: '2026-10-21T00:30:00Z' } });
ok(/下書き（未確定）/.test(h1) && !/確定版/.test(h1), '下書き表記');
ok(/確定版（/.test(h2) && !/下書き（未確定）/.test(h2), '確定版表記');
ok(/社内限定です。持ち出し・撮影/.test(h1) && /凡例/.test(h1) && /2026\/10\/21 09:00/.test(h1) && /@page/.test(h1) && /@media print/.test(h1), '注意書き・凡例・作成日時・印刷CSS');
const body = h => h.split('<div class="wrap">')[1].split('</table>')[0];
ok(/>欠</.test(body(h0)) && />産休</.test(body(h0)), 'none: 欠・産休が見える');
ok(!/>欠</.test(body(h1)) && !/>産休</.test(body(h1)) && !/>忌引</.test(body(h1)) && !/>休職</.test(body(h1)) && />有休</.test(body(h1)), 'sensitive: 機微は伏せ、有休は見える');
ok(!/>有休</.test(body(h2)) && !/>リ休</.test(body(h2)) && !/>研修</.test(body(h2)), 'all: 有休等も伏せる');
const lg = h => h.split('class="lg"')[1].split('</div>')[0];
ok(/欠勤/.test(lg(h0)) && !/欠勤|産休|忌引/.test(lg(h1)) && !/有給休暇/.test(lg(h2)), '凡例にも伏せた名称は出ない');
ok(!/<script|onclick|https?:\/\//i.test(h1), 'スクリプト・外部参照なし');
ok(!/MEMO/.test(h0 + h1 + h2), '備考は閲覧用に含まない');
// 氏名のエスケープ
const S2 = JSON.parse(JSON.stringify(S)); S2.staff[0].name = '<img src=x onerror=1>"'; ok(!/<img/.test(api.buildViewHtml(S2, opts)), 'HTMLエスケープ');
// Excel用コピー・CSV・対応表
const tsv = p => api.toTSV(S, p);
ok(/欠/.test(tsv('none')) && !/欠|産休|忌引|休職/.test(tsv('sensitive')) && /有休/.test(tsv('sensitive')), 'TSVの伏せ字');
const csv = p => api.buildAttendanceCsv(S, { mask: p }).csv;
ok(/,欠,/.test(csv('none')) && !/,(欠|産休|忌引|休職|公\(忌引\)),/.test(csv('sensitive')) && !/,(有休|リ休),/.test(csv('all')) && /,有休,/.test(csv('sensitive')), 'CSVの伏せ字');
ok(!/欠勤|産休|忌引|休職/.test(api.buildCodeCsv(S, 'sensitive').split('\r\n').filter(l => /^(欠|産休|忌引|休職)/.test(l)).join('')), '対応表の伏せ字');
ok(api.buildCodeTable(S, 'sensitive').every(r => !['欠', '産休', '忌引'].includes(r.sym)), '対応表に機微な記号が出ない');
console.log(`run9 全 ${n} 件${bad ? ' / NG ' + bad : ' OK'}`); process.exit(bad ? 1 : 0);
