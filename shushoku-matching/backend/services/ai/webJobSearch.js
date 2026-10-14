'use strict';

// ネットの求人検索（Claude の Web検索・Web取得ツールを使用）
// 求職者の希望条件（氏名・連絡先・年齢等を含まない検索条件のみ）で一般の求人サイトを検索し、
// 求人ページを読んで条件を抜き出す → 求人DBに「ネット求人」として登録 → ルール判定で案内可否を出す
//
// 注意
// ・検索結果は掲載時点の情報。掲載終了・条件変更がありうるため、案内前に必ず掲載元で確認する
// ・ログインが必要なページ・有料情報は取得しない。各サイトの利用規約に従う
// ・ネット求人も、紹介（手数料を伴うあっせん）には求人者からの求人申込みの受理が必要

const crypto = require('crypto');
const { callWithTools } = require('./client');
const { getDb, audit } = require('../../database/db');
const { importRows } = require('../postingStore');
const { todayJst, addDays } = require('../../utils/dates');
const { safeUrl } = require('../../utils/values');

const s = t => ({ anyOf: [{ type: t }, { type: 'null' }] });
const JOB = {
  type: 'object',
  properties: {
    source_url: { type: 'string' }, source_site: { type: 'string' },
    company_name: { type: 'string' }, job_title: { type: 'string' },
    prefecture: s('string'), city: s('string'), address: s('string'), nearest_station: s('string'),
    facility_type: s('string'), employment_type: s('string'), employment_term: s('string'),
    wage_type: s('string'), wage_min: s('integer'), wage_max: s('integer'), allowances_note: s('string'),
    work_start: s('string'), work_end: s('string'), shift_work: s('boolean'), nights_per_month: s('integer'),
    days_per_week: s('integer'), annual_holidays: s('integer'), required_licenses: s('string'), preferred_licenses: s('string'),
    experience_required: s('integer'), foreigner_ok: s('boolean'), description: s('string'), posted_date: s('string'),
    hw_posting_no: s('string'),
  },
  required: ['source_url', 'source_site', 'company_name', 'job_title', 'prefecture', 'city', 'address', 'nearest_station', 'facility_type',
    'employment_type', 'employment_term', 'wage_type', 'wage_min', 'wage_max', 'allowances_note', 'work_start', 'work_end', 'shift_work',
    'nights_per_month', 'days_per_week', 'annual_holidays', 'required_licenses', 'preferred_licenses', 'experience_required', 'foreigner_ok',
    'description', 'posted_date', 'hw_posting_no'],
  additionalProperties: false,
};
const SUBMIT = {
  name: 'submit_jobs',
  description: '見つけた求人の一覧を提出する。各求人は実在の掲載ページURLを必ず含める。',
  schema: { type: 'object', properties: { jobs: { type: 'array', items: JOB }, search_notes: { type: 'string' } }, required: ['jobs', 'search_notes'], additionalProperties: false },
};

const SYSTEM = `あなたは職業紹介事業者のために、求職者の条件に合う「現在募集中の求人」をインターネットで探すアシスタントです。
- web_search で、ハローワークインターネットサービス、Indeed、求人ボックス、介護・医療系求人サイト（カイゴジョブ、ジョブメドレー等）、事業所の採用ページなどを検索する。
- 候補が見つかったら web_fetch で求人ページを開き、勤務地・賃金・勤務時間・休日・資格要件などをページの記載どおりに抜き出す。
- ページに書かれていない項目は null。推測や作り話をしない。URLは実際に開いたページのものだけを使う。
- 掲載終了・募集終了と明記されたものは除く。ログインが必要なページや有料情報は使わない。
- 賃金は円の整数（「22万円」→220000）、wage_type は monthly/hourly/daily/annual、時刻は HH:MM、employment_term は 無期/有期。
- ハローワーク求人番号（例 27010-12345678）が分かれば hw_posting_no に入れる。
- 指定件数に達するか、十分に探したら submit_jobs で提出する。search_notes に検索した範囲（サイト・キーワード）を短く書く。`;

function conditionsFor(seeker) {
  return {
    勤務地: [seeker.prefecture, seeker.city].filter(Boolean).join('') || '未指定',
    通勤可能な地域: seeker.acceptable_cities || '',
    最寄り駅: seeker.nearest_station || '',
    希望職種: [seeker.desired_categories, seeker.desired_job_kinds].filter(Boolean).join('、') || '未指定',
    希望施設: seeker.desired_facility_types || '',
    希望しない施設: seeker.excluded_facility_types || '',
    雇用形態: seeker.desired_employment || '',
    希望賃金: seeker.desired_wage_min ? `${seeker.desired_wage_min}円以上（${seeker.desired_wage_type || 'monthly'}）` : '',
    夜勤: seeker.night_only ? '夜勤専従希望' : seeker.shift_ok ? (seeker.night_max_per_month != null ? `月${seeker.night_max_per_month}回まで可` : '可') : '不可',
    勤務時間: seeker.available_start && seeker.available_end ? `${seeker.available_start}〜${seeker.available_end}` : '',
    資格: seeker.licenses || '',
    必須の待遇: seeker.required_benefits || '',
    休日: seeker.holiday_pref || '',
    勤務時間帯: seeker.shift_pattern || '',
    外国籍: seeker.is_foreign_national ? `外国籍の方が応募可能な求人を優先（在留資格: ${seeker.visa_status || '未確認'}）` : '',
  };
}

function postingNoFor(url) {
  return `W-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 10)}`;
}

async function searchWebJobs(seekerId, { count = 15 } = {}) {
  const db = getDb();
  const seeker = db.prepare('SELECT * FROM job_seekers WHERE id = ? AND deleted_at IS NULL').get(seekerId);
  if (!seeker) throw Object.assign(new Error('求職者が見つかりません'), { status: 404 });
  const cond = conditionsFor(seeker);
  if (cond.勤務地 === '未指定' && !cond.通勤可能な地域) throw Object.assign(new Error('勤務地（都道府県・市区町村）を入力してから検索してください'), { status: 400 });
  const n = Math.max(3, Math.min(30, Number(count) || 15));

  const result = await callWithTools({
    purpose: 'web_job_search', seekerId, system: SYSTEM,
    content: `次の条件に合う求人を${n}件程度探してください（条件に近いものから）。\n${JSON.stringify(cond, null, 1)}`,
    fieldsSent: { conditions: Object.keys(cond).filter(k => cond[k]) },
    serverTools: [
      { type: 'web_search_20260209', name: 'web_search', max_uses: Math.ceil(n / 2) + 4,
        user_location: { type: 'approximate', country: 'JP', timezone: 'Asia/Tokyo', ...(seeker.prefecture ? { region: seeker.prefecture } : {}), ...(seeker.city ? { city: seeker.city } : {}) } },
      { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: n + 5, max_content_tokens: 20000 },
    ],
    submitTool: SUBMIT, effort: 'medium',
  });

  const expiry = addDays(todayJst(), 14); // 掲載確認から2週間で自動的に無効（再検索で更新）
  const rows = [];
  const skipped = [];
  for (const j of result.jobs || []) {
    const url = safeUrl(j.source_url);
    if (!url) { skipped.push(`${j.company_name}（URLなし）`); continue; }
    rows.push({
      posting_no: postingNoFor(url), company_name: j.company_name, job_title: j.job_title, prefecture: j.prefecture, city: j.city,
      address: j.address, nearest_station: j.nearest_station, facility_type: j.facility_type, employment_type: j.employment_type,
      employment_term: j.employment_term, wage_type: j.wage_type, wage_min: j.wage_min, wage_max: j.wage_max,
      work_start: j.work_start, work_end: j.work_end, shift_work: j.shift_work == null ? null : (j.shift_work ? 'あり' : 'なし'),
      nights_per_month: j.nights_per_month, days_per_week: j.days_per_week, annual_holidays: j.annual_holidays,
      required_licenses: j.required_licenses, preferred_licenses: j.preferred_licenses, experience_required: j.experience_required,
      foreigner_ok: j.foreigner_ok == null ? null : (j.foreigner_ok ? '可' : '不可'),
      description: [j.description, j.allowances_note ? `手当：${j.allowances_note}` : null].filter(Boolean).join('\n'),
      received_date: j.posted_date, expiry_date: expiry, source_url: url,
    });
  }
  const r = importRows(rows, 'web_search', { sourceFile: null, terms: 'ネット掲載情報（掲載元サイトの利用規約に従う。案内前に掲載元で最新情報を確認）' });
  // 掲載元サイト名・HW求人番号を記録、origin を web に
  for (const j of result.jobs || []) {
    const url = safeUrl(j.source_url);
    if (!url) continue;
    db.prepare("UPDATE job_postings SET origin = CASE WHEN origin = 'own' THEN 'own' ELSE 'web' END, source_file = ?, hw_posting_no = COALESCE(hw_posting_no, ?) WHERE posting_no = ?")
      .run(j.source_site, /^\d{5}-\d{6,8}$/.test(j.hw_posting_no || '') ? j.hw_posting_no : null, postingNoFor(url));
  }
  audit('web_job_search', seekerId, { found: (result.jobs || []).length, inserted: r.inserted, updated: r.updated });
  return { found: (result.jobs || []).length, inserted: r.inserted, updated: r.updated, errors: [...skipped, ...r.errors], notes: result.search_notes };
}

module.exports = { searchWebJobs, conditionsFor, postingNoFor };
