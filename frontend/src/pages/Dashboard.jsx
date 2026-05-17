import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import AlertPanel from '../components/AlertPanel';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard().then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="loading">読み込み中...</div>;

  const { summary, redItems, yellowItems, lawAlerts, activeDeductions } = data;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">ダッシュボード</div>
        <div className="page-subtitle">
          {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })} 時点の状況
        </div>
      </div>

      <AlertPanel
        redItems={redItems}
        yellowItems={yellowItems}
        lawAlerts={lawAlerts}
        activeDeductions={activeDeductions}
      />

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card stat-red">
          <div className="stat-number">{summary.red_count}</div>
          <div className="stat-label">🔴 対応必要</div>
        </div>
        <div className="stat-card stat-orange">
          <div className="stat-number">{summary.yellow_count}</div>
          <div className="stat-label">🟡 要確認</div>
        </div>
        <div className="stat-card stat-green">
          <div className="stat-number">{summary.green_count}</div>
          <div className="stat-label">🟢 問題なし</div>
        </div>
        <div className="stat-card stat-blue">
          <div className="stat-number">{summary.claiming_count}</div>
          <div className="stat-label">算定中の加算数</div>
        </div>
      </div>

      {redItems.length > 0 && (
        <div className="card">
          <div className="card-title">🔴 対応が必要な加算</div>
          {redItems.map(item => (
            <Link
              key={item.id}
              to={`/subsidies/${item.subsidy_id}/${item.service_type_id}`}
              className="alert-list-item red"
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>
                  {item.service_type_name} › {item.subsidy_name}
                  {item.claiming_tier && <span className="badge blue" style={{ marginLeft: 6 }}>{item.claiming_tier}</span>}
                </div>
                {item.failed_req_count > 0 && (
                  <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>
                    ✗ 未確認チェック項目 {item.failed_req_count}件
                  </div>
                )}
                {item.current_concerns && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    ⚠️ {item.current_concerns}
                  </div>
                )}
              </div>
              <span style={{ color: '#9ca3af' }}>›</span>
            </Link>
          ))}
        </div>
      )}

      {yellowItems.length > 0 && (
        <div className="card">
          <div className="card-title">🟡 確認が必要な事項</div>
          {yellowItems.map(item => (
            <Link
              key={item.id}
              to={`/subsidies/${item.subsidy_id}/${item.service_type_id}`}
              className="alert-list-item yellow"
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>
                  {item.service_type_name} › {item.subsidy_name}
                </div>
                {item.current_concerns && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {item.current_concerns}
                  </div>
                )}
                {item.claiming_status === 'unknown' && (
                  <div style={{ fontSize: 12, color: '#d97706', marginTop: 2 }}>
                    算定状況が未入力です
                  </div>
                )}
              </div>
              <span style={{ color: '#9ca3af' }}>›</span>
            </Link>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">クイックリンク</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/subsidies" className="btn btn-outline">📋 加算一覧を確認</Link>
          <Link to="/monthly" className="btn btn-outline">📅 月次記録を入力</Link>
          <Link to="/export" className="btn btn-outline">🖨️ 監査提出資料を作成</Link>
        </div>
      </div>
    </div>
  );
}
