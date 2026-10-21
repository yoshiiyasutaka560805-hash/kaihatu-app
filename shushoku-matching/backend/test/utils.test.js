'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { normalizeDate, normalizeTime, addMonths, ymdJst, ageOn } = require('../utils/dates');
const { parseYen, safeUrl, parseBool } = require('../utils/values');
const { parseArea, areaMatch } = require('../utils/area');
const { toMonthlyFor, postingMonthly, postingAnnual } = require('../utils/wage');
const { maskText, detectProhibited } = require('../services/ai/pii');

test('日付の各種表記を正規化', () => {
  assert.equal(normalizeDate('2026/12/31'), '2026-12-31');
  assert.equal(normalizeDate('２０２６年１月５日'), '2026-01-05');
  assert.equal(normalizeDate('令和8年4月1日'), '2026-04-01');
  assert.equal(normalizeDate('R8.4.1'), '2026-04-01');
  assert.equal(normalizeDate('平成元年1月8日'), '1989-01-08');
  assert.equal(normalizeDate('20261231'), '2026-12-31');
  assert.equal(normalizeDate('2026/2/30'), null);
  assert.equal(normalizeDate('来月'), null);
  assert.equal(normalizeTime('9時'), '09:00');
  assert.equal(normalizeTime('17:30'), '17:30');
});

test('日本時間の日付（UTC 0時〜9時のずれがない）', () => {
  assert.equal(ymdJst(new Date('2026-10-12T16:00:00Z')), '2026-10-13');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(ageOn('1990-10-14', '2026-10-13'), 35);
});

test('金額の解釈', () => {
  assert.equal(parseYen('22万円'), 220000);
  assert.equal(parseYen('２２０，０００円'), 220000);
  assert.equal(parseYen('21.5万'), 215000);
  assert.equal(parseYen('応相談'), null);
  assert.equal(parseBool('可'), 1);
});

test('URLは http/https のみ', () => {
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('https://example.com/a'), 'https://example.com/a');
});

test('地名：同名市区の取り違え防止・政令市の区', () => {
  const tokyoFuchu = parseArea('東京都府中市');
  assert.equal(areaMatch(parseArea('府中市', '広島県'), tokyoFuchu), null);
  assert.equal(areaMatch(parseArea('府中市', '東京都'), tokyoFuchu), 'exact');
  assert.equal(areaMatch(parseArea('堺市', '大阪府'), parseArea('大阪府堺市北区')), 'exact');
  assert.equal(areaMatch(parseArea('堺市北区', '大阪府'), parseArea('大阪府堺市堺区')), null);
  assert.equal(areaMatch(parseArea('北区', '東京都'), parseArea('大阪府大阪市北区')), null);
});

test('賃金換算：所定時間・手当・賞与', () => {
  const p = { wage_type: 'hourly', wage_min: 1200, work_start: '09:00', work_end: '16:00', days_per_week: 4 };
  // 7h - 休憩45分 = 6.25h → 6.3h × 4日 × 4.33週
  assert.equal(toMonthlyFor(1200, 'hourly', p), Math.round(1200 * 6.3 * 4 * 52 / 12));
  const m = { wage_type: 'monthly', wage_min: 220000, allowances_monthly: 15000, night_allowance: 6000, nights_per_month: 4, bonus_months: 3 };
  assert.equal(postingMonthly(m), 259000);
  assert.equal(postingAnnual(m), 259000 * 12 + 660000);
  assert.equal(toMonthlyFor(3600000, 'annual'), 300000);
});

test('AI送信前のマスキング', () => {
  const s = maskText('山田太郎さん（090-1234-5678、taro@example.jp）〒590-0001 北区1丁目、在留カードAB12345678CD、月給22万希望', ['山田 太郎']);
  for (const v of ['山田', '太郎', '090-1234-5678', 'taro@example.jp', '590-0001', 'AB12345678CD']) assert.ok(!s.includes(v), v);
  assert.ok(s.includes('22万'));
});

test('収集禁止情報の検知', () => {
  const r = detectProhibited(['本籍は○○県、支持政党は…', '介護経験3年']);
  assert.deepEqual(r.map(x => x.term).sort(), ['政党', '支持政党', '本籍'].sort());
});

test('住所の市区町村：駅名や町名を拾わない・名前に町村を含む市', () => {
  const { parseArea } = require('../utils/area');
  const c = t => parseArea(t).city;
  assert.equal(c('東京都港区虎ノ門１−２３−１ 森タワー 神谷町駅から徒歩'), '港区');
  assert.equal(c('東京都八王子市子安町'), '八王子市');
  assert.equal(c('東京都武蔵村山市'), '武蔵村山市');
  assert.equal(c('東京都羽村市'), '羽村市');
  assert.equal(c('東京都西多摩郡瑞穂町'), '瑞穂町');
  assert.equal(c('千代田区市ケ谷'), '千代田区');
  assert.equal(c('東京都東大和市桜が丘２丁目１４２−１ 105区画'), '東大和市');
  assert.deepEqual(parseArea('横浜市保土ケ谷区'), { pref: null, city: '横浜市', ward: '保土ケ谷区' });
  assert.deepEqual(parseArea('大阪府堺市北区'), { pref: '大阪府', city: '堺市', ward: '北区' });
});
