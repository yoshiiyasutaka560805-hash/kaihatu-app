// 本番規模TSVを画面に取り込み、描画時間・はみ出し・JSエラーを確認（Playwright）。架空データのみ。
// 実行: cd /tmp && NODE_PATH=$(npm root -g) node /home/user/kaihatu-app/shift-app/tests/run5_ui.js [スクショ出力先]
'use strict';
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const { build } = require('./gen_fixture.js');
const OUT = process.argv[2] || '/tmp/claude-0/-home-user-kaihatu-app/1abf4626-145b-5bfc-ab13-a165a2d55b6c/scratchpad/scale';
fs.mkdirSync(OUT, { recursive: true });
const URL = 'file://' + path.resolve(__dirname, '../index.html');
const rows = []; let fails = 0;
const rec = (item, ok, detail) => { rows.push([ok === null ? 'INFO' : ok ? 'PASS' : 'FAIL', item, detail]); if (ok === false) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const tsv = build({ y: 2026, m: 10, seed: 20261 }).tsv;
  for (const [vw, vh, tag] of [[1440, 900, 'pc'], [400, 800, 'sp']]){
    const ctx = await b.newContext({ viewport: { width: vw, height: vh } });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push('pageerror:' + e.message)); p.on('console', m => m.type() === 'error' && errs.push('console:' + m.text()));
    p.on('dialog', d => d.accept());
    await p.goto(URL);
    // XSS検査用に氏名へHTMLを混ぜる（1名）
    const bad = tsv.replace(/\n(特)\t[^\t\n]+/, '\n$1\t<img src=x onerror="window.__xss=1">');
    await p.evaluate(t => { document.querySelector('#paste').value = t; }, bad);
    const t0 = Date.now(); await p.click('#bImport'); const tImp = Date.now() - t0;
    const msg = await p.textContent('#importMsg');
    rec(`[${tag}] 取込（${tsv.length}文字）`, /取込完了/.test(msg) && tImp < 3000, `${tImp}ms ${msg}`);
    // 各タブの描画時間
    const tabs = await p.$$eval('nav button[data-p]', bs => bs.map(x => x.dataset.p));
    const tt = {};
    for (const tb of tabs){ tt[tb] = await p.evaluate(k => { const t = performance.now(); document.querySelector(`nav button[data-p=${k}]`).click(); return Math.round(performance.now() - t); }, tb); }
    rec(`[${tag}] タブ描画時間(ms)`, Math.max(...Object.values(tt)) < 2000, JSON.stringify(tt));
    // シフト作成（rebuild）
    const g0 = Date.now(); await p.click('#bGen'); await p.waitForFunction(() => /作成しました/.test(document.querySelector('#status').textContent), null, { timeout: 60000 });
    const tGen = Date.now() - g0;
    rec(`[${tag}] 画面から一括作成(rebuild)`, tGen < 10000, `${tGen}ms 「${await p.textContent('#status')}」`);
    const g1 = Date.now(); await p.click('#bFill'); await p.waitForFunction(() => /作成しました/.test(document.querySelector('#status').textContent), null, { timeout: 60000 });
    rec(`[${tag}] 画面から空欄だけ埋める(fill)`, Date.now() - g1 < 10000, `${Date.now() - g1}ms`);
    await p.waitForTimeout(500);
    const n = await p.$$eval('#grid td.c', e => e.length), nrow = await p.$$eval('#grid tr', e => e.length);
    rec(`[${tag}] ⑤勤務表の描画`, n > 3000, `セル${n} 行${nrow}`);
    const cv = await p.$eval('#cvHeat', c => ({ w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight })).catch(() => null);
    const nonBlank = cv && await p.$eval('#cvHeat', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, Math.min(c.height, 400)).data; let k = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) k++; return k; });
    rec(`[${tag}] Canvasヒートマップ`, !!cv && nonBlank > 1000, cv ? `${cv.w}x${cv.h}px(css ${cv.cssW}x${cv.cssH}) 描画画素${nonBlank}` : 'なし');
    const tF = await p.evaluate(() => { const t = performance.now(); try { cvRender(); } catch (e) { return -1; } return Math.round(performance.now() - t); });
    rec(`[${tag}] Canvas再描画時間`, tF >= 0 && tF < 1000, `${tF}ms`);
    await p.screenshot({ path: `${OUT}/${tag}_sheet.png`, fullPage: false });
    // 横はみ出し
    for (const tb of tabs){
      await p.click(`nav button[data-p=${tb}]`); await p.waitForTimeout(150);
      const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      if (tag === 'sp') rec(`[${tag}] 横はみ出し ${tb}`, o.sw <= o.cw + 1, `scrollWidth ${o.sw} / viewport ${o.cw}`);
      if (tb === 'sheet' || tb === 'fte' || tb === 'rules') await p.screenshot({ path: `${OUT}/${tag}_${tb}.png` });
    }
    await p.click('nav button[data-p=sheet]'); await p.waitForTimeout(200);
    const shown = await p.evaluate(() => document.body.innerText.includes('<img src=x'));
    rec(`[${tag}] HTML風の氏名は文字としてそのまま表示`, shown, shown ? '表示を確認' : '表示されていない（検査が空振りの可能性）');
    const xss = await p.evaluate(() => window.__xss === 1);
    rec(`[${tag}] 氏名のHTMLが実行されない（XSS）`, !xss, xss ? '実行された！' : '無害に表示');
    const heap = await p.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1);
    rec(`[${tag}] JSヒープ`, heap < 300, `${heap}MB`);
    rec(`[${tag}] JSエラー`, errs.length === 0, errs.slice(0, 3).join(' | ') || 'なし');
    await ctx.close();
  }
  await b.close();
  console.log('\n画面検証結果');
  for (const r of rows) console.log(`${r[0].padEnd(4)} ${r[1]} ｜ ${r[2]}`);
  console.log(`\n合計 ${rows.length} 件 / FAIL ${fails} 件  スクショ: ${OUT}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
