import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const REPORT_TYPE_LABEL = {
  acceptance_status: '受入れ状況に係る届出',
  support_status: '支援実施状況に係る届出',
  residence_activity: '活動状況に係る届出',
  other: 'その他',
};

const SUPPORT_STATUS_LABEL = { planned: '未実施', in_progress: '実施中', completed: '実施済', not_applicable: '対象外' };

export default function PeriodicReportList() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'staff';
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [preview, setPreview] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.getPeriodicReports().then(rows => { setReports(rows); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (canEdit) api.getWorkers().then(setWorkers); }, [canEdit]);

  async function handleCreate(form) {
    await api.createPeriodicReport(form);
    setShowForm(false);
    load();
  }

  async function handleMarkSubmitted(id) {
    const today = new Date().toISOString().slice(0, 10);
    await api.updatePeriodicReport(id, { status: 'submitted', submitted_date: today });
    load();
  }

  async function handlePreview(id) {
    const data = await api.exportPeriodicReport(id);
    setPreview(data);
  }

  if (preview) {
    return <ReportPreview data={preview} onBack={() => setPreview(null)} />;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">定期報告</div>
        <div className="page-subtitle">受入れ状況・支援実施状況等の定期報告を管理</div>
      </div>

      <div className="card">
        {canEdit && (
          <div style={{ marginBottom: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
              {showForm ? '閉じる' : '＋ 新規報告を作成'}
            </button>
          </div>
        )}

        {showForm && <NewReportForm workers={workers} onSubmit={handleCreate} />}

        {loading ? (
          <div className="loading">読み込み中...</div>
        ) : reports.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 13, padding: 20, textAlign: 'center' }}>報告はまだありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>種別</th>
                <th>対象従業員</th>
                <th>対象期間</th>
                <th>提出期限</th>
                <th>状態</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id}>
                  <td>{REPORT_TYPE_LABEL[r.report_type] || r.report_type}</td>
                  <td>{r.worker_name || '（全体）'}</td>
                  <td>{r.period_from} 〜 {r.period_to}</td>
                  <td>{r.due_date}</td>
                  <td>
                    <span className={`badge ${r.status === 'submitted' ? 'green' : 'gray'}`}>
                      {r.status === 'submitted' ? '提出済み' : '未提出'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => handlePreview(r.id)}>印刷プレビュー</button>
                    {canEdit && r.status !== 'submitted' && (
                      <button className="btn btn-outline btn-sm" onClick={() => handleMarkSubmitted(r.id)}>提出済みにする</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function NewReportForm({ workers, onSubmit }) {
  const [reportType, setReportType] = useState('support_status');
  const [foreignWorkerId, setForeignWorkerId] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [dueDate, setDueDate] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      report_type: reportType,
      foreign_worker_id: foreignWorkerId || null,
      period_from: periodFrom,
      period_to: periodTo,
      due_date: dueDate,
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '16px 0', marginBottom: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">報告種別</label>
          <select className="form-select" value={reportType} onChange={e => setReportType(e.target.value)}>
            {Object.entries(REPORT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">対象従業員（任意）</label>
          <select className="form-select" value={foreignWorkerId} onChange={e => setForeignWorkerId(e.target.value)}>
            <option value="">全体</option>
            {workers.map(w => <option key={w.id} value={w.id}>{w.name_native}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">対象期間（開始）</label>
          <input type="date" className="form-input" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">対象期間（終了）</label>
          <input type="date" className="form-input" value={periodTo} onChange={e => setPeriodTo(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">提出期限</label>
          <input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
        </div>
      </div>
      <button type="submit" className="btn btn-primary btn-sm">作成</button>
    </form>
  );
}

function ReportPreview({ data, onBack }) {
  const { report, supportPlan } = data;
  return (
    <div>
      <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨️ 印刷する</button>
        <button className="btn btn-outline" onClick={onBack}>← 戻る</button>
      </div>

      <div className="print-report-item">
        <div style={{ textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{REPORT_TYPE_LABEL[report.report_type] || report.report_type}</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
            対象期間：{report.period_from} 〜 {report.period_to}　提出期限：{report.due_date}
          </div>
        </div>

        <table className="print-table" style={{ marginBottom: 12 }}>
          <tbody>
            <tr>
              <th style={{ width: 130 }}>対象従業員</th>
              <td>{report.name_native || '（全体）'}</td>
              <th style={{ width: 130 }}>状態</th>
              <td>{report.status === 'submitted' ? `提出済み（${report.submitted_date}）` : '未提出'}</td>
            </tr>
          </tbody>
        </table>

        {supportPlan.length > 0 && (
          <>
            <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>■ 支援実施状況（法定10項目）</div>
            <table className="print-table" style={{ marginBottom: 12 }}>
              <thead>
                <tr>
                  <th>支援項目</th>
                  <th style={{ width: 80 }}>状況</th>
                  <th style={{ width: 100 }}>実施日</th>
                  <th style={{ width: 100 }}>実施者</th>
                </tr>
              </thead>
              <tbody>
                {supportPlan.map((s, i) => (
                  <tr key={i}>
                    <td>{s.item_name}</td>
                    <td>{SUPPORT_STATUS_LABEL[s.status] || '未実施'}</td>
                    <td style={{ fontSize: 10 }}>{s.implementation_date || ''}</td>
                    <td style={{ fontSize: 10 }}>{s.implementer_name || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {report.notes && (
          <>
            <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>■ 特記事項</div>
            <div style={{ border: '1px solid #ccc', minHeight: 40, padding: '6px 8px', fontSize: 12 }}>{report.notes}</div>
          </>
        )}
      </div>
    </div>
  );
}
