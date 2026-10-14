'use strict';

// 求職者向け提案書（求人比較表）の作成。印刷用データと LINE 等に貼る文面を返す
const { getDb, getSettings, audit } = require('../database/db');
const { postingMonthly, postingAnnual } = require('../utils/wage');
const { solicitationGuard } = require('./matching/runner');
const { translateProposal } = require('./ai/translate');
const { todayJst } = require('../utils/dates');
const { currentOperator } = require('../middleware/context');

const LABELS = {
  title: '求人のご紹介', for: '様', date: '作成日',
  company: '事業所', job: '職種', place: '勤務地', facility: '施設の種類', employment: '雇用形態', term: '契約期間',
  wage: '賃金', monthly: '月の見込み額', annual: '年収の見込み', hours: '勤務時間', night: '夜勤', holidays: '年間休日',
  commute: '通勤', licenses: '必要な資格', description: '仕事の内容', expiry: '紹介期限',
};
const WAGE_LABEL = { monthly: '月給', hourly: '時給', daily: '日給', annual: '年俸' };
const yen = v => (v == null ? '—' : `${Number(v).toLocaleString()}円`);

function rowFor(p, commute) {
  return {
    company: p.company_name,
    job: p.job_title,
    place: `${p.prefecture || ''}${p.city || ''}${p.nearest_station ? `（${p.nearest_station}駅）` : ''}`,
    facility: p.facility_type || '—',
    employment: p.employment_type || '—',
    term: p.employment_term ? `${p.employment_term}${p.contract_period ? `（${p.contract_period}）` : ''}` : '—',
    wage: `${WAGE_LABEL[p.wage_type] || ''} ${yen(p.wage_min)}〜${yen(p.wage_max)}`,
    monthly: `約${yen(postingMonthly(p, 'min'))}〜`,
    annual: postingAnnual(p, 'min') ? `約${yen(postingAnnual(p, 'min'))}〜` : '—',
    hours: p.shift_work ? '交替制' : `${p.work_start || '?'}〜${p.work_end || '?'}`,
    night: p.shift_work || p.nights_per_month ? `あり（月${p.nights_per_month ?? '?'}回${p.night_allowance ? `・1回${yen(p.night_allowance)}` : ''}）` : 'なし',
    holidays: p.annual_holidays != null ? `${p.annual_holidays}日` : '—',
    commute: commute != null ? `約${commute}分` : '—',
    licenses: p.required_licenses || 'なし',
    description: (p.description || '').slice(0, 200),
    expiry: p.expiry_date || '—',
  };
}

async function createProposal(seekerId, matchIds, language = 'ja', overrideReason = null) {
  const db = getDb();
  const seeker = db.prepare('SELECT * FROM job_seekers WHERE id = ? AND deleted_at IS NULL').get(seekerId);
  if (!seeker) throw Object.assign(new Error('求職者が見つかりません'), { status: 404 });
  const guard = solicitationGuard(seekerId);
  if (guard && !overrideReason) {
    throw Object.assign(new Error(`この方は${guard.hire_date}に自社紹介で無期雇用就職しています（${guard.until}まで転職勧奨禁止）。本人からの求職申込みである旨を理由欄に記録してください`), { status: 409, guard });
  }
  if (!matchIds?.length || matchIds.length > 10) throw Object.assign(new Error('提案する求人を1〜10件選んでください'), { status: 400 });
  const rows = db.prepare(`SELECT m.id AS match_id, m.intro_status, p.*, c.minutes AS commute FROM matches m
    JOIN job_postings p ON p.id = m.posting_id LEFT JOIN commute_cache c ON c.seeker_id = m.seeker_id AND c.posting_id = m.posting_id
    WHERE m.seeker_id = ? AND m.id IN (${matchIds.map(() => '?').join(',')})`).all(seekerId, ...matchIds);
  if (rows.length !== matchIds.length) throw Object.assign(new Error('対象外の候補が含まれています'), { status: 400 });

  const hwOnly = rows.filter(r => r.origin !== 'own');
  const items = rows.map(r => ({ id: r.posting_no, fields: rowFor(r, r.commute) }));
  let content = { language: 'ja', labels: LABELS, items, note: '正式な労働条件は求人票・労働条件通知書で確認してください。' };
  if (language !== 'ja') {
    const t = await translateProposal(language, LABELS, items);
    content = { language, labels: t.labels, items: t.items, note: t.note, original: { labels: LABELS, items } };
  }
  const settings = getSettings();
  content.header = { company: settings.company_name, license_no: settings.license_no, date: todayJst(),
    contact: [settings.contact_person, settings.contact_tel, settings.contact_email].filter(Boolean).join('／') };
  content.warnings = hwOnly.length
    ? [`自社受理前のハローワーク求人が${hwOnly.length}件含まれます（${hwOnly.map(r => r.posting_no).join('、')}）。紹介前に求人者へ連絡し自社求人として受理してください`]
    : [];
  content.lineText = buildLineText(content);

  const r = db.prepare(`INSERT INTO proposals (seeker_id, language, match_ids, content, override_reason, operator) VALUES (?,?,?,?,?,?)`)
    .run(seekerId, language, JSON.stringify(matchIds), JSON.stringify(content), overrideReason, currentOperator());
  audit('proposal_create', seekerId, { proposal_id: r.lastInsertRowid, language, matches: matchIds.length, override: Boolean(overrideReason) });
  return { id: r.lastInsertRowid, ...content };
}

function buildLineText(c) {
  const L = c.labels;
  const keys = ['company', 'job', 'place', 'wage', 'monthly', 'hours', 'night', 'holidays', 'commute'];
  return c.items.map((it, i) => [`【${i + 1}】${it.fields.company} / ${it.fields.job}`,
    ...keys.slice(2).map(k => `・${L[k]}: ${it.fields[k]}`)].join('\n')).join('\n\n') + `\n\n${c.note}`;
}

// 提案した候補のステータスを「提案済」に進める
function markProposed(matchIds) {
  const db = getDb();
  const today = todayJst();
  for (const id of matchIds) {
    const m = db.prepare('SELECT intro_status FROM matches WHERE id = ?').get(id);
    if (m?.intro_status === '未提案') {
      db.prepare("UPDATE matches SET intro_status = '提案済', proposed_date = ?, is_new = 0 WHERE id = ?").run(today, id);
      db.prepare("INSERT INTO match_events (match_id, from_status, to_status, note, operator) VALUES (?, '未提案', '提案済', '提案書作成', ?)")
        .run(id, currentOperator());
    }
  }
}

module.exports = { createProposal, markProposed, LABELS };
