import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import WorkerForm from '../components/WorkerForm';

export default function WorkerNew() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(data) {
    setError('');
    setSaving(true);
    try {
      const { id } = await api.createWorker(data);
      navigate(`/workers/${id}`);
    } catch (err) {
      setError(err.message || '登録に失敗しました');
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="no-print">
        <Link to="/workers" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>
          ← 従業員一覧に戻る
        </Link>
      </div>

      <div className="page-header">
        <div className="page-title">従業員 新規登録</div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', fontSize: 13, padding: 8, borderRadius: 6, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="card">
        <WorkerForm onSubmit={handleSubmit} submitLabel={saving ? '登録中...' : '登録'} disabled={saving} />
      </div>
    </div>
  );
}
