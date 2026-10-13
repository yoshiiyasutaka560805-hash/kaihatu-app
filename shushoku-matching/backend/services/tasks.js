'use strict';

// 今日のタスク：期限・予定から自動生成＋手動タスク
const { getDb, getSettings } = require('../database/db');
const { todayJst, addDays, diffDays } = require('../utils/dates');

function todayTasks(today = todayJst()) {
  const db = getDb();
  const in7 = addDays(today, 7);
  const tasks = [];
  const push = (t) => tasks.push(t);

  // 面接（今日・明日・期限超過で結果未入力）
  for (const r of db.prepare(`SELECT m.id, m.seeker_id, m.interview_at, s.name, p.company_name FROM matches m
      JOIN job_seekers s ON s.id = m.seeker_id JOIN job_postings p ON p.id = m.posting_id
      WHERE s.deleted_at IS NULL AND m.intro_status = '面接' AND m.interview_at IS NOT NULL`).all()) {
    const d = r.interview_at.slice(0, 10);
    if (d === today || d === addDays(today, 1)) {
      push({ kind: '面接', priority: d === today ? 1 : 2, due: r.interview_at, title: `${r.name}さん 面接（${r.company_name}）`, link: `/seekers/${r.seeker_id}/matches` });
    } else if (d < today) {
      push({ kind: '面接結果', priority: 1, due: d, title: `${r.name}さん 面接結果の入力（${r.company_name}）`, link: `/seekers/${r.seeker_id}/matches` });
    }
  }

  // 入職後フォロー（期限が7日以内・超過で未実施）
  for (const r of db.prepare(`SELECT f.id, f.kind, f.due_date, pl.id AS placement_id, s.name FROM followups f
      JOIN placements pl ON pl.id = f.placement_id JOIN job_seekers s ON s.id = pl.seeker_id
      WHERE f.done_date IS NULL AND pl.separation_date IS NULL AND f.due_date <= ?`).all(in7)) {
    push({ kind: '定着フォロー', priority: r.due_date <= today ? 1 : 3, due: r.due_date,
      title: `${r.name}さん 入職後${r.kind}フォロー${r.kind === '6か月' ? '（事業報告の6か月以内離職確認）' : ''}`, link: `/placements/${r.placement_id}` });
  }

  // 在留期限（90日以内）・在留カード未確認
  for (const r of db.prepare(`SELECT id, name, residence_expiry, residence_checked_date, status FROM job_seekers
      WHERE deleted_at IS NULL AND is_foreign_national = 1 AND status NOT IN ('終了')`).all()) {
    if (r.residence_expiry) {
      const left = diffDays(today, r.residence_expiry);
      if (left <= 90) push({ kind: '在留期限', priority: left <= 30 ? 1 : 2, due: r.residence_expiry, title: `${r.name}さん 在留期限まで${left}日`, link: `/seekers/${r.id}` });
    }
    if (!r.residence_checked_date && r.status !== '就職') push({ kind: '在留確認', priority: 2, due: null, title: `${r.name}さん 在留カード原本の確認記録がありません`, link: `/seekers/${r.id}` });
  }

  // 紹介中の求人の紹介期限（7日以内）
  for (const r of db.prepare(`SELECT DISTINCT p.id, p.company_name, p.job_title, p.expiry_date FROM matches m
      JOIN job_postings p ON p.id = m.posting_id
      WHERE m.intro_status IN ('提案済','応募','面接') AND p.is_active = 1 AND p.expiry_date BETWEEN ? AND ?`).all(today, in7)) {
    push({ kind: '紹介期限', priority: 3, due: r.expiry_date, title: `求人「${r.company_name} ${r.job_title}」の紹介期限 ${r.expiry_date}`, link: `/postings/${r.id}` });
  }

  // 請求・入金
  for (const r of db.prepare(`SELECT pl.id, pl.due_date, pl.invoice_date, pl.hire_date, s.name, p.company_name FROM placements pl
      JOIN job_seekers s ON s.id = pl.seeker_id JOIN job_postings p ON p.id = pl.posting_id
      WHERE pl.paid_date IS NULL`).all()) {
    if (!r.invoice_date && r.hire_date <= today) push({ kind: '請求', priority: 2, due: r.hire_date, title: `${r.company_name}へ請求書発行（${r.name}さん入職）`, link: `/placements/${r.id}` });
    else if (r.due_date && r.due_date < today) push({ kind: '入金', priority: 1, due: r.due_date, title: `${r.company_name} 入金期日超過`, link: `/placements/${r.id}` });
  }

  // 求職の有効期間切れ（7日以内）
  for (const r of db.prepare(`SELECT id, name, validity_end FROM job_seekers WHERE deleted_at IS NULL
      AND status IN ('受付','紹介中','面接') AND validity_end IS NOT NULL AND validity_end <= ?`).all(in7)) {
    push({ kind: '求職有効期間', priority: 3, due: r.validity_end, title: `${r.name}さん 求職の有効期間（${r.validity_end}）の更新確認`, link: `/seekers/${r.id}` });
  }

  // 新着候補
  const news = db.prepare(`SELECT s.id, s.name, COUNT(*) c FROM matches m JOIN job_seekers s ON s.id = m.seeker_id
    WHERE m.is_new = 1 AND s.deleted_at IS NULL GROUP BY s.id`).all();
  for (const r of news) push({ kind: '新着候補', priority: 3, due: null, title: `${r.name}さんに新着候補 ${r.c}件`, link: `/seekers/${r.id}/matches` });

  // 承認待ち下書き
  const drafts = db.prepare("SELECT COUNT(*) c FROM drafts WHERE status = 'pending'").get().c;
  if (drafts) push({ kind: '承認待ち', priority: 2, due: null, title: `承認待ちの下書き ${drafts}件（受付フォーム・AI抽出・求人票読取）`, link: '/drafts' });

  // 苦情（未完了）
  const comp = db.prepare('SELECT COUNT(*) c FROM complaints WHERE completed_date IS NULL').get().c;
  if (comp) push({ kind: '苦情対応', priority: 1, due: null, title: `対応中の苦情 ${comp}件`, link: '/complaints' });

  // 保存期限による削除予定（7日以内）
  const purge = db.prepare('SELECT COUNT(*) c FROM job_seekers WHERE retention_until IS NOT NULL AND retention_until <= ?').get(in7).c;
  if (purge) push({ kind: '削除予定', priority: 3, due: null, title: `保存期限到来による削除予定 ${purge}件`, link: '/settings' });

  // 事業報告（4月）
  if (today.slice(5, 7) === '04') push({ kind: '事業報告', priority: today.slice(8) >= '20' ? 1 : 2, due: `${today.slice(0, 4)}-04-30`, title: '職業紹介事業報告書の提出（4月30日まで）', link: '/reports' });

  // 手動タスク
  for (const r of db.prepare(`SELECT t.*, s.name FROM tasks t LEFT JOIN job_seekers s ON s.id = t.seeker_id
      WHERE t.done_at IS NULL AND (t.due_date IS NULL OR t.due_date <= ?)`).all(in7)) {
    push({ kind: 'タスク', priority: r.due_date && r.due_date <= today ? 1 : 3, due: r.due_date, title: r.name ? `${r.title}（${r.name}さん）` : r.title,
      link: r.seeker_id ? `/seekers/${r.seeker_id}` : null, taskId: r.id });
  }

  tasks.sort((a, b) => a.priority - b.priority || String(a.due || '9').localeCompare(String(b.due || '9')));
  return tasks;
}

module.exports = { todayTasks };
