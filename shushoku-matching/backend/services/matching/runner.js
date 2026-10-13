'use strict';

const { getDb, getSettings, audit } = require('../../database/db');
const { scoreMatch } = require('./ruleScore');
const ai = require('./aiAdvisor');

// 求職者1名について全有効求人を判定し matches を更新
async function runForSeeker(seekerId, { withAi = true } = {}) {
  const db = getDb();
  const seeker = db.prepare('SELECT * FROM job_seekers WHERE id = ?').get(seekerId);
  if (!seeker) throw new Error('求職者が見つかりません');
  const settings = getSettings();
  const minScore = parseInt(settings.match_min_score, 10) || 0;

  const postings = db.prepare('SELECT * FROM job_postings WHERE is_active = 1').all();
  const hits = [];
  let excluded = 0;
  for (const p of postings) {
    const m = scoreMatch(seeker, p);
    if (m.excluded) { excluded++; continue; }
    if (m.score < minScore) continue;
    hits.push({ posting: p, match: m });
  }
  hits.sort((a, b) => b.match.score - a.match.score);

  const upsert = db.prepare(`INSERT INTO matches (seeker_id, posting_id, score, breakdown)
    VALUES (?,?,?,?)
    ON CONFLICT(seeker_id, posting_id) DO UPDATE SET score = excluded.score,
      breakdown = excluded.breakdown, judged_at = datetime('now','localtime')`);
  db.transaction(() => {
    // 未提案のまま今回該当しなくなった候補は削除（提案済以降は履歴として残す）
    const keep = new Set(hits.map(h => h.posting.id));
    for (const old of db.prepare(`SELECT id, posting_id FROM matches
      WHERE seeker_id = ? AND intro_status = '未提案'`).all(seekerId)) {
      if (!keep.has(old.posting_id)) db.prepare('DELETE FROM matches WHERE id = ?').run(old.id);
    }
    for (const h of hits) upsert.run(seekerId, h.posting.id, h.match.score, JSON.stringify(h.match));
  })();
  audit('match_run', seekerId, { candidates: hits.length, excluded });

  let aiStatus = 'skipped';
  const topN = parseInt(settings.ai_top_n, 10) || 5;
  if (!withAi || settings.ai_enabled !== '1') aiStatus = 'AI補足は設定で無効';
  else if (!seeker.ai_consent) aiStatus = '求職者のAI利用同意なし';
  else if (!ai.isAvailable()) aiStatus = 'APIキー未設定（ルール判定のみ）';
  else if (hits.length) {
    try {
      const top = hits.slice(0, topN);
      const { payload, comments } = await ai.advise(seeker, top);
      audit('ai_send', seekerId, { model: ai.MODEL, postings: top.map(t => t.posting.posting_no), fields: Object.keys(payload.求職者) });
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

  return { candidates: hits.length, excluded, total: postings.length, aiStatus };
}

module.exports = { runForSeeker };
