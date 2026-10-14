'use strict';

// ジョブメドレー（job-medley.com）の求人一覧CSV（列：職種コード, 求人URL, タイトル, …, 特徴タグ）の取込
// ・求人番号は求人URLから W-<hash>（ネット求人検索と同じ採番）→ 同じ求人は重複せず更新
// ・origin = web（掲載情報）。案内前に掲載元で最新の内容を確認し、紹介する場合は事業所から求人の申込みを受ける
// ・応募要件の文から必須資格を読むのは「明らかな場合だけ」（優遇・歓迎は歓迎資格へ）。読めないものは説明文で確認

const { parseArea } = require('../../utils/area');
const { safeUrl } = require('../../utils/values');
const { postingNoFor } = require('../ai/webJobSearch');

const HEADER = ['職種コード', '求人URL', 'タイトル', '雇用形態', '給与（原文）'];

function isJobMedley(rows) {
  return rows.length > 0 && HEADER.every(h => h in rows[0]);
}

// 職種コード（URLの1階層目）→ 職種分類・職務区分
const JOB_CODES = {
  hh: ['介護職/ヘルパー', '介護職'], ans: ['看護師', '看護職'], kng: ['准看護師', '看護職'],
  cm: ['ケアマネジャー', 'ケアマネ'], scw: ['生活相談員', '生活相談員'], pt: ['理学療法士', '機能訓練'],
  ot: ['作業療法士', '機能訓練'], st: ['言語聴覚士', '機能訓練'], drv: ['ドライバー', '送迎'],
};

const EMPLOYMENT = { 正職員: '正社員', 契約職員: '契約社員', 'パート・バイト': 'パート・アルバイト', 業務委託: '業務委託' };

// 施設種別：タグ・タイトルの語から判定（先に一致したもの）
const FACILITY_RULES = [
  [/特別養護老人ホーム|特養/, '特養'], [/介護老人保健施設|老健/, '老健'], [/介護医療院/, '介護医療院'],
  [/看護小規模多機能|小規模多機能/, '小多機'], [/グループホーム|認知症対応型共同生活/, 'GH'],
  [/サービス付き高齢者向け住宅|サ高住/, 'サ高住'], [/有料老人ホーム/, '有料'],
  [/デイサービス|通所介護|通所リハ|デイケア/, 'デイ'], [/訪問介護|訪問看護|訪問入浴|訪問リハ/, '訪問'],
  [/障害|放課後等デイ|児童発達|就労継続|就労移行/, '障害'], [/保育園|保育所|こども園/, '保育'], [/病院/, '病院'],
  [/クリニック|診療所|医院/, 'その他'],
];

// 施設名（タイトル）に種別が書かれていればそれを優先し、なければ特徴タグから
function facilityOf(title, tags) {
  for (const text of [title, tags]) {
    const hit = FACILITY_RULES.find(([re]) => re.test(String(text || '')));
    if (hit) return hit[1];
  }
  return null;
}

// 「○○の介護職/ヘルパー求人（正職員）」→ 事業所名＝最後の「の」より前
function splitTitle(title) {
  const t = String(title || '').trim();
  const m = t.match(/^(.*)の([^の]+?)求人(（[^）]*）)?$/);
  const company = (m ? m[1] : t).replace(/【[^】]*】/g, '').replace(/[_＿]+/g, ' ').trim();
  return { company: company || t, job: m ? m[2].trim() : null };
}

function parseWage(text) {
  const s = String(text || '').replace(/,/g, '');
  const type = /時給/.test(s) ? 'hourly' : /日給/.test(s) ? 'daily' : /月給/.test(s) ? 'monthly' : /年俸/.test(s) ? 'annual' : null;
  const nums = [...s.matchAll(/(\d+)円/g)].map(x => Number(x[1]));
  if (!type || !nums.length) return { wage_type: type, wage_min: null, wage_max: null };
  return { wage_type: type, wage_min: nums[0], wage_max: nums.length > 1 ? nums[1] : null };
}

// 資格の語 → 求人の資格表記（上位資格は ruleScore の LICENSE_COVERS で下位を満たす）
const LICENSE_WORDS = [
  [/介護福祉士/, '介護福祉士'], [/実務者研修/, '実務者研修'], [/初任者研修|ヘルパー2級/, '初任者研修'],
  [/介護支援専門員|ケアマネ/, '介護支援専門員'], [/社会福祉士/, '社会福祉士'],
  [/理学療法士/, '理学療法士'], [/作業療法士/, '作業療法士'], [/言語聴覚士/, '言語聴覚士'],
];

// 応募要件 → { required, preferred }
// 求人広告の資格の列挙は「いずれか」の意味がほとんどのため、必須は最も下位の1つだけにする
// （上位資格の人も ruleScore の LICENSE_COVERS で対象になる）。系統の違う資格が並ぶ・無資格可の場合は必須にせず歓迎資格へ
const CARE_ORDER = ['初任者研修', '実務者研修', '介護福祉士'];
const NURSE_ORDER = ['准看護師', '看護師'];

function parseLicenses(req, code) {
  const text = String(req || '');
  const required = new Set();
  const preferred = new Set();
  const NO_LICENSE = /資格[^\s、。]{0,4}(不問|不要|問わ)|資格の有無|無資格|資格なし/;
  for (const part of text.split(/[・\n。\s　]+/)) {
    if (!part.trim()) continue;
    if (NO_LICENSE.test(part) && !/必須/.test(part)) continue;
    const bucket = /歓迎|優遇|尚可|あれば|望ましい/.test(part) ? preferred : required;
    if (/准看護師/.test(part)) bucket.add('准看護師');
    if (/看護師/.test(part.replace(/准看護師/g, ''))) bucket.add('看護師');
    for (const [re, l] of LICENSE_WORDS) if (re.test(part)) bucket.add(l);
  }
  const lowest = (set, order) => {
    const hits = order.filter(l => set.has(l));
    for (const l of hits.slice(1)) set.delete(l);
  };
  lowest(required, CARE_ORDER);
  lowest(required, NURSE_ORDER);
  // 職種コードが看護職で要件の記載がない場合も、看護師（准看護師以上）の資格が前提
  if (!required.size && (code === 'ans' || code === 'kng') && !NO_LICENSE.test(text)) required.add('准看護師');
  const lenient = /無資格[^。]{0,8}(可|OK|応相談|歓迎|または)|資格[^\s、。]{0,4}(不問|不要|問わ)|資格の有無|資格なし[^。]{0,4}(可|OK)/.test(text);
  if (required.size > 1 || lenient) { for (const r of required) preferred.add(r); required.clear(); }
  for (const r of required) preferred.delete(r);
  return { required: [...required].join(', ') || null, preferred: [...preferred].join(', ') || null };
}

function stationOf(access) {
  const m = String(access || '').match(/[「『]?([^\s「」『』、。（）()]+?)[」』]?駅/);
  return m ? `${m[1]}駅` : null;
}

// ジョブメドレーの1行 → 求人取込用オブジェクト（postingStore.normalizePosting の列名）
function toPosting(r, expiry) {
  const url = safeUrl(r['求人URL']);
  if (!url) throw new Error('求人URLがありません');
  const code = String(r['職種コード'] || '').trim();
  const { company, job } = splitTitle(r['タイトル']);
  const area = parseArea(r['住所']);
  const wage = parseWage(r['給与（原文）']);
  const tags = String(r['特徴タグ'] || '');
  const lic = parseLicenses(r['応募要件（400字まで）'], code);
  const fac = facilityOf(r['タイトル'], tags);
  const [category, kind] = JOB_CODES[code] || [null, null];
  const desc = [
    r['サブタイトル'], r['仕事内容（400字まで）'],
    r['応募要件（400字まで）'] ? `【応募要件】${r['応募要件（400字まで）']}` : null,
    r['給与（原文）'] ? `【給与（掲載どおり）】${r['給与（原文）']}` : null,
    r['アクセス'] ? `【アクセス】${r['アクセス']}` : null,
    tags ? `【特徴】${tags}` : null,
  ].filter(Boolean).join('\n');
  return {
    posting_no: postingNoFor(url), company_name: company, job_title: job || category || 'その他',
    job_category: category, job_kind: kind, facility_type: fac,
    visiting_care: /訪問介護|訪問入浴/.test(`${tags} ${r['タイトル']}`) ? '1' : null,
    employment_type: EMPLOYMENT[String(r['雇用形態'] || '').trim()] || r['雇用形態'] || null,
    wage_type: wage.wage_type, wage_min: wage.wage_min, wage_max: wage.wage_max,
    prefecture: area?.pref || null, city: area ? `${area.city}${area.ward || ''}` : null,
    address: r['住所'] || null, nearest_station: stationOf(r['アクセス']),
    commute_note: /車通勤可/.test(tags) ? '車通勤可' : null,
    required_licenses: lic.required, preferred_licenses: lic.preferred,
    description: desc, expiry_date: expiry, source_url: url,
  };
}

module.exports = { isJobMedley, toPosting, splitTitle, parseWage, parseLicenses, facilityOf, stationOf };
