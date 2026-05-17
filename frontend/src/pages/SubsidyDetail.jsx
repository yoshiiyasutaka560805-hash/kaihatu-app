import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import FileDropzone from '../components/FileDropzone';

const CLAIMING_OPTIONS = [
  { value: 'claiming',     label: '算定中', style: { background: '#dcfce7', color: '#16a34a' } },
  { value: 'not_claiming', label: '非算定', style: { background: '#f3f4f6', color: '#6b7280' } },
  { value: 'unknown',      label: '確認中', style: { background: '#fef9c3', color: '#a16207' } },
];

export default function SubsidyDetail() {
  const { subsidyId, serviceTypeId } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLegal, setShowLegal] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getSubsidyDetail(subsidyId, serviceTypeId)
      .then(d => { setDetail(d); setLoading(false); });
  }, [subsidyId, serviceTypeId]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(value) {
    if (!detail?.assessment_id) return;
    setSaving(true);
    await api.updateAssessment(detail.assessment_id, { claiming_status: value });
    setDetail(d => ({ ...d, claiming_status: value }));
    setSaving(false);
  }

  async function handleTierChange(e) {
    if (!detail?.assessment_id) return;
    await api.updateAssessment(detail.assessment_id, { claiming_tier: e.target.value });
    setDetail(d => ({ ...d, claiming_tier: e.target.value }));
  }

  async function handleNotesChange(e) {
    if (!detail?.assessment_id) return;
    await api.updateAssessment(detail.assessment_id, { notes: e.target.value });
  }

  async function handleConcernsChange(e) {
    if (!detail?.assessment_id) return;
    await api.updateAssessment(detail.assessment_id, { current_concerns: e.target.value });
  }

  async function handleReqCheck(itemId, checked) {
    if (!detail?.assessment_id) return;
    await api.saveReqChecks(detail.assessment_id, [
      { requirement_item_id: itemId, is_satisfied: checked ? 1 : 0 },
    ]);
    setDetail(d => ({
      ...d,
      reqItems: d.reqItems.map(it =>
        it.id === itemId ? { ...it, is_satisfied: checked ? 1 : 0 } : it
      ),
    }));
  }

  async function handleEvidCheck(defId, confirmed) {
    if (!detail?.assessment_id) return;
    const today = new Date().toISOString().slice(0, 10);
    await api.saveEvidChecks(detail.assessment_id, [
      { evidence_template_def_id: defId, is_confirmed: confirmed ? 1 : 0, confirmed_date: confirmed ? today : null },
    ]);
    setDetail(d => ({
      ...d,
      evidenceTemplates: d.evidenceTemplates.map(et =>
        et.id === defId ? { ...et, is_confirmed: confirmed ? 1 : 0, confirmed_date: confirmed ? today : null } : et
      ),
    }));
  }

  async function handleFileUploaded() {
    load();
  }

  async function handleDeleteFile(fileId) {
    if (!confirm('このファイルを削除しますか？')) return;
    await api.deleteFile(fileId);
    load();
  }

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!detail) return <div className="loading">加算が見つかりません</div>;

  const riskColor = { red: '#dc2626', yellow: '#d97706', green: '#16a34a' }[detail.risk_level] || '#6b7280';
  const checkedReq = detail.reqItems?.filter(it => it.is_satisfied === 1).length || 0;
  const totalReq   = detail.reqItems?.length || 0;
  const checkedEv  = detail.evidenceTemplates?.filter(et => et.is_confirmed === 1).length || 0;
  const totalEv    = detail.evidenceTemplates?.length || 0;

  return (
    <div>
      <div className="no-print">
        <Link to="/subsidies" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>
          ← 加算一覧に戻る
        </Link>
      </div>

      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '12px 0 20px' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            <span style={{ color: riskColor, marginRight: 8 }}>
              {detail.risk_level === 'red' ? '🔴' : detail.risk_level === 'yellow' ? '🟡' : '🟢'}
            </span>
            {detail.name_ja}
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            {detail.service_type_name}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {detail.requires_life === 1 && (
            <span className="badge blue">LIFE対象</span>
          )}
          <span className="badge gray">
            要件 {checkedReq}/{totalReq} 確認済
          </span>
          <span className="badge gray">
            書類 {checkedEv}/{totalEv} 確認済
          </span>
        </div>
      </div>

      {/* 算定状況 */}
      <div className="card">
        <div className="card-title">算定状況</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {CLAIMING_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleStatusChange(opt.value)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '2px solid',
                borderColor: detail.claiming_status === opt.value ? riskColor : '#e5e7eb',
                fontWeight: detail.claiming_status === opt.value ? 700 : 400,
                cursor: 'pointer',
                ...opt.style,
                opacity: saving ? .6 : 1,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {detail.claiming_status === 'claiming' && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0, minWidth: 140 }}>
              <label className="form-label">算定区分</label>
              <input
                className="form-input"
                defaultValue={detail.claiming_tier || ''}
                onBlur={handleTierChange}
                placeholder="例: Ⅰ・Ⅱ"
                style={{ width: 120 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* チェックリスト */}
      <div className="card">
        <div className="card-title">確認チェックリスト</div>
        {detail.reqItems?.length === 0
          ? <div style={{ color: '#9ca3af', fontSize: 13 }}>チェック項目がありません</div>
          : detail.reqItems?.map(item => (
            <div key={item.id} className="checklist-item">
              <input
                type="checkbox"
                checked={item.is_satisfied === 1}
                onChange={e => handleReqCheck(item.id, e.target.checked)}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>
                  {item.is_satisfied === 1
                    ? <span className="check-satisfied">✓ </span>
                    : item.is_satisfied === 0
                    ? <span className="check-not-satisfied">✗ </span>
                    : null
                  }
                  {item.item_name}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{item.description}</div>
                {item.threshold_value && (
                  <div style={{ fontSize: 11, color: '#2563eb', marginTop: 2 }}>
                    基準：{item.threshold_value}
                  </div>
                )}
                {item.check_frequency && (
                  <div style={{ fontSize: 11, color: '#6b7280' }}>確認頻度：{item.check_frequency}</div>
                )}
              </div>
            </div>
          ))
        }
      </div>

      {/* 根拠書類 */}
      {detail.evidenceTemplates?.length > 0 && (
        <div className="card">
          <div className="card-title">算定根拠書類の確認</div>
          {detail.evidenceTemplates.map(et => (
            <div key={et.id} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <input
                  type="checkbox"
                  style={{ marginTop: 2, width: 16, height: 16 }}
                  checked={et.is_confirmed === 1}
                  onChange={e => handleEvidCheck(et.id, e.target.checked)}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>
                    {et.is_confirmed === 1
                      ? <span style={{ color: '#16a34a' }}>✓ </span>
                      : null
                    }
                    {et.evidence_name}
                    {et.is_confirmed === 1 && et.confirmed_date && (
                      <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>
                        確認日: {et.confirmed_date}
                      </span>
                    )}
                  </div>
                  {et.access_path && (
                    <div style={{ fontSize: 11, color: '#2563eb', marginTop: 2 }}>
                      📂 {et.access_path}
                    </div>
                  )}
                  {et.description && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{et.description}</div>
                  )}
                </div>
              </div>

              {/* 添付ファイル */}
              <div style={{ marginLeft: 26, marginTop: 8 }}>
                {detail.files?.filter(f => f.evidence_template_def_id === et.id).map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4 }}>
                    <span>📄</span>
                    <a href={`/api/files/${f.id}/download`} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
                      {f.original_name}
                    </a>
                    <span style={{ color: '#9ca3af' }}>
                      ({(f.file_size_bytes / 1024).toFixed(0)}KB)
                    </span>
                    <button
                      onClick={() => handleDeleteFile(f.id)}
                      className="btn btn-outline btn-sm"
                      style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                    >
                      削除
                    </button>
                  </div>
                ))}
                <div style={{ marginTop: 6 }}>
                  <FileDropzone
                    assessmentId={detail.assessment_id}
                    evidenceDefId={et.id}
                    onUploaded={handleFileUploaded}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 注意事項 */}
      <div className="card">
        <div className="card-title">注意事項・メモ</div>
        <div className="form-group">
          <label className="form-label">⚠️ 懸念事項・対応が必要な事項</label>
          <textarea
            className="form-textarea"
            defaultValue={detail.current_concerns || ''}
            onBlur={handleConcernsChange}
            placeholder="監査で問題になりそうな事項や、確認が必要な事項を入力..."
          />
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            入力内容はダッシュボードの「要確認」アラートに表示されます
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">担当者メモ</label>
          <textarea
            className="form-textarea"
            defaultValue={detail.notes || ''}
            onBlur={handleNotesChange}
            placeholder="担当者・管理方法等の備考..."
          />
        </div>
      </div>

      {/* 法令根拠（折りたたみ） */}
      <div className="card no-print">
        <button
          className="accordion-toggle"
          onClick={() => setShowLegal(!showLegal)}
        >
          {showLegal ? '▼' : '▶'} 法令根拠を確認する
        </button>
        {showLegal && (
          <div style={{ marginTop: 12, fontSize: 13 }}>
            <table className="table" style={{ fontSize: 12 }}>
              <tbody>
                {detail.legal_basis && (
                  <tr>
                    <th style={{ width: 140 }}>告示・通知</th>
                    <td>{detail.legal_basis}</td>
                  </tr>
                )}
                {detail.notification_no && (
                  <tr>
                    <th>通知番号</th>
                    <td>{detail.notification_no}</td>
                  </tr>
                )}
                {detail.latest_info_vol && (
                  <tr>
                    <th>介護保険最新情報</th>
                    <td>{detail.latest_info_vol}</td>
                  </tr>
                )}
                {detail.description && (
                  <tr>
                    <th>加算説明</th>
                    <td>{detail.description}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 届出履歴 */}
      <NotificationHistory subsidyId={subsidyId} serviceTypeId={serviceTypeId} />
    </div>
  );
}

function NotificationHistory({ subsidyId, serviceTypeId }) {
  const [history, setHistory] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ filed_date: '', change_content: '', effective_date: '', form_name: '' });

  useEffect(() => {
    api.getNotifications(subsidyId, serviceTypeId).then(setHistory);
  }, [subsidyId, serviceTypeId]);

  async function submit(e) {
    e.preventDefault();
    await api.addNotification({ ...form, subsidy_id: subsidyId, service_type_id: serviceTypeId });
    const updated = await api.getNotifications(subsidyId, serviceTypeId);
    setHistory(updated);
    setShowForm(false);
    setForm({ filed_date: '', change_content: '', effective_date: '', form_name: '' });
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="card-title" style={{ margin: 0 }}>届出履歴</div>
        <button className="btn btn-outline btn-sm no-print" onClick={() => setShowForm(!showForm)}>
          + 届出を追加
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group">
              <label className="form-label">提出日 *</label>
              <input type="date" className="form-input" required value={form.filed_date} onChange={e => setForm(f => ({ ...f, filed_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">有効日</label>
              <input type="date" className="form-input" value={form.effective_date} onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">変更内容 *</label>
            <input className="form-input" required value={form.change_content} onChange={e => setForm(f => ({ ...f, change_content: e.target.value }))} placeholder="例: 夜勤職員配置加算ⅡからⅠに変更" />
          </div>
          <div className="form-group">
            <label className="form-label">様式名</label>
            <input className="form-input" value={form.form_name} onChange={e => setForm(f => ({ ...f, form_name: e.target.value }))} placeholder="例: 体制届（夜勤職員配置加算）" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary btn-sm">保存</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowForm(false)}>キャンセル</button>
          </div>
        </form>
      )}

      {history.length === 0
        ? <div style={{ color: '#9ca3af', fontSize: 13 }}>届出履歴がありません</div>
        : (
          <table className="table">
            <thead>
              <tr>
                <th>提出日</th>
                <th>有効日</th>
                <th>変更内容</th>
                <th>様式名</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id}>
                  <td>{h.filed_date}</td>
                  <td>{h.effective_date || '-'}</td>
                  <td>{h.change_content}</td>
                  <td>{h.form_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </div>
  );
}
