import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ExpiryBadge from '../components/ExpiryBadge';

const EMPLOYMENT_STATUS_LABEL = { active: '在籍中', on_leave: '休職中', resigned: '退職済' };

export default function WorkerList() {
  const { user } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [expiringOnly, setExpiringOnly] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (expiringOnly) params.expiring_within = 90;
    api.getWorkers(params).then(rows => { setWorkers(rows); setLoading(false); });
  }, [q, expiringOnly]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">特定技能外国人 従業員一覧</div>
        <div className="page-subtitle">在留資格・在留期限を一元管理</div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            className="form-input"
            style={{ maxWidth: 240 }}
            placeholder="氏名・従業員番号で検索"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={expiringOnly} onChange={e => setExpiringOnly(e.target.checked)} />
            在留期限が90日以内のみ表示
          </label>
          {(user?.role === 'admin' || user?.role === 'staff') && (
            <Link to="/workers/new" className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>
              ＋ 新規登録
            </Link>
          )}
        </div>

        {loading ? (
          <div className="loading">読み込み中...</div>
        ) : workers.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 13, padding: 20, textAlign: 'center' }}>
            該当する従業員がいません
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>氏名</th>
                <th>国籍</th>
                <th>在留資格</th>
                <th>在留期限</th>
                <th>雇用状況</th>
                <th>所属</th>
              </tr>
            </thead>
            <tbody>
              {workers.map(w => (
                <tr key={w.id}>
                  <td>
                    <Link to={`/workers/${w.id}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
                      {w.name_native}
                    </Link>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{w.name_kana || w.name_romaji}</div>
                  </td>
                  <td>{w.nationality}</td>
                  <td>{w.residence_status || '-'}</td>
                  <td><ExpiryBadge date={w.residence_period_to} level={w.residence_risk_level} /></td>
                  <td>{EMPLOYMENT_STATUS_LABEL[w.employment_status] || w.employment_status}</td>
                  <td>{w.department || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
