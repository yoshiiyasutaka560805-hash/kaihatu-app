import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_LABEL = { todo: '未着手', in_progress: '対応中', done: '完了', cancelled: '取消' };
const PRIORITY_LABEL = { low: '低', normal: '中', high: '高' };
const TASK_TYPE_LABEL = {
  document_request: '書類依頼', seal_request: '押印依頼', interview: '面談', submission: '提出', other: 'その他',
};

export default function TaskBoard() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'staff';
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [users, setUsers] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = statusFilter ? { status: statusFilter } : {};
    api.getTasks(params).then(rows => { setTasks(rows); setLoading(false); });
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (user?.role === 'admin') api.getUsers().then(setUsers); }, [user]);

  async function handleStatusChange(taskId, status) {
    await api.updateTaskStatus(taskId, status);
    load();
  }

  async function handleDelete(taskId) {
    if (!confirm('このタスクを削除しますか？')) return;
    await api.deleteTask(taskId);
    load();
  }

  async function handleCreate(form) {
    await api.createTask(form);
    setShowForm(false);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">タスク管理</div>
        <div className="page-subtitle">申請手続きに関わる書類依頼・押印依頼・面談などのタスクを管理</div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <select className="form-select" style={{ maxWidth: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">全ステータス</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {canEdit && (
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowForm(v => !v)}>
              {showForm ? '閉じる' : '＋ 新規タスク'}
            </button>
          )}
        </div>

        {showForm && <NewTaskForm onSubmit={handleCreate} />}

        {loading ? (
          <div className="loading">読み込み中...</div>
        ) : tasks.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 13, padding: 20, textAlign: 'center' }}>タスクはありません</div>
        ) : (
          tasks.map(t => (
            <div key={t.id} style={{ borderBottom: '1px solid #f3f4f6', padding: '10px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`badge ${t.priority === 'high' ? 'red' : t.priority === 'low' ? 'gray' : 'yellow'}`}>
                  優先度{PRIORITY_LABEL[t.priority]}
                </span>
                <span style={{ fontWeight: 600, fontSize: 13, cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
                  {t.title}
                </span>
                <span className="badge gray">{TASK_TYPE_LABEL[t.task_type] || t.task_type}</span>
                {t.worker_name && <span style={{ fontSize: 12, color: '#6b7280' }}>{t.worker_name}</span>}
                <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 'auto' }}>
                  {t.assignee_name || '未割当'} ・ 期限: {t.due_date || '-'}
                </span>
                {canEdit && (
                  <select
                    className="form-select"
                    style={{ maxWidth: 110, padding: '4px 6px', fontSize: 12 }}
                    value={t.status}
                    onChange={e => handleStatusChange(t.id, e.target.value)}
                  >
                    {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                )}
                {canEdit && (
                  <button className="btn btn-outline btn-sm" onClick={() => handleDelete(t.id)}>削除</button>
                )}
              </div>
              {t.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, marginLeft: 2 }}>{t.description}</div>}
              {expandedId === t.id && <TaskComments taskId={t.id} canEdit={canEdit} />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NewTaskForm({ onSubmit }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('other');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('normal');

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title, description, task_type: taskType, due_date: dueDate || null, priority });
    setTitle(''); setDescription(''); setDueDate('');
  }

  return (
    <form onSubmit={handleSubmit} style={{ borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '16px 0', marginBottom: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">タイトル</label>
          <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">種別</label>
          <select className="form-select" value={taskType} onChange={e => setTaskType(e.target.value)}>
            {Object.entries(TASK_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">期限</label>
          <input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">優先度</label>
          <select className="form-select" value={priority} onChange={e => setPriority(e.target.value)}>
            {Object.entries(PRIORITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">詳細</label>
        <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <button type="submit" className="btn btn-primary btn-sm">作成</button>
    </form>
  );
}

function TaskComments({ taskId, canEdit }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');

  const load = useCallback(() => {
    api.getTask(taskId).then(d => setComments(d.comments || []));
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await api.addTaskComment(taskId, text);
    setText('');
    load();
  }

  return (
    <div style={{ marginLeft: 24, marginTop: 8, background: '#f9fafb', borderRadius: 8, padding: 10 }}>
      {comments.length === 0 ? (
        <div style={{ fontSize: 12, color: '#9ca3af' }}>コメントはまだありません</div>
      ) : (
        comments.map(c => (
          <div key={c.id} style={{ fontSize: 12, marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>{c.author_name}</span>
            <span style={{ color: '#9ca3af', marginLeft: 6 }}>{new Date(c.created_at).toLocaleString('ja-JP')}</span>
            <div>{c.comment}</div>
          </div>
        ))
      )}
      {canEdit && (
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input className="form-input" style={{ fontSize: 12 }} value={text} onChange={e => setText(e.target.value)} placeholder="コメントを追加..." />
          <button type="submit" className="btn btn-outline btn-sm">送信</button>
        </form>
      )}
    </div>
  );
}
