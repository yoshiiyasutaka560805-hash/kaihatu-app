import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post, put } from '../api/client';
import { useApi, useAction } from '../hooks/useApi';
import { PageHeader, Card, ErrorText, Loading, Badge } from '../components/ui';

// 今日のタスク：GET /tasks/today（期限・予定から自動生成＋手動タスク）

const KIND_COLOR = {
  面接: 'orange', 面接結果: 'red', 定着フォロー: 'blue', 在留期限: 'red', 在留確認: 'orange', 紹介期限: 'yellow',
  請求: 'orange', 入金: 'red', 求職有効期間: 'yellow', 新着候補: 'blue', 承認待ち: 'orange', 苦情対応: 'red',
  削除予定: 'gray', 事業報告: 'red', タスク: 'gray',
};
const PRIO_LABEL = { 1: '高', 2: '中', 3: '低' };

const SHORTCUTS = [
  { to: '/seekers/new', label: '＋ 求職者を登録' },
  { to: '/postings', label: '求人の取込・一覧' },
  { to: '/drafts', label: '承認待ち' },
  { to: '/placements', label: '成約・請求' },
  { to: '/complaints', label: '苦情受付簿' },
];

function fmtDue(due) {
  if (!due) return '';
  return String(due).replace('T', ' ').slice(0, 16);
}

export default function Home() {
  const { data, error, loading, reload } = useApi(() => get('/tasks/today'), []);
  const [doneRun, doneBusy, doneError] = useAction();
  const [addRun, addBusy, addError, setAddError] = useAction();
  const [form, setForm] = useState({ title: '', due_date: '' });
  const [msg, setMsg] = useState('');

  const tasks = useMemo(() => {
    const list = Array.isArray(data) ? [...data] : [];
    // サーバ側でもソート済みだが念のため優先度→期限順
    return list.sort((a, b) => (a.priority || 3) - (b.priority || 3) || String(a.due || '9').localeCompare(String(b.due || '9')));
  }, [data]);

  const summary = useMemo(() => {
    const m = new Map();
    for (const t of tasks) m.set(t.kind, (m.get(t.kind) || 0) + 1);
    return [...m.entries()];
  }, [tasks]);
  const highCount = tasks.filter(t => t.priority === 1).length;

  const markDone = async (t) => {
    setMsg('');
    try {
      await doneRun(() => put(`/tasks/${t.taskId}/done`));
      setMsg(`「${t.title}」を完了にしました`);
      reload();
    } catch { /* useAction がエラーを保持 */ }
  };

  const addTask = async () => {
    setMsg('');
    if (!form.title.trim()) { setAddError('タイトルを入力してください'); return; }
    try {
      await addRun(() => post('/tasks', { title: form.title.trim(), due_date: form.due_date || null }));
      setForm({ title: '', due_date: '' });
      setMsg('タスクを追加しました（期限が7日より先のタスクは、期限の7日前から表示されます）');
      reload();
    } catch { /* useAction がエラーを保持 */ }
  };

  return (
    <div>
      <PageHeader title="今日のタスク" subtitle={`本日 ${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}`}>
        <button type="button" className="btn btn-outline btn-sm" onClick={reload} disabled={loading}>再読込</button>
      </PageHeader>

      <div className="row" style={{ marginBottom: 16 }}>
        {SHORTCUTS.map(s => <Link key={s.to} to={s.to} className="btn btn-outline">{s.label}</Link>)}
      </div>

      <ErrorText error={error} />
      {loading && !data && <Loading />}

      {data && (
        <>
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <div className={`stat-card ${highCount ? 'stat-red' : 'stat-green'}`}>
              <div className="stat-number">{highCount}</div>
              <div className="stat-label">優先度：高</div>
            </div>
            <div className="stat-card stat-blue">
              <div className="stat-number">{tasks.length}</div>
              <div className="stat-label">対応事項 合計</div>
            </div>
          </div>
          {summary.length > 0 && (
            <div className="row" style={{ marginBottom: 16 }} aria-label="種類別件数">
              {summary.map(([kind, n]) => (
                <span key={kind} className="row" style={{ gap: 4 }}>
                  <Badge color={KIND_COLOR[kind]}>{kind}</Badge><b>{n}</b>件
                </span>
              ))}
            </div>
          )}

          <Card title="対応事項（優先度順）">
            <ErrorText error={doneError} />
            {msg && <div className="ok-box">{msg}</div>}
            {tasks.length === 0 && <div className="muted" style={{ padding: 12 }}>本日の対応事項はありません</div>}
            {tasks.map((t, i) => (
              <div key={`${t.kind}-${t.taskId || ''}-${i}`} className={`task-item prio-${t.priority || 3}`}>
                <span className="muted" title="優先度" style={{ minWidth: 20 }}>{PRIO_LABEL[t.priority] || ''}</span>
                <Badge color={KIND_COLOR[t.kind]}>{t.kind}</Badge>
                <div style={{ flex: 1 }}>
                  {t.link ? <Link to={t.link}>{t.title}</Link> : t.title}
                  {t.due && <div className="muted">期限・予定：{fmtDue(t.due)}</div>}
                </div>
                {t.taskId && (
                  <button type="button" className="btn btn-outline btn-sm" disabled={doneBusy} onClick={() => markDone(t)}>完了</button>
                )}
              </div>
            ))}
          </Card>
        </>
      )}

      <Card title="手動タスクを追加">
        <div className="grid2">
          <div className="form-group">
            <label className="form-label" htmlFor="task-title">タイトル<span className="req"> *</span></label>
            <input id="task-title" className="form-input" value={form.title} maxLength={200}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addTask(); }} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="task-due">期限</label>
            <input id="task-due" className="form-input" type="date" value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
        </div>
        <ErrorText error={addError} />
        <button type="button" className="btn btn-primary" disabled={addBusy} onClick={addTask}>{addBusy ? '追加中…' : '追加'}</button>
        <div className="muted" style={{ marginTop: 6 }}>期限なし、または期限が7日以内のタスクが一覧に表示されます。</div>
      </Card>
    </div>
  );
}
