import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const STAGE_LABEL = {
  collecting: '書類収集中', drafting: '書類作成中', internal_review: '内部確認中',
  ready_to_submit: '提出準備完了', submitted: '提出済み', approved: '許可', rejected: '不許可',
};
const CASE_TYPE_LABEL = {
  certificate_of_eligibility: '在留資格認定証明書交付申請',
  status_change: '在留資格変更許可申請',
  renewal: '在留期間更新許可申請',
  extension: '在留期間の延長等',
  other: 'その他',
};

export default function ResidenceCaseList() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'staff';
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = stageFilter ? { stage: stageFilter } : {};
    api.getResidenceCases(params).then(rows => { setCases(rows); setLoading(false); });
  }, [stageFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (canEdit) api.getWorkers().then(setWorkers); }, [canEdit]);

  async function handleCreate(form) {
    setError('');
    try {
      await api.createResidenceCase(form);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message || '作成に失敗しました');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">在留資格申請案件管理</div>
        <div className="page-subtitle">申請案件の進捗を7段階で管理</div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <select className="form-select" style={{ maxWidth: 200 }} value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
            <option value="">全ステージ</option>
            {Object.entries(STAGE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {canEdit && (
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowForm(v => !v)}>
              {showForm ? '閉じる' : '＋ 新規案件作成'}
            </button>
          )}
        </div>

        {showForm && <NewCaseForm workers={workers} onSubmit={handleCreate} error={error} />}

        {loading ? (
          <div className="loading">読み込み中...</div>
        ) : cases.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 13, padding: 20, textAlign: 'center' }}>該当する案件がありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>従業員</th>
                <th>申請種別</th>
                <th>ステージ</th>
                <th>提出期限</th>
                <th>書類進捗</th>
                <th>担当者</th>
              </tr>
            </thead>
            <tbody>
              {cases.map(c => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/residence-cases/${c.id}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
                      {c.name_native}
                    </Link>
                  </td>
                  <td style={{ fontSize: 12 }}>{CASE_TYPE_LABEL[c.case_type] || c.case_type}</td>
                  <td><span className="badge blue">{STAGE_LABEL[c.stage] || c.stage}</span></td>
                  <td>{c.submission_deadline || '-'}</td>
                  <td>{c.document_submitted}/{c.document_total}</td>
                  <td>{c.responsible_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function NewCaseForm({ workers, onSubmit, error }) {
  const [foreignWorkerId, setForeignWorkerId] = useState('');
  const [caseType, setCaseType] = useState('renewal');
  const [submissionDeadline, setSubmissionDeadline] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!foreignWorkerId) return;
    onSubmit({ foreign_worker_id: foreignWorkerId, case_type: caseType, submission_deadline: submissionDeadline || null });
  }

  return (
    <form onSubmit={handleSubmit} style={{ borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '16px 0', marginBottom: 12 }}>
      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', fontSize: 13, padding: 8, borderRadius: 6, marginBottom: 12 }}>{error}</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">対象従業員</label>
          <select className="form-select" value={foreignWorkerId} onChange={e => setForeignWorkerId(e.target.value)} required>
            <option value="">選択してください</option>
            {workers.map(w => <option key={w.id} value={w.id}>{w.name_native}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">申請種別</label>
          <select className="form-select" value={caseType} onChange={e => setCaseType(e.target.value)}>
            {Object.entries(CASE_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">提出期限</label>
          <input type="date" className="form-input" value={submissionDeadline} onChange={e => setSubmissionDeadline(e.target.value)} />
        </div>
      </div>
      <button type="submit" className="btn btn-primary btn-sm">作成</button>
    </form>
  );
}

export { STAGE_LABEL, CASE_TYPE_LABEL };
