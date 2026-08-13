import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ExpiryBadge from '../components/ExpiryBadge';
import WorkerForm from '../components/WorkerForm';

const EMPLOYMENT_STATUS_LABEL = { active: '在籍中', on_leave: '休職中', resigned: '退職済' };
const NOTE_TYPE_LABEL = { general: '一般', interview: '面談', complaint: '苦情対応', consultation: '相談' };
const CATEGORY_LABEL = {
  residence_card: '在留カード写し', passport: 'パスポート写し', contract: '雇用契約書',
  certificate: '証明書', support_evidence: '支援根拠書類', photo: '写真', other: 'その他',
};

export default function WorkerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'staff';

  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.getWorker(id).then(d => { setWorker(d); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleUpdate(data) {
    setError('');
    try {
      await api.updateWorker(id, data);
      setEditing(false);
      load();
    } catch (err) {
      setError(err.message || '更新に失敗しました');
    }
  }

  async function handleDeactivate() {
    if (!confirm('この従業員を無効化しますか？（一覧から非表示になります）')) return;
    await api.deactivateWorker(id);
    navigate('/workers');
  }

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!worker) return <div className="loading">従業員が見つかりません</div>;

  return (
    <div>
      <div className="no-print">
        <Link to="/workers" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>
          ← 従業員一覧に戻る
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '12px 0 20px' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{worker.name_native}</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            {worker.name_kana || worker.name_romaji} ・ {worker.nationality} ・ {worker.residence_status || '在留資格未登録'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ExpiryBadge date={worker.residence_period_to} level={worker.residence_risk_level} />
          <span className="badge gray">{EMPLOYMENT_STATUS_LABEL[worker.employment_status] || worker.employment_status}</span>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', fontSize: 13, padding: 8, borderRadius: 6, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>基本情報</span>
          {canEdit && (
            <button className="btn btn-outline btn-sm no-print" onClick={() => setEditing(v => !v)}>
              {editing ? 'キャンセル' : '編集'}
            </button>
          )}
        </div>
        <WorkerForm
          initialValues={worker}
          onSubmit={handleUpdate}
          submitLabel="更新を保存"
          readOnly={!editing}
        />
      </div>

      <NotesSection workerId={id} notes={worker.notes} canEdit={canEdit} onChanged={load} />
      <FilesSection workerId={id} files={worker.files} canEdit={canEdit} onChanged={load} />

      {canEdit && worker.employment_status !== 'resigned' && (
        <div className="card no-print">
          <div className="card-title">従業員の無効化</div>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
            無効化すると一覧に表示されなくなりますが、データは監査目的で保持されます。
          </p>
          <button className="btn btn-danger btn-sm" onClick={handleDeactivate}>この従業員を無効化する</button>
        </div>
      )}
    </div>
  );
}

function NotesSection({ workerId, notes, canEdit, onChanged }) {
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [isImportant, setIsImportant] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await api.addWorkerNote(workerId, { note_type: noteType, content, is_important: isImportant });
      setContent('');
      setIsImportant(false);
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(noteId) {
    if (!confirm('このメモを削除しますか？')) return;
    await api.deleteWorkerNote(workerId, noteId);
    onChanged();
  }

  return (
    <div className="card">
      <div className="card-title">メモ・面談記録</div>

      {canEdit && (
        <form onSubmit={handleAdd} style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 12 }} className="no-print">
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <select className="form-select" style={{ maxWidth: 140 }} value={noteType} onChange={e => setNoteType(e.target.value)}>
              {Object.entries(NOTE_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={isImportant} onChange={e => setIsImportant(e.target.checked)} />
              重要
            </label>
          </div>
          <textarea
            className="form-textarea"
            placeholder="面談内容・相談内容・共有事項などを記録..."
            value={content}
            onChange={e => setContent(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>記録する</button>
        </form>
      )}

      {(!notes || notes.length === 0) ? (
        <div style={{ color: '#9ca3af', fontSize: 13 }}>メモはまだありません</div>
      ) : (
        notes.map(n => (
          <div key={n.id} style={{ borderBottom: '1px solid #f3f4f6', padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
              <span>
                <span className="badge gray" style={{ marginRight: 6 }}>{NOTE_TYPE_LABEL[n.note_type] || n.note_type}</span>
                {n.is_important === 1 && <span className="badge red" style={{ marginRight: 6 }}>重要</span>}
                {n.author_name} ・ {n.created_at}
              </span>
              {canEdit && (
                <button className="btn btn-outline btn-sm no-print" onClick={() => handleDelete(n.id)}>削除</button>
              )}
            </div>
            <div style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{n.content}</div>
          </div>
        ))
      )}
    </div>
  );
}

function FilesSection({ workerId, files, canEdit, onChanged }) {
  const [category, setCategory] = useState('residence_card');
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadWorkerFile(workerId, category, file);
      onChanged();
    } catch (err) {
      alert(`アップロード失敗: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(fileId) {
    if (!confirm('このファイルを削除しますか？')) return;
    await api.deleteWorkerFile(workerId, fileId);
    onChanged();
  }

  return (
    <div className="card">
      <div className="card-title">添付ファイル（在留カード・パスポート写し等）</div>

      {canEdit && (
        <div className="no-print" style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <select className="form-select" style={{ maxWidth: 200 }} value={category} onChange={e => setCategory(e.target.value)}>
            {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
            {uploading ? 'アップロード中...' : 'ファイルを選択してアップロード'}
            <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      )}

      {(!files || files.length === 0) ? (
        <div style={{ color: '#9ca3af', fontSize: 13 }}>添付ファイルはまだありません</div>
      ) : (
        files.map(f => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
            <span className="badge gray">{CATEGORY_LABEL[f.category] || f.category}</span>
            <a href={api.workerFileDownloadUrl(workerId, f.id)} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
              {f.original_name}
            </a>
            <span style={{ color: '#9ca3af' }}>({(f.file_size_bytes / 1024).toFixed(0)}KB)</span>
            {canEdit && (
              <button
                onClick={() => handleDelete(f.id)}
                className="btn btn-outline btn-sm no-print"
                style={{ color: '#dc2626', borderColor: '#fca5a5', marginLeft: 'auto' }}
              >
                削除
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
