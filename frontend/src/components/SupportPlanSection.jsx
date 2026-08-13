import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

const STATUS_LABEL = { planned: '未実施', in_progress: '実施中', completed: '実施済', not_applicable: '対象外' };
const RISK_LABEL = { red: '要対応', yellow: '未完了あり', green: '完了' };

export default function SupportPlanSection({ workerId, canEdit }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.getWorkerSupportPlan(workerId).then(d => { setData(d); setLoading(false); });
  }, [workerId]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(item, status) {
    await api.saveSupportPlanChecks(workerId, [{ support_plan_item_id: item.id, status, implementation_date: item.implementation_date, implementer_name: item.implementer_name, notes: item.check_notes }]);
    load();
  }

  async function handleFieldBlur(item, field, value) {
    await api.saveSupportPlanChecks(workerId, [{
      support_plan_item_id: item.id,
      status: item.status || 'planned',
      implementation_date: field === 'implementation_date' ? value : item.implementation_date,
      implementer_name: field === 'implementer_name' ? value : item.implementer_name,
      notes: field === 'check_notes' ? value : item.check_notes,
    }]);
    load();
  }

  async function handleEvidenceCheck(item, evidenceDefId, isConfirmed) {
    if (!item.check_id) {
      await api.saveSupportPlanChecks(workerId, [{ support_plan_item_id: item.id, status: item.status || 'in_progress' }]);
      const refreshed = await api.getWorkerSupportPlan(workerId);
      const refreshedItem = refreshed.items.find(i => i.id === item.id);
      await api.saveSupportEvidenceChecks(workerId, refreshedItem.check_id, [{ evidence_template_def_id: evidenceDefId, is_confirmed: isConfirmed ? 1 : 0 }]);
    } else {
      await api.saveSupportEvidenceChecks(workerId, item.check_id, [{ evidence_template_def_id: evidenceDefId, is_confirmed: isConfirmed ? 1 : 0 }]);
    }
    load();
  }

  async function handleEvidenceUpload(item, e) {
    const file = e.target.files[0];
    if (!file || !item.check_id) {
      if (!item.check_id) alert('先に実施状況を「実施中」以上に設定してください');
      return;
    }
    await api.uploadSupportEvidenceFile(workerId, item.check_id, file);
    load();
    e.target.value = '';
  }

  if (loading) return <div className="card"><div className="loading">読み込み中...</div></div>;
  if (!data) return null;

  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>支援計画（法定10項目）</span>
        {data.risk && (
          <span className={`badge ${data.risk.support_plan_risk_level}`}>
            {RISK_LABEL[data.risk.support_plan_risk_level]}（{data.risk.completed_count}/{data.risk.total_items}）
          </span>
        )}
      </div>

      {data.items.map(item => (
        <div key={item.id} style={{ borderBottom: '1px solid #f3f4f6', padding: '10px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{ fontWeight: 500, fontSize: 13, cursor: 'pointer', flex: 1 }}
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
            >
              {item.sort_order}. {item.item_name}
            </span>
            {canEdit ? (
              <select
                className="form-select"
                style={{ maxWidth: 110, padding: '4px 6px', fontSize: 12 }}
                value={item.status || 'planned'}
                onChange={e => handleStatusChange(item, e.target.value)}
              >
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ) : (
              <span className="badge gray">{STATUS_LABEL[item.status || 'planned']}</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, marginLeft: 2 }}>{item.description}</div>

          {expandedId === item.id && (
            <div style={{ marginTop: 8, marginLeft: 2, background: '#f9fafb', borderRadius: 8, padding: 10 }}>
              {canEdit && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">実施日</label>
                    <input
                      type="date" className="form-input" defaultValue={item.implementation_date || ''}
                      onBlur={e => handleFieldBlur(item, 'implementation_date', e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">実施者</label>
                    <input
                      className="form-input" defaultValue={item.implementer_name || ''}
                      onBlur={e => handleFieldBlur(item, 'implementer_name', e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>根拠書類</div>
              {item.evidenceTemplates.map(et => (
                <div key={et.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={et.is_confirmed === 1}
                    disabled={!canEdit}
                    onChange={e => handleEvidenceCheck(item, et.id, e.target.checked)}
                  />
                  <span>{et.evidence_name}</span>
                </div>
              ))}

              {item.files.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {item.files.map(f => (
                    <div key={f.id} style={{ fontSize: 11, color: '#2563eb' }}>
                      <a href={api.workerFileDownloadUrl(workerId, f.id)} target="_blank" rel="noreferrer">📄 {f.original_name}</a>
                    </div>
                  ))}
                </div>
              )}

              {canEdit && (
                <label className="btn btn-outline btn-sm no-print" style={{ marginTop: 8, cursor: 'pointer', display: 'inline-block' }}>
                  証拠ファイルをアップロード
                  <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleEvidenceUpload(item, e)} />
                </label>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
