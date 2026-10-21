'use strict';

// 地名の正規化と照合
// 同名の市区町村（府中市：東京都/広島県、北区：東京都/札幌市/名古屋市/大阪市…）を取り違えないよう、
// 必ず都道府県とセットで比較する。政令指定都市の区は市単位でも一致させる。

const PREFS = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県',
  '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県',
  '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県',
  '大分県', '宮崎県', '鹿児島県', '沖縄県'];

const clean = s => String(s || '').replace(/[\s　]/g, '').replace(/ヶ/g, 'ケ');

function normalizePref(p) {
  const s = clean(p);
  if (!s) return null;
  return PREFS.find(x => x === s || x.replace(/[都道府県]$/, '') === s) || null;
}

// 「大阪府堺市北区」「堺市北区」「堺市」「東京都北区」→ { pref, city, ward }
function parseArea(text, defaultPref = null) {
  let s = clean(text);
  if (!s) return null;
  let pref = PREFS.find(p => s.startsWith(p)) || null;
  if (pref) s = s.slice(pref.length);
  else pref = normalizePref(defaultPref);
  // 政令市＋区（市より前に区・町・村が出てくる住所は対象外）
  let m = s.match(/^([^区町村]+?市)([^市町村\d０-９−ー\-]{1,4}?区)/);
  if (m) return { pref, city: m[1], ward: m[2] };
  // 「武蔵村山市」「羽村市」「町田市」など、名前に町・村を含む市（市が5文字以内に出てくる場合は市を優先）
  m = s.match(/^(.+?郡)?([^区郡]{1,4}?市)/);
  if (m) return { pref, city: m[2], ward: null };
  // 郡＋町村／東京23区：最初に出てくる「市・区・町・村」で区切る（住所の後ろの駅名等を拾わない）
  m = s.match(/^(.+?郡)?(.+?[市区町村])/);
  if (m) return { pref, city: m[2], ward: null };
  return { pref, city: s, ward: null };
}

// want（希望地）が have（求人の勤務地）を含むか
// 戻り値: 'exact'（区まで一致 or 市単位希望で一致） / 'city'（希望が区指定・求人は市まで） / null
function areaMatch(want, have) {
  if (!want || !have || !want.city || !have.city) return null;
  if (want.pref && have.pref && want.pref !== have.pref) return null;
  if (want.city !== have.city) return null;
  if (!want.ward) return 'exact';
  if (!have.ward) return 'city';
  return want.ward === have.ward ? 'exact' : null;
}

module.exports = { PREFS, normalizePref, parseArea, areaMatch };
