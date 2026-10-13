'use strict';

const { getDb, getSettings, audit } = require('../../database/db');
const { scoreMatch } = require('./ruleScore');
const { advise } = require('../ai/matchAdvisor');
const ai = require('../ai/client');
const { withLock } = require('../../utils/lock');
const { todayJst, addYears } = require('../../utils/dates');

const ACTIVE_SEEKER_STATUSES = ['受付', '紹介中', '面接'];

// 職業安定法の指針：自社の紹介で無期雇用就職した者に、就職から2年間は転職の勧奨をしてはならない
function solicitationGuard(seekerId, today = todayJst()) {
  const rows = getDb().prepare(`SELECT p.hire_date, p.separation_date, jp.company_name FROM placements p
    JOIN job_postings jp ON jp.id = p.posting_id
    WHERE p.seeker_id = ? AND p.employment_term = '無期'`).all(seekerId);
  const active = rows.find(r => !r.separation_date && addYears(r.hire_date, 2) > today);
  return active ? { until: addYears(active.hire_date, 2), company: active.company_name, hire_date: active.hire_date } : null;
}

function evaluate(seeker, postings, settings) {
  const db = getDb();
  const commutes = new Map(db.prepare('SELECT posting_id, minutes FROM commute_cache WHERE seeker_id = ?')
    .all(seeker.id).map(r => [r.posting_id, r.minutes]));
  const today = todayJst();
  const hits = [], nearMisses = [];
  let excluded = 0;
  for (const p of postings) {
    const m = scoreMatch(seeker, p, { today, settings, commuteMinutes: commutes.get(p.id) });
    if (m.excluded) {
      excluded++;
      if (m.reasonDetails.length === 1 && !['inactive', 'expired', 'residence_expired'].includes(m.reasonDetails[0].code)) {
        nearMisses.push({ posting: p, match: m });
      }
      continue;
    }
    hits.push({ posting: p, match: m });
  }
  hits.sort((a, b) => b.match.score - a.match.score);
  nearMisses.sort((a, b) => b.match.score - a.match.score);
  return { hits, nearMisses, excluded };
}

// 判定対象の求人：有効なもの。ただし自社求人化済みのHW求人は自社求人側で判定する（重複表示を防ぐ）
function activePostings() {
  return getDb().prepare(`SELECT * FROM job_postings p WHERE p.is_active = 1 AND NOT (p.origin = 'hw' AND EXISTS (
    SELECT 1 FROM job_postings o WHERE o.origin = 'own' AND o.hw_posting_no = p.posting_no))`).all();
}

// 求職者1名について全有効求人を判定し matches を更新
async function runForSeeker(seekerId, { withAi = true, markNew = false } = {}) {
  return withLock(`match:${seekerId}`, async () => {
    const db = getDb();
    const seeker = db.prepare('SELECT * FROM job_seekers WHERE id = ? AND deleted_at IS NULL').get(seekerId);
    if (!seeker) { const e = new Error('求職者が見つかりません'); e.status = 404; throw e; }
    const settings = getSettings();
    const minScore = parseInt(settings.match_min_score, 10) || 0;
    const postings = activePostings();
    const { hits: all, nearMisses, excluded } = evaluate(seeker, postings, settings);
    const hits = all.filter(h => h.match.score >= minScore);

    const existing = new Map(db.prepare('SELECT id, posting_id, score, intro_status FROM matches WHERE seeker_id = ?')
      .all(seekerId).map(r => [r.posting_id, r]));
    let newCount = 0;
    db.transaction(() => {
      const keep = new Set(hits.map(h => h.posting.id));
      for (const old of existing.values()) {
        if (old.intro_status === '未提案' && !keep.has(old.posting_id)) db.prepare('DELETE FROM matches WHERE id = ?').run(old.id);
      }
      for (const h of hits) {
        const old = existing.get(h.posting.id);
        if (old) {
          // 再判定時は古いAIコメントを消す（条件変更後の誤った説明を残さない）
          db.prepare(`UPDATE matches SET score = ?, completeness = ?, breakdown = ?, ai_comment = NULL,
            judged_at = datetime('now','localtime') WHERE id = ?`)
            .run(h.match.score, h.match.completeness, JSON.stringify(h.match), old.id);
        } else {
          newCount++;
          db.prepare(`INSERT INTO matches (seeker_id, posting_id, score, completeness, breakdown, is_new) VALUES (?,?,?,?,?,?)`)
            .run(seekerId, h.posting.id, h.match.score, h.match.completeness, JSON.stringify(h.match), markNew ? 1 : 0);
        }
      }
    })();
    audit('match_run', seekerId, { candidates: hits.length, excluded, new: newCount });

    let aiStatus;
    const topN = Math.min(10, parseInt(settings.ai_top_n, 10) || 5);
    if (!withAi) aiStatus = 'ルール判定のみ';
    else if (settings.ai_enabled !== '1') aiStatus = 'AI補足は設定で無効';
    else if (!seeker.ai_consent) aiStatus = '求職者のAI利用同意なし';
    else if (!ai.isAvailable()) aiStatus = 'APIキー未設定（ルール判定のみ）';
    else if (!hits.length) aiStatus = '候補なし';
    else {
      try {
        const top = hits.slice(0, topN);
        const comments = await advise(seeker, top);
        const upd = db.prepare('UPDATE matches SET ai_comment = ? WHERE seeker_id = ? AND posting_id = ?');
        for (const t of top) {
          const c = comments.get(t.posting.posting_no);
          if (c) upd.run(JSON.stringify(c), seekerId, t.posting.id);
        }
        aiStatus = `AI補足 ${comments.size}件`;
      } catch (e) {
        aiStatus = `AI補足エラー: ${e.message}`;
      }
    }

    return {
      candidates: hits.length, excluded, total: postings.length, newCount, aiStatus,
      guard: solicitationGuard(seekerId),
      nearMisses: nearMisses.slice(0, 20).map(n => ({
        posting_id: n.posting.id, posting_no: n.posting.posting_no, company_name: n.posting.company_name,
        job_title: n.posting.job_title, city: n.posting.city, score: n.match.score,
        reason: n.match.reasonDetails[0].text, hint: n.match.reasonDetails[0].hint,
      })),
    };
  });
}

// 求人取込後：活動中の求職者全員を AI なしで再照合し、新着候補に印を付ける
async function rematchActiveSeekers() {
  const ids = getDb().prepare(`SELECT id FROM job_seekers WHERE deleted_at IS NULL
    AND status IN (${ACTIVE_SEEKER_STATUSES.map(() => '?').join(',')})`).all(...ACTIVE_SEEKER_STATUSES).map(r => r.id);
  let newTotal = 0;
  for (const id of ids) {
    try { newTotal += (await runForSeeker(id, { withAi: false, markNew: true })).newCount; } catch { /* 実行中はスキップ */ }
  }
  return { seekers: ids.length, newCandidates: newTotal };
}

module.exports = { runForSeeker, rematchActiveSeekers, solicitationGuard, evaluate, activePostings };
