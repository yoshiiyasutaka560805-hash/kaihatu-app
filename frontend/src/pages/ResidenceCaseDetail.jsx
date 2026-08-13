import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { STAGE_LABEL, CASE_TYPE_LABEL } from './ResidenceCaseList';

const STAGES = ['collecting', 'drafting', 'internal_review', 'ready_to_submit', 'submitted', 'approved', 'rejected'];

export default function ResidenceCaseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'staff';
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getResidenceCase(id).then(d => { setDetail(d); setLoading(false); });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleStageChange(stage) {
    const comment = window.prompt('ステージ変更のコメント（任意）') || '';
    setAdvancing(true);
    try {
      await api.updateResidenceCaseStage(id, stage, comment);
      load();
    } finally {
      setAdvancing(false);
    }
  }

  async function handleDocCheck(itemId, isSubmitted) {
    await api.saveCaseDocumentChecks(id, [{ case_document_item_id: itemId, is_submitted: isSubmitted ? 1 : 0 }]);
    load();
  }

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!detail) return <div className="loading">案件が見つかりません</div>;

  const currentStageIndex = STAGES.indexOf(detail.stage);

  return (
    <div>
      <div className="no-print">
        <Link to="/residence-cases" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>
          ← 案件一覧に戻る
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '12px 0 20px' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            <Link to={`/workers/${detail.foreign_worker_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              {detail.name_native}
            </Link>
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            {CASE_TYPE_LABEL[detail.case_type] || detail.case_type}
          </div>
        </div>
        <span className="badge blue">{STAGE_LABEL[detail.stage] || detail.stage}</span>
      </div>

      <div className="card">
        <div className="card-title">進捗ステージ</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STAGES.map((s, idx) => (
            <button
              key={s}
              disabled={!canEdit || advancing}
              onClick={() => handleStageChange(s)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '2px solid',
                borderColor: s === detail.stage ? '#2563eb' : '#e5e7eb',
                background: idx <= currentStageIndex && s !== 'rejected' ? '#eff6ff' : 'white',
                fontWeight: s === detail.stage ? 700 : 400,
                cursor: canEdit ? 'pointer' : 'default',
                fontSize: 13,
              }}
            >
              {STAGE_LABEL[s]}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>提出期限</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{detail.submission_deadline || '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>提出日</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{detail.submitted_date || '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>担当者</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{detail.responsible_name || '-'}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">提出書類チェックリスト（{detail.document_submitted}/{detail.document_total}）</div>
        {detail.documents.map(doc => (
          <div key={doc.id} className="checklist-item">
            <input
              type="checkbox"
              checked={doc.is_submitted === 1}
              disabled={!canEdit}
              onChange={e => handleDocCheck(doc.id, e.target.checked)}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{doc.item_name}</div>
              {doc.submit_to && <div style={{ fontSize: 11, color: '#6b7280' }}>提出先: {doc.submit_to}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="card no-print">
        <div className="card-title">ステータス変更履歴</div>
        {detail.history.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 13 }}>履歴はありません</div>
        ) : (
          detail.history.map(h => (
            <div key={h.id} style={{ fontSize: 12, borderBottom: '1px solid #f3f4f6', padding: '8px 0' }}>
              {h.from_stage ? `${STAGE_LABEL[h.from_stage]} → ` : ''}{STAGE_LABEL[h.to_stage]}
              <span style={{ color: '#9ca3af', marginLeft: 8 }}>
                {h.changed_by_name} ・ {new Date(h.changed_at).toLocaleString('ja-JP')}
              </span>
              {h.comment && <div style={{ marginTop: 2 }}>{h.comment}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
