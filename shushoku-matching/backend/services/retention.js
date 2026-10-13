'use strict';

// 保存期限の管理
// 帳簿は「完結の日から2年間」保存（施行規則。要確認）。求職者は紹介終了（就職・終了・削除）日を起点に
// retention_years 年後を保存期限とし、期限到来後に個人データを削除する。削除そのものは監査ログに件数のみ残す

const { getDb, getSettings, audit } = require('../database/db');
const { todayJst, addYears } = require('../utils/dates');

function retentionFrom(closedDate) {
  const years = Number(getSettings().retention_years || 2);
  return addYears(closedDate, years);
}

// 就職・終了・論理削除時に呼ぶ。入職後の6か月フォローがある場合は、その後を起点にする
function closeSeeker(seekerId, closedDate = todayJst()) {
  const db = getDb();
  const lastPlacement = db.prepare(`SELECT MAX(COALESCE(separation_date, refund_date, paid_date, hire_date)) d FROM placements WHERE seeker_id = ?`).get(seekerId).d;
  const base = [closedDate, lastPlacement].filter(Boolean).sort().pop();
  db.prepare('UPDATE job_seekers SET closed_date = ?, retention_until = ? WHERE id = ?').run(closedDate, retentionFrom(base), seekerId);
}

function reopenSeeker(seekerId) {
  getDb().prepare('UPDATE job_seekers SET closed_date = NULL, retention_until = NULL WHERE id = ?').run(seekerId);
}

function purgeCandidates(until = todayJst()) {
  return getDb().prepare(`SELECT id, name, status, closed_date, retention_until, deleted_at FROM job_seekers
    WHERE retention_until IS NOT NULL AND retention_until <= ? ORDER BY retention_until`).all(until);
}

// 期限到来分を物理削除（関連する面談記録・マッチ・成約・フォロー・提案・下書きも削除）
function purgeExpired(today = todayJst()) {
  const db = getDb();
  const ids = db.prepare('SELECT id FROM job_seekers WHERE retention_until IS NOT NULL AND retention_until < ?').all(today).map(r => r.id);
  if (!ids.length) return 0;
  db.transaction(() => {
    for (const id of ids) {
      const matchIds = db.prepare('SELECT id FROM matches WHERE seeker_id = ?').all(id).map(r => r.id);
      for (const mid of matchIds) db.prepare('DELETE FROM match_events WHERE match_id = ?').run(mid);
      const plIds = db.prepare('SELECT id FROM placements WHERE seeker_id = ?').all(id).map(r => r.id);
      for (const pid of plIds) db.prepare('DELETE FROM followups WHERE placement_id = ?').run(pid);
      db.prepare('DELETE FROM placements WHERE seeker_id = ?').run(id);
      db.prepare('DELETE FROM matches WHERE seeker_id = ?').run(id);
      for (const t of ['interview_notes', 'commute_cache', 'proposals', 'drafts', 'tasks']) {
        db.prepare(`DELETE FROM ${t} WHERE seeker_id = ?`).run(id);
      }
      db.prepare('UPDATE complaints SET seeker_id = NULL, from_name = NULL WHERE seeker_id = ?').run(id);
      db.prepare('UPDATE ai_requests SET seeker_id = NULL WHERE seeker_id = ?').run(id);
      db.prepare('DELETE FROM job_seekers WHERE id = ?').run(id);
    }
  })();
  audit('retention_purge', null, { count: ids.length });
  return ids.length;
}

module.exports = { closeSeeker, reopenSeeker, purgeCandidates, purgeExpired, retentionFrom };
