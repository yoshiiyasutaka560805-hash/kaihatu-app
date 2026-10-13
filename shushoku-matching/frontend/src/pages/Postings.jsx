import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

const SOURCE = { manual: '手動', hw_provision: '提供サービス', hw_crawler: '自動巡回' };
const STATUS_COLOR = { success: 'green', error: 'red', skipped: 'gray', running: 'blue' };

export default function Postings() {
  const [rows, setRows] = useState([]);
  const [runs, setRuns] = useState([]);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.getPostings({ q, city, ...(showInactive ? { active: 'all' } : {}) }).then(setRows).catch(e => setError(e.message));
    api.getFetchRuns().then(setRuns);
  };
  useEffect(load, [showInactive]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onCsv(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true); setError(''); setMsg('');
    try {
      const r = await api.importCsv(file);
      setMsg(`取込完了：新規 ${r.inserted}件／更新 ${r.updated}件／期限切れ無効化 ${r.deactivated}件`
        + (r.errors.length ? `\nエラー ${r.errors.length}件：\n${r.errors.slice(0, 10).join('\n')}` : ''));
      load();
    } catch (err) { setError(err.message); } finally { setBusy(false); e.target.value = ''; }
  }

  async function fetchNow() {
    setBusy(true); setError(''); setMsg('');
    try { const r = await api.fetchNow(); setMsg(`定期取込を実行しました：${JSON.stringify(r)}`); load(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function toggle(p) {
    await api.setPostingActive(p.id, !p.is_active);
    load();
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">求人データベース</h1>
        <p className="page-subtitle">ハローワーク求人の取込・検索。紹介期限切れの求人は自動で無効化されます</p>
      </div>

      <div className="card">
        <div className="card-title">求人の取込</div>
        <div className="row">
          <label className="btn btn-primary">
            CSVを取込<input type="file" accept=".csv" hidden onChange={onCsv} disabled={busy} />
          </label>
          <a className="btn btn-outline" href="/postings-template.csv" download>CSVテンプレート</a>
          <button className="btn btn-outline" disabled={busy} onClick={fetchNow}>定期取込を今すぐ実行</button>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          CSVは1行目に項目名（求人番号・事業所名・職種 は必須）。UTF-8／Shift_JIS 両対応。同じ求人番号は上書き更新されます。
        </p>
        {msg && <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>{msg}</pre>}
        {error && <div className="error">{error}</div>}
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <input className="form-input" style={{ width: 240 }} placeholder="事業所名・職種・求人番号" value={q} onChange={e => setQ(e.target.value)} />
          <input className="form-input" style={{ width: 140 }} placeholder="市区町村" value={city} onChange={e => setCity(e.target.value)} />
          <button className="btn btn-outline" onClick={load}>検索</button>
          <label className="checkbox" style={{ margin: 0 }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />無効も表示
          </label>
          <span className="spacer" /><span className="muted">{rows.length}件</span>
        </div>
        <table className="table">
          <thead><tr><th>求人番号</th><th>事業所</th><th>職種</th><th>勤務地</th><th>雇用形態</th><th>賃金</th><th>紹介期限</th><th>取得元</th><th></th></tr></thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.id} style={p.is_active ? {} : { opacity: 0.5 }}>
                <td>{p.source_url ? <a href={p.source_url} target="_blank" rel="noreferrer">{p.posting_no}</a> : p.posting_no}</td>
                <td>{p.company_name}</td><td>{p.job_title}</td><td>{p.prefecture}{p.city}</td>
                <td>{p.employment_type}</td>
                <td>{p.wage_min?.toLocaleString()}〜{p.wage_max?.toLocaleString()}</td>
                <td>{p.expiry_date}</td><td>{SOURCE[p.source] || p.source}</td>
                <td><button className="btn btn-sm btn-outline" onClick={() => toggle(p)}>{p.is_active ? '無効化' : '有効化'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">取込ログ（直近50件）</div>
        <table className="table">
          <thead><tr><th>開始</th><th>取得元</th><th>状態</th><th>新規</th><th>更新</th><th>無効化</th><th>メッセージ</th></tr></thead>
          <tbody>
            {runs.map(r => (
              <tr key={r.id}>
                <td>{r.started_at}</td><td>{SOURCE[r.source] || r.source}</td>
                <td><span className={`badge ${STATUS_COLOR[r.status]}`}>{r.status}</span></td>
                <td>{r.inserted}</td><td>{r.updated}</td><td>{r.deactivated}</td>
                <td className="muted" style={{ whiteSpace: 'pre-wrap' }}>{r.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
