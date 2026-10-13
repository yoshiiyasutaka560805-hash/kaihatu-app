import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const STATUS_COLOR = { 受付: 'blue', 紹介中: 'orange', 面接: 'yellow', 内定: 'green', 就職: 'green', 終了: 'gray' };

export default function SeekerList() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.getSeekers().then(setRows).catch(e => setError(e.message)); }, []);

  return (
    <>
      <div className="page-header row">
        <div>
          <h1 className="page-title">求職者一覧</h1>
          <p className="page-subtitle">求職者を登録し、ハローワーク求人とのマッチング判定を行います</p>
        </div>
        <span className="spacer" />
        <Link className="btn btn-primary" to="/seekers/new">＋ 求職者を登録</Link>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="card">
        {!rows ? <div className="loading">読み込み中…</div> : rows.length === 0 ? <p className="muted">登録された求職者はいません</p> : (
          <table className="table">
            <thead><tr><th>氏名</th><th>ステータス</th><th>居住</th><th>希望職種</th><th>候補数</th><th>最高点</th><th>更新</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td><Link to={`/seekers/${r.id}`}>{r.name}</Link></td>
                  <td><span className={`badge ${STATUS_COLOR[r.status] || 'gray'}`}>{r.status}</span></td>
                  <td>{r.city}</td>
                  <td>{r.desired_categories}</td>
                  <td>{r.match_count}</td>
                  <td>{r.top_score ?? '-'}</td>
                  <td className="muted">{r.updated_at}</td>
                  <td><Link className="btn btn-sm btn-outline" to={`/seekers/${r.id}/matches`}>マッチング</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
