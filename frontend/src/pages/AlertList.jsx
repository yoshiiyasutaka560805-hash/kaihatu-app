import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function AlertList() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAlerts().then(d => { setAlerts(d); setLoading(false); });
  }, []);

  if (loading) return <div className="loading">読み込み中...</div>;

  const red    = alerts.filter(a => a.risk_level === 'red');
  const yellow = alerts.filter(a => a.risk_level === 'yellow');

  return (
    <div>
      <div className="page-header">
        <div className="page-title">アラート一覧</div>
        <div className="page-subtitle">対応が必要な加算・確認事項の一覧</div>
      </div>

      {alerts.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40 }}>🟢</div>
          <div style={{ marginTop: 12, fontWeight: 600 }}>現在、問題のある加算はありません</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>全ての加算が正常に管理されています</div>
        </div>
      )}

      {red.length > 0 && (
        <div className="card">
          <div className="card-title">🔴 対応が必要（{red.length}件）</div>
          {red.map(item => <AlertItem key={item.id} item={item} level="red" />)}
        </div>
      )}

      {yellow.length > 0 && (
        <div className="card">
          <div className="card-title">🟡 確認が必要（{yellow.length}件）</div>
          {yellow.map(item => <AlertItem key={item.id} item={item} level="yellow" />)}
        </div>
      )}
    </div>
  );
}

function AlertItem({ item, level }) {
  return (
    <Link
      to={`/subsidies/${item.subsidy_id}/${item.service_type_id}`}
      className={`alert-list-item ${level}`}
      style={{ display: 'flex', textDecoration: 'none', color: 'inherit' }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          {item.service_type_name} › {item.subsidy_name}
        </div>
        {item.failed_req_count > 0 && (
          <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>
            ✗ 未確認・不充足のチェック項目が {item.failed_req_count}件あります
          </div>
        )}
        {item.current_concerns && (
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            ⚠️ {item.current_concerns}
          </div>
        )}
        {item.claiming_status === 'unknown' && (
          <div style={{ fontSize: 12, color: '#d97706', marginTop: 2 }}>
            算定状況が入力されていません
          </div>
        )}
        {item.next_submission_deadline && item.next_submission_deadline < new Date().toISOString().slice(0, 10) && (
          <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>
            ⏰ LIFEデータ提出期限を過ぎています（{item.next_submission_deadline}）
          </div>
        )}
      </div>
      <span style={{ color: '#9ca3af', alignSelf: 'center' }}>›</span>
    </Link>
  );
}
