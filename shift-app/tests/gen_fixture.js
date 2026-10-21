// 本番規模の合成TSV生成器（架空データのみ）。単独実行: node tests/gen_fixture.js [年] [月] [seed] > out.tsv
// 形式は Excel 貼り付けと同じ：1行目「令和N年M月度 勤務予定表」→ 部署見出し/曜日行/職員行/集計列。
// 夜勤フロアは AB・CD ラベル行で区切る。実在の氏名は一切使わない（音節ランダム合成）。
'use strict';
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// 日本の祝日はエンジン側に依存せず、生成器では「土日＋指定日」だけを休み扱い（簡易）
function build(opt){
  opt = Object.assign({ y: 2026, m: 10, seed: 20261, dirty: true, holidays: [] }, opt || {});
  const { y, m } = opt, rnd = mulberry32(opt.seed);
  const D = new Date(y, m, 0).getDate();
  const dow = d => new Date(y, m - 1, d + 1).getDay();
  const DOW = '日月火水木金土';
  const R = n => (rnd() * n) | 0, pick = a => a[R(a.length)];
  // ---- 架空氏名 ----
  const S1 = ['ゼ', 'ク', 'ミ', 'ラ', 'ノ', 'ヴェ', 'ポ', 'リ', 'ト', 'ヌ', 'ホ', 'ソ', 'ユ', 'キ', 'ロ', 'ベ'];
  const S2 = ['ルカ', 'ナミ', 'ドウ', 'ペラ', 'シオ', 'タン', 'ムレ', 'フィ', 'ゴル', 'ハニ', 'ジュ', 'ウネ', 'バロ', 'ケト'];
  const G1 = ['アリ', 'ソラ', 'ミオ', 'レン', 'ユノ', 'カイ', 'ナオ', 'リク', 'ハル', 'マナ', 'ココ', 'テオ'];
  const G2 = ['', '子', 'ト', 'ス', 'ミ', 'マ'];
  const used = new Set();
  const romaji = ['Zeta', 'Qora', 'Nimo', 'Pax', 'Luma', 'Veki'];
  function name(){
    for (;;){
      let n;
      if (rnd() < 0.04) n = pick(romaji) + ' ' + pick(romaji).toLowerCase() + R(99);
      else if (rnd() < 0.06) n = pick(S1) + pick(S2) + '　' + pick(G1) + pick(G2);       // 全角空白
      else if (rnd() < 0.03) n = ' ' + pick(S1) + pick(S2) + ' ' + pick(G1) + ' ';          // 前後空白＋半角
      else if (rnd() < 0.05) n = pick(S1) + pick(S2);                                        // 姓のみ（姓のみの表記）
      else n = pick(S1) + pick(S2) + ' ' + pick(G1) + pick(G2);
      if (!used.has(n.trim())){ used.add(n.trim()); return n; }
    }
  }
  const isWe = d => dow(d) === 0 || dow(d) === 6 || opt.holidays.includes(d + 1);

  const out = [];
  out.push(`令和${y - 2018}年${m}月度\t勤務予定表`);
  const sectionRows = (title, rows, extraGap) => {
    const days = []; for (let d = 1; d <= D; d++) days.push(d);
    out.push([title, '', ...days].join('\t'));
    out.push(['No', '氏　名', ...Array.from({ length: D }, (_, d) => DOW[dow(d)]), '公休', '有休', 'リ休', '誕休', '夜'].join('\t'));
    for (const r of rows){
      if (typeof r === 'string'){ out.push(r); continue; }
      const k = s => r.cells.filter(c => c === s).length;
      const cells = r.cells.map(c => /\n/.test(c) ? '"' + c + '"' : c);
      out.push([r.koyo, r.name, ...cells, ...(opt.dirty && rnd() < 0.15 ? [''] : []), k('公'), k('有休'), k('リ休'), k('誕休'), k('夜'), ...(opt.dirty && rnd() < 0.2 ? ['', ''] : [])].join('\t'));
    }
    out.push('');
  };

  // ---- 夜勤フロア ----
  function floor(title, nAB, nCD, unitType){
    const rows = [], meta = [];
    const labels = [['AB', nAB], ['CD', nCD]];
    const people = [];
    for (const [lab, n] of labels){
      for (let k = 0; k < n; k++){
        const koyo = k === 0 ? 'LD' : k === 1 && lab === 'AB' ? 'UL' : rnd() < 0.55 ? '常' : '特';
        people.push({ lab, koyo, name: name(), cells: Array(D).fill(''), canN: true, canJ: rnd() < 0.7, fixed: Array(D).fill(false), pref: [R(3) + 1, R(3) + 1, R(3) + 1] });
      }
    }
    // 学生バイト（夜勤なし・時間表記）
    const students = unitType ? [0, 1].map(() => ({ lab: '', koyo: '非', name: name() + '(学)', cells: Array(D).fill(''), student: true })) : [];
    const free = (p, d) => d >= 0 && d < D && p.cells[d] === '';
    // 前月からの夜勤明け
    for (const [lab] of labels){
      const g = people.filter(p => p.lab === lab); const p = pick(g);
      p.cells[0] = '／'; p.cells[1] = '公';
    }
    // 月途中入職（先頭が空欄）
    const newcomer = pick(people.filter(p => p.koyo === '特' && p.cells[0] === ''));
    const hireDay = 8 + R(8);
    // 産休1名
    const mat = pick(people.filter(p => p.koyo !== 'LD' && p !== newcomer && p.cells[0] === ''));
    mat.cells.fill('産休'); mat.canN = false; mat.canJ = false;
    for (let d = 0; d < hireDay; d++) newcomer.cells[d] = '__';  // 仮
    const blocked = (p, d) => p.cells[d] === '__';
    // 夜勤
    const nCnt = new Map(people.map(p => [p, 0]));
    for (const [lab] of labels){
      const g = people.filter(p => p.lab === lab && p.canN);
      for (let d = 0; d < D; d++){
        if (g.some(p => p.cells[d] === '夜')) continue;
        const c = g.filter(p => free(p, d) && (d + 1 >= D || free(p, d + 1)) && (d + 2 >= D || free(p, d + 2) || p.cells[d + 2] === '公') &&
          !(d > 0 && ['夜', '／'].includes(p.cells[d - 1])) && !(d > 1 && p.cells[d - 2] === '夜') && !blocked(p, d));
        if (!c.length) continue;
        c.sort((a, b) => nCnt.get(a) - nCnt.get(b) + (rnd() - 0.5) * 0.8);
        const p = c[0]; p.cells[d] = '夜'; nCnt.set(p, nCnt.get(p) + 1);
        if (d + 1 < D) p.cells[d + 1] = '／'; if (d + 2 < D && free(p, d + 2)) p.cells[d + 2] = '公';
      }
    }
    // 準夜勤（フロア共通1名）
    const jCnt = new Map(people.map(p => [p, 0]));
    for (let d = 0; d < D; d++){
      const c = people.filter(p => p.canJ && free(p, d) && (d + 1 >= D || free(p, d + 1)) && !blocked(p, d) && !(d > 0 && p.cells[d - 1] === '夜'));
      if (!c.length) continue;
      c.sort((a, b) => jCnt.get(a) - jCnt.get(b) + (rnd() - 0.5) * 0.8);
      const p = c[0]; p.cells[d] = '準夜勤'; jCnt.set(p, jCnt.get(p) + 1); if (d + 1 < D) p.cells[d + 1] = '公';
    }
    // 公休10日（連勤が5を超えない位置に分散）
    for (const p of people){
      if (p.cells[0] === '産休') continue;
      let rest = p.cells.filter(c => c === '公').length;
      const cand = []; for (let d = 0; d < D; d++) if (free(p, d) && !blocked(p, d)) cand.push(d);
      while (rest < 10 && cand.length){
        // 最も長い連続勤務の中央に置く
        let best = cand[R(cand.length)], bs = -1;
        for (let t = 0; t < 6; t++){
          const d = cand[R(cand.length)]; let L = 0, Rr = 0;
          while (d - 1 - L >= 0 && p.cells[d - 1 - L] !== '公' && p.cells[d - 1 - L] !== '産休') L++;
          while (d + 1 + Rr < D && p.cells[d + 1 + Rr] !== '公') Rr++;
          const s = Math.min(L, Rr) + (L + Rr > 4 ? 3 : 0) + rnd();
          if (s > bs){ bs = s; best = d; }
        }
        p.cells[best] = '公'; rest++; cand.splice(cand.indexOf(best), 1);
      }
    }
    // 日勤帯：ラベルごとに 早・日・遅 の必要人数（平日 早1〜2・日2・遅2／土日祝 各1）を満たし、遅Eはフロアで1名、残りは希望傾向でランダム
    for (let d = 0; d < D; d++){
      const we = isWe(d);
      const okFor = (p, sh) => !(sh === '早' && ['遅', '遅E', '準夜勤'].includes(d > 0 ? p.cells[d - 1] : ''));
      const takeFrom = (pool, sh, k) => {
        for (let q = 0; q < k; q++){
          const c = pool.filter(p => free(p, d) && !blocked(p, d) && okFor(p, sh));
          if (!c.length) return;
          c.sort((a, b) => (a.pref[sh === '早' ? 0 : sh === '日' ? 1 : 2] * -1 + (rnd() - 0.5) * 2.5) - (b.pref[sh === '早' ? 0 : sh === '日' ? 1 : 2] * -1 + (rnd() - 0.5) * 2.5));
          c[0].cells[d] = sh;
        }
      };
      takeFrom(people.filter(p => p.canJ === false || rnd() < 0.5), '遅E', rnd() < 0.92 ? 1 : 0);
      for (const [lab] of labels){
        const pool = people.filter(p => p.lab === lab);
        takeFrom(pool, '早', we ? 1 : (unitType ? 1 : 2));
        takeFrom(pool, '遅', we ? 1 : (unitType ? 2 : 1));
        takeFrom(pool, '日', we ? 1 : (unitType ? 2 : 1));
      }
      for (const p of people){
        if (!free(p, d) || blocked(p, d)) continue;
        const pv = d > 0 ? p.cells[d - 1] : '';
        const w = p.pref.slice(); if (pv === '遅' || pv === '遅E' || pv === '準夜勤') w[0] = 0;
        const t = w[0] + w[1] + w[2]; const r = rnd() * t;
        p.cells[d] = r < w[0] ? '早' : r < w[0] + w[1] ? '日' : '遅';
      }
    }
    for (let d = 0; d < D; d++) if (newcomer.cells[d] === '__') newcomer.cells[d] = '';
    // 休暇散らし（夜勤・明けの日は避ける）
    const leaves = ['有休', '有休', 'リ休', '誕休', '研修', '欠', '忌引', '特休'];
    for (const p of people){
      if (p.cells[0] === '産休') continue;
      const k = rnd() < 0.5 ? 1 + R(2) : 0;
      for (let t = 0; t < k; t++){
        const d = R(D); if (['早', '日', '遅'].includes(p.cells[d]) && (d === 0 || p.cells[d - 1] !== '夜')) p.cells[d] = pick(leaves);
      }
      // 時間の無い特殊記号
      if (rnd() < 0.15){ const d = R(D); if (['早', '日', '遅'].includes(p.cells[d])) p.cells[d] = pick(['AM休', 'PM休', 'こもり']); }
    }
    // 引用符改行セル（階の1名）
    if (opt.dirty){ const p = pick(people); for (let d = 0; d < D; d++) if (p.cells[d] === '日'){ p.cells[d] = '日\n17時'; break; } }
    // 空白付きセル
    if (opt.dirty){ const p = pick(people); for (let d = 0; d < D; d++) if (p.cells[d] === '早'){ p.cells[d] = ' 早 '; break; } }
    // 学生バイト（土日中心に 9-15 など。空欄は休み）
    for (const s of students){
      const sym = pick(['9-15', '10-16', '13-17']);
      for (let d = 0; d < D; d++) s.cells[d] = (dow(d) === 6 || dow(d) === 0) && rnd() < 0.7 ? sym : (rnd() < 0.08 ? sym : '');
    }
    // 出力（ラベルごと）
    let lab = null;
    for (const p of [...people].sort((a, b) => (a.lab < b.lab ? -1 : a.lab > b.lab ? 1 : 0))){
      if (p.lab !== lab){ rows.push(p.lab); lab = p.lab; }
      rows.push(p);
    }
    for (const s of students) rows.push(s);
    sectionRows(title, rows);
    return people.length + students.length;
  }
  let total = 0;
  total += floor('2階', 12, 12, false);
  total += floor('3階', 12, 11, true);
  total += floor('4階', 11, 12, true);
  total += floor('5階', 12, 11, true);

  // ---- 日勤系 ----
  function partRow(koyo, sym, days, restSym, extra){
    const cells = Array(D).fill('');
    for (let d = 0; d < D; d++){
      if (days.includes(dow(d)) && !opt.holidays.includes(d + 1)) cells[d] = sym; else cells[d] = restSym;
      if (extra && rnd() < 0.04) cells[d] = pick(['有休', 'AM休', 'PM休']);
    }
    return { koyo, name: name(), cells };
  }
  function fullRow(koyo, restSym){
    const cells = Array(D).fill('');
    for (let d = 0; d < D; d++) cells[d] = isWe(d) ? '公' : '日';
    for (let t = 0; t < 2; t++){ const d = R(D); if (cells[d] === '日') cells[d] = pick(['有休', 'リ休', '誕休', '研修']); }
    return { koyo, name: name(), cells };
  }
  // 介護助手：非常勤10名、時間表記
  const aid = [];
  const pats = [['7-16', [1, 2, 3, 4, 5]], ['9-13', [1, 3, 5]], ['9-15', [2, 4, 6]], ['8.5-14.5', [1, 2, 3, 4]], ['10-15', [0, 6, 3]], ['7-16', [6, 0, 1, 2]]];
  for (let k = 0; k < 10; k++){ const [s, dd] = pats[k % pats.length]; aid.push(partRow('非', s, dd, k % 3 === 0 ? '' : '公', true)); }
  total += aid.length; sectionRows('介護助手', aid);
  // 相談員3・事務4・デイ7・看護5・居宅4
  const dept = (title, nFull, nPart, partSyms) => {
    const rows = [];
    for (let k = 0; k < nFull; k++) rows.push(fullRow('常'));
    for (let k = 0; k < nPart; k++) rows.push(partRow('非', pick(partSyms), [[1, 2, 3], [2, 4, 5], [1, 3, 5], [4, 5, 6]][k % 4], rnd() < 0.5 ? '' : '公', true));
    total += rows.length; sectionRows(title, rows); return rows;
  };
  dept('相談員', 3, 0, []);
  const jimu = dept('事務', 3, 1, ['9-15']);
  if (opt.dirty){ const r = jimu[0]; let n = 0; for (let d = 0; d < D && n < 2; d++) if (r.cells[d] === '日'){ r.cells[d] = n ? 'こもり' : '日\n17時'; n++; } }
  dept('デイ', 4, 3, ['9-16', '8.5-16.5', '9-14']);
  dept('看護', 3, 2, ['8.5-17.5', '9-15']);
  dept('居宅', 3, 1, ['9-13']);
  return { tsv: out.join('\n'), total, D };
}
module.exports = { build };
if (require.main === module){
  const a = process.argv.slice(2).map(Number);
  const r = build({ y: a[0] || 2026, m: a[1] || 10, seed: a[2] || 20261 });
  process.stdout.write(r.tsv + '\n');
  process.stderr.write(`職員 ${r.total} 名 / ${r.D} 日\n`);
}
