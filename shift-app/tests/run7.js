// e3Shift勤務表Excel（.xlsx）直接取込のテスト: node tests/run7.js [xlsxのあるフォルダ]
//  1) 合成xlsx（ダミー名）でリーダー・変換を検証  2) 実サンプルがあれば実ファイルで検証（無ければSKIP。氏名は出力しない）
const fs = require('fs'), path = require('path'), zlib = require('zlib'), assert = require('assert');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const eng = html.split('//#ENGINE-START')[1].split('//#ENGINE-END')[0];
const xl = html.split('// ==== XLSX-START ====')[1].split('// ==== XLSX-END ====')[0];
const api = new Function('const $=()=>null,esc=s=>String(s);' + eng + xl +
  ';return {readXlsxRows,importE3Files,e3ParseSheet,validateAll,generateAll,unitsOf,calcFte,shiftSpan,e3MasterNote,cls,normSym};')();
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('ok', m); };
const rejects = async (p, re, m) => { let e = null; try { await p; } catch (x) { e = x; } assert(e && re.test(e.message), m + '（' + (e && e.message) + '）'); n++; console.log('ok', m); };

// ---- 合成xlsxの作成（テスト専用の最小ZIP/XML書き出し） ----
function crc32(b){ return zlib.crc32 ? zlib.crc32(b) : (() => { let c, t = [], r = 0xFFFFFFFF; for (let i = 0; i < 256; i++){ c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c; } for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xFFFFFFFF) >>> 0; })(); }
function zip(files, stored){
  const parts = [], cd = []; let off = 0;
  for (const [name, content] of files){
    const raw = Buffer.from(content), comp = stored && stored.includes(name) ? raw : zlib.deflateRawSync(raw), m = comp === raw ? 0 : 8, nb = Buffer.from(name);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(m, 8); h.writeUInt32LE(crc32(raw), 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nb.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(m, 10); c.writeUInt32LE(crc32(raw), 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(nb.length, 28); c.writeUInt32LE(off, 42);
    parts.push(h, nb, comp); cd.push(c, nb); off += 30 + nb.length + comp.length;
  }
  const cdb = Buffer.concat(cd), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cdb.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cdb, e]);
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const colL = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
// cells: 2次元配列。値は文字列／数値／null／{rich:[..]}／{inline:'..'}／{raw:'<t>..</t>'}
function mkXlsx(cells, o){
  o = o || {}; const sst = [], si = x => { sst.push(x); return sst.length - 1; };
  let rows = '';
  cells.forEach((row, r) => {
    if (!row || !row.some(v => v != null)) { rows += `<row r="${r + 1}"/>`; return; }
    let cs = '';
    row.forEach((v, c) => {
      if (v == null || v === '') return; const ref = colL(c) + (r + 1);
      if (typeof v === 'number') cs += `<c r="${ref}"><v>${v}</v></c>`;
      else if (v.inline) cs += `<c r="${ref}" t="inlineStr"><is><t>${esc(v.inline)}</t></is></c>`;
      else if (v.rich) cs += `<c r="${ref}" t="s"><v>${si('<r><rPr><b/></rPr><t>' + v.rich.map(esc).join('</t></r><r><t>') + '</t></r><rPh sb="0" eb="1"><t>ふりがな</t></rPh><phoneticPr fontId="1"/>')}</v></c>`;
      else cs += `<c r="${ref}" t="s"><v>${si('<t xml:space="preserve">' + esc(v).replace(/\n/g, '_x000A_').replace(/\r/g, '_x000D_') + '</t><phoneticPr fontId="1"/>')}</v></c>`;
    });
    rows += `<row r="${r + 1}" spans="1:80">${cs}</row>`;
  });
  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const sheetPath = o.sheetPath || 'xl/worksheets/sheet1.xml';
  const files = [['[Content_Types].xml', '<Types/>'],
    ['xl/workbook.xml', `<workbook ${ns}><sheets><sheet name="${o.sheetName || '勤務表'}" sheetId="1" r:id="rId9"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="worksheets/other.xml"/><Relationship Id="rId9" Type="http://x/worksheet" Target="${o.target || 'worksheets/sheet1.xml'}"/></Relationships>`],
    ['xl/sharedStrings.xml', `<sst ${ns}>${sst.map(x => `<si>${x.startsWith('<r>') ? x : x}</si>`).join('')}</sst>`],
    [sheetPath, `<worksheet ${ns}><sheetData>${rows}</sheetData></worksheet>`]];
  if (o.decoy) files.unshift(['xl/worksheets/other.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>decoy</t></is></c></row></sheetData></worksheet>']);
  return zip(files, o.stored);
}
const ab = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

// e3形式のダミー勤務表（氏名はダミー）。office=事業所名、staff=[[区分, 名前, {日→記号}]], legend=[[記号, 時間]]
function dummyE3(office, staff, legend, o){
  o = o || {}; const D = o.D || 30, c = [];
  c[0] = []; c[0][7] = o.title || '令和08年11月度　勤務予定表'; c[0][39] = '事業所：' + office;
  c[3] = []; c[3][6] = '2026/11';
  c[2] = []; c[2][7] = 'No'; c[2][8] = '氏　名'; c[2][9] = '職員\r\n区分'; c[2][10] = '職種\r\n区分'; for (let d = 1; d <= D; d++) c[2][10 + d] = d;
  c[3][7] = ''; c[4] = []; c[4][14] = '運営会議';
  const tail = [];
  staff.forEach((s, i) => {
    const r = 5 + i, row = c[r] = []; row[7] = i + 1; row[8] = s[1] + '　'; row[9] = s[0]; row[10] = '介護';
    for (const d in s[2]) row[10 + +d] = s[2][d];
  });
  const end = 5 + staff.length;
  if (o.pseudo){ c[end + 1] = []; c[end + 2] = []; c[end + 2][7] = 1; c[end + 2][8] = '入浴担当'; c[end + 3] = []; c[end + 3][8] = '勤務時間合計'; for (let d = 0; d < D; d++) c[end + 3][11 + d] = 0; }
  else { c[end + 1] = []; c[end + 1][8] = '勤務時間合計'; }
  legend.forEach((l, i) => { const r = 5 + i; c[r] = c[r] || []; c[r][3] = l[0]; if (l[1]) c[r][4] = l[1]; });
  return c;
}

(async () => {
  // ===== リーダー単体 =====
  const t = mkXlsx([['A', 1.5, { rich: ['リッチ', 'テキスト'] }], [null, '行\r\n改行', { inline: 'インライン' }, 30, '1.0'], [], ['_x005F_x000D_', 'a&b<c>', '＼ ＿x0041＿']], { decoy: true });
  const rows = await api.readXlsxRows(ab(t));
  ok(rows.sheetName === '勤務表' && rows.length === 4, 'シート名・行数');
  ok(rows[0][0] === 'A' && rows[0][1] === '1.5' && rows[0][2] === 'リッチテキスト', '共有文字列・数値・リッチテキストの連結（ふりがなは除く）');
  ok(rows[1][1] === '行\r\n改行' && rows[1][2] === 'インライン' && rows[1][3] === '30' && rows[1][4] === '1.0', '_x000D_・inlineStr・数値');
  ok(rows[1][0] === '' && rows[2].every(x => x === ''), '空セル・空行は空文字');
  ok(rows[3][0] === '_x000D_' && rows[3][1] === 'a&b<c>', '_x005F_ エスケープ・実体参照');
  ok(rows.every(r => r.length === rows[0].length), '行の幅がそろう');
  ok((await api.readXlsxRows(ab(mkXlsx([['x']], { stored: ['xl/worksheets/sheet1.xml', 'xl/sharedStrings.xml'] }))))[0][0] === 'x', '無圧縮（stored）のエントリ');
  const ws3 = await api.readXlsxRows(ab(mkXlsx([['s3']], { sheetPath: 'xl/worksheets/sheet3.xml', target: '/xl/worksheets/sheet3.xml', decoy: true })));
  ok(ws3[0][0] === 's3', 'workbook.xml と rels で最初のシートを解決（絶対パス）');
  await rejects(api.readXlsxRows(new TextEncoder().encode('これはExcelではありません').buffer), /Excelファイル/, 'ZIPでないファイルはエラー');
  await rejects(api.readXlsxRows(Uint8Array.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).buffer), /\.xls/, '旧形式 .xls は案内つきエラー');
  const full = mkXlsx([['x']]); await rejects(api.readXlsxRows(ab(full.subarray(0, full.length - 40))), /読めません|壊れ|切れ/, '途中で切れたファイルはエラー');
  await rejects(api.readXlsxRows(ab(zip([['a.txt', 'x']]))), /シート/, 'シートの無いZIPはエラー');

  // ===== e3変換（合成） =====
  const L = [['早', '07:00～16:00'], ['日', '08:30～17:30'], ['遅', '10:00～20:00'], ['夜', '16:00～'], ['／', '～09:00'], ['準夜勤', '22:00～07:00'], ['公'], ['有休'], ['欠勤'], ['9-13', '09:00～13:00'], ['◇']];
  const L2 = [['早', '07:00～16:00'], ['早E', '07:00～16:00'], ['日', '08:30～17:30'], ['遅', '10:00～19:00'], ['遅E', '12:00～21:00'], ['夜', '16:00～'], ['準夜勤', '22:00～07:00'], ['／', '～09:00'], ['公'], ['有休'], ['リ休'], ['特休'], ['7-16', '07:00～16:00']];
  const f3ab = dummyE3('3階AB', [['常勤', 'テスト甲', { 1: '／', 2: '公', 5: '有休', 6: '早', 7: '会議' }], ['特定', 'テスト乙', { 3: '公', 4: '欠勤' }], ['非常', 'テスト丙', { 10: '公' }]], L, { pseudo: true });
  const f3cd = dummyE3('3階CD', [['常勤', 'テスト丁', { 1: '公' }], ['常勤', 'テスト戊', {}]], L);
  const f2 = dummyE3('2階従来型', [['常勤', 'テスト己', { 8: '遅E', 9: '早E' }], ['非常', 'テスト庚', {}], ['特定', 'テスト辛', { 2: '誕休' }]], L2);
  const files = [];
  for (const [name, c] of [['b.xlsx', f3cd], ['a.xlsx', f3ab], ['c.xlsx', f2]]) files.push({ name, rows: await api.readXlsxRows(ab(mkXlsx(c))) });
  const S = api.importE3Files(files);
  ok(S.y === 2026 && S.m === 11 && S.D === 30, '年月（令和→西暦）・日数');
  ok(S.sections.map(s => s.title + (s.auto ? '*' : '')).join() === '2階*,3階*,3階*', '事業所順（階→ユニット）・同じ部署の別セクション・夜勤あり=自動作成');
  ok(S.staff.length === 8 && S.staff.filter(t => t.auto).length === 6, '職員数8・非常勤は自動対象外');
  ok(S.e3.groups.length === 3 && S.e3.groups[1].firstRow === 6 && S.e3.groups[1].firstCol === 12 && S.e3.groups[1].days === 30 && S.e3.groups[1].sheetName === '勤務表', 'S.e3.groups の形');
  ok(S.e3.groups.every((g, i) => g.staffIds.length === S.staff.filter(t => t.sec === i).length) && S.e3.groups[0].staffIds.every((id, i) => S.staff[id].sec === 0), 'staffIds の長さ・対応');
  const tk = S.staff.find(t => t.name === 'テスト甲');
  ok(tk.cells[0] === '／' && tk.pins[0] && tk.cells[1] === '公' && tk.pins[1] && !tk.req[1] && tk.req[4] === '有休' && tk.cells[6] === '会議' && tk.pins[6], '入力済みは固定・公は希望休に入れない・有休はreq');
  ok(S.staff.find(t => t.name === 'テスト乙').cells[3] === '欠勤' && api.cls('欠勤') === 'leave' && !S.staff.find(t => t.name === 'テスト乙').req[3], '欠勤は休暇（reqには入れず固定）');
  ok(S.staff.find(t => t.name === 'テスト己').canE && !tk.canE && tk.canNight && tk.canJun, '遅E可は凡例のある事業所のみ・夜勤準夜は既定で可');
  ok(S.needs['3階/AB']['夜'].wk === 1 && S.needs['3階/*']['準夜勤'].wk === 1 && S.needs['3階/*']['遅E'].wk === 0 && S.needs['2階/']['夜'].wk === 2 && S.needs['2階/*']['遅E'].wk === 1 && S.needs['2階/']['早'].wk === 4 && S.minNeeds['2階/']['早'].wk === 2, '必要人数の既定');
  ok(S.e3groups[1].diffs.some(d => d.sym === '遅' && d.leg === '10:00～20:00') && !S.e3groups[0].diffs.length, '凡例の時間の違いを検出（3階の遅）');
  ok(S.e3groups[0].notes.some(x => /早E/.test(x)) && S.fte.hours['早E'] && S.fte.hours['9-13'] && S.shiftList.includes('早E'), '早E：自動配置の対象外の注記・凡例の記号を登録');
  ok(S.e3groups[1].notes.some(x => /職員でない行/.test(x)) && S.staff.length === 8, '担当表示などの職員でない行は除外');
  const fk = S.staff.find(t => t.name === 'テスト甲'), sp = api.shiftSpan('遅', S, fk), sp0 = api.shiftSpan('遅', S);
  ok(Math.abs(sp.e - 20) < 1e-9 && Math.abs(sp0.e - 19) < 1e-9, '常勤換算の時間は所属事業所の凡例を優先');
  ok(/10:00～20:00/.test(api.e3MasterNote(S)), 'マスタ注記');
  api.generateAll(S, 'rebuild'); api.validateAll(S);
  ok(tk.cells[0] === '／' && tk.cells[1] === '公' && tk.cells[4] === '有休', '自動作成後も固定セルは動かない');
  // 統合
  const S0 = JSON.parse(JSON.stringify(S)); S0.staff.find(t => t.name === 'テスト甲').nightMax = 3; S0.staff.find(t => t.name === 'テスト甲').empId = 'X1'; S0.staff.find(t => t.name === 'テスト己').canNight = false;
  S0.staff.find(t => t.name === 'テスト甲').name = 'ﾃｽﾄ　甲'; // 半角カナ・空白の違いは無視して照合
  const S2 = api.importE3Files(files, { old: S0, merge: true }), S3 = api.importE3Files(files, { old: S0, merge: false });
  const k2 = S2.staff.find(t => t.name === 'テスト甲');
  ok(S2.e3carry === 8 && k2.nightMax === 3 && k2.empId === 'X1' && !S2.staff.find(t => t.name === 'テスト己').canNight, '統合：台帳設定を引き継ぎ（氏名の表記ゆれを吸収）');
  ok(S3.e3carry === 0 && S3.staff.find(t => t.name === 'テスト甲').nightMax === null, '置き換え：引き継がない');
  await rejects((async () => api.importE3Files([{ name: 'x.xlsx', rows: [['a', 'b']] }]))(), /e3Shiftの勤務表として読めません/, 'e3でないシートは分かりやすいエラー');
  await rejects((async () => api.importE3Files([files[0], { name: 'dup.xlsx', rows: files[0].rows }]))(), /重複/, '同じ事業所の重複はエラー');
  const rOct = await api.readXlsxRows(ab(mkXlsx(dummyE3('4階AB', [['常勤', 'テスト壬', {}]], L, { title: '令和08年10月度　勤務予定表' }))));
  await rejects((async () => api.importE3Files([files[0], { name: 'oct.xlsx', rows: rOct }]))(), /年月が異なる/, '年月が違うファイルの混在はエラー');

  // ===== 実サンプル =====
  const dir = process.argv[2] || '/root/.claude/uploads/1abf4626-145b-5bfc-ab13-a165a2d55b6c/';
  let names = []; try { names = fs.readdirSync(dir).filter(f => /\.xlsx$/i.test(f)).sort(); } catch (e) { }
  if (names.length < 5){ console.log('SKIP 実ファイル検証（サンプルxlsxが5件ありません）'); console.log('run7 全', n, '件OK（実ファイルはSKIP）'); return; }
  const t0 = Date.now(), real = [];
  for (const f of names) real.push({ name: f, rows: await api.readXlsxRows(ab(fs.readFileSync(path.join(dir, f)))) });
  const tRead = Date.now() - t0;
  const exp = { '2階従来型': { n: 24, sym: { '公': 29, '有休': 9, '準夜勤': 1, '誕休': 1, '／': 3, 'リ休': 1 } }, '3階AB': { n: 12, sym: { '公': 33, '／': 5, '早': 4, '日': 5, '夜': 3, '遅': 5, '準夜勤': 1, '有休': 1 } },
    '3階CD': { n: 12 }, '4階AB': { n: 11, sym: { '公': 51, 'リ休': 1, '有休': 7, '誕休': 1, '／': 1 } }, '4階CD': { n: 9, sym: { '公': 14, '誕休': 1, 'リ休': 4 } } };
  const RS = api.importE3Files(real);
  ok(RS.y === 2026 && RS.m === 11 && RS.D === 30 && RS.sections.length === 5, '実ファイル：年月・日数・5事業所');
  ok(RS.e3groups.map(g => g.office).join() === '2階従来型,3階AB,3階CD,4階AB,4階CD', '事業所名・並び順');
  for (const g of RS.e3groups){
    const e = exp[g.office]; ok(g.staffN === e.n, `${g.office}：職員${g.staffN}名`);
    if (e.sym) ok(JSON.stringify(Object.entries(g.symCount).sort()) === JSON.stringify(Object.entries(e.sym).sort()), `${g.office}：入力済みセルの記号別件数`);
  }
  ok(RS.e3groups[2].filled === 84, '3階CD：入力済み84件');
  ok(RS.sections.every(s => s.auto) && RS.staff.length === 68, '全フロアが夜勤あり・職員68名');
  ok(RS.e3.groups.every((g, i) => g.staffIds.filter(x => x != null).length === RS.e3groups[i].staffN && g.firstRow === 6 && g.firstCol === 12 && g.days === 30), 'S.e3.groups の整合（人数・位置）');
  { // staffIds の各行が元の行と対応（氏名列の一致で確認。氏名は表示しない）
    let all = true;
    RS.e3.groups.forEach(g => { const src = real.find(f => f.name === g.file);
      g.staffIds.forEach((id, i) => { if (id != null){ const nm = String(src.rows[g.firstRow - 1 + i][8]).replace(/\s+/g, ' ').trim(); if (RS.staff[id].name !== nm) all = false; } }); });
    ok(all, 'staffIds[i] は Excel の行 firstRow+i の職員に対応');
  }
  ok(RS.e3groups[1].diffs.some(d => d.sym === '遅') && RS.e3groups[2].diffs.some(d => d.sym === '遅') && !RS.e3groups[3].diffs.some(d => d.sym === '遅'), '凡例の差異：3階の遅（10:00～20:00）のみマスタと違う');
  ok(RS.e3groups[0].notes.some(x => /早E/.test(x)) && RS.fte.hours['早E'], '早E：自動配置の対象外');
  ok(RS.e3groups.some(g => g.regs.includes('日(入浴)')) && RS.e3groups.some(g => g.regs.includes('PM公休')), '未知の記号（日(入浴)・PM公休）を凡例から登録');
  ok(RS.staff.every(t => t.cells.length === 30) && RS.staff.filter(t => t.koyo === '非常').every(t => !t.auto), '日数分のセル・非常勤は自動対象外');
  ok(RS.needs['2階/']['夜'].wk === 2 && RS.needs['3階/AB']['夜'].wk === 1 && RS.needs['3階/*']['遅E'].wk === 0 && RS.needs['2階/*']['遅E'].wk === 1, '必要人数の既定');
  const t1 = Date.now(); api.generateAll(RS, 'rebuild'); const tGen = Date.now() - t1;
  const v = api.validateAll(RS), E = v.issues.filter(x => x.sev === 'E').length;
  ok(v.issues && typeof v.score === 'number', `シフト作成→検証がクラッシュしない（エラー${E}件／注意${v.issues.length - E}件）`);
  ok(RS.staff.every(t => t.cells.every((c, d) => !t.pins[d] || c !== '' )), '固定セルは空にならない');
  ok(api.calcFte(RS).rows.length === 68, '常勤換算が計算できる');
  console.log(`所要時間：読込${tRead}ms（5ファイル）／作成${tGen}ms`);
  console.log('run7 全', n, '件OK');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
