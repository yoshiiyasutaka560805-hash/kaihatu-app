import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const ALERT_TYPE_LABEL = { residence_expiry: '在留期限', passport_expiry: 'パスポート有効期限' };

export default function ResidenceAlertList() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showAll, setShowAll] = useState(false);

  function load() {
    setLoading(true);
    api.getResidenceAlerts(showAll).then(a => { setAlerts(a); setLoading(false); });
  }

  useEffect(() => { load(); }, [showAll]);

  async function acknowledge(id) {
    await api.acknowledgeResidenceAlert(id);
    load();
  }

  async function checkNow() {
    setChecking(true);
    const result = await api.checkResidenceAlertsNow();
    setChecking(false);
    alert(result.newAlerts > 0
      ? `${result.newAlerts}件の新しいアラートが作成されました。`
      : '新しいアラートはありませんでした。'
    );
    load();
  }

  const unacked = alerts.filter(a => !a.is_acknowledged);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">在留期限アラート</div>
        <div className="page-subtitle">
          在留期限・パスポート有効期限を毎日午前6時に自動チェックし、90/60/30/14/0日前にアラートを作成します
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={checkNow} disabled={checking}>
          {checking ? '確認中...' : '🔍 今すぐ確認'}
        </button>
        <button className="btn btn-outline" onClick={() => setShowAll(!showAll)}>
          {showAll ? '未確認のみ表示' : '全て表示'}
        </button>
      </div>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : unacked.length === 0 && !showAll ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40 }}>✅</div>
          <div style={{ fontWeight: 600, marginTop: 12 }}>対応が必要なアラートはありません</div>
        </div>
      ) : (
        <div className="card">
          <div className="card-title">
            {showAll ? '全アラート履歴' : `未確認のアラート（${unacked.length}件）`}
          </div>
          {alerts.map(a => (
            <div
              key={a.id}
              className={`alert-banner ${a.threshold_days === 0 ? 'red' : a.threshold_days <= 30 ? 'orange' : 'blue'}`}
              style={{ marginBottom: 10, opacity: a.is_acknowledged ? .6 : 1 }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>
                  <Link to={`/workers/${a.foreign_worker_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {a.name_native}
                  </Link>
                  <span className="badge gray" style={{ marginLeft: 8 }}>{ALERT_TYPE_LABEL[a.alert_type] || a.alert_type}</span>
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{a.message}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                  作成日時: {new Date(a.created_at).toLocaleString('ja-JP')}
                </div>
                {a.is_acknowledged === 1 && (
                  <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
                    ✓ 確認済み（{a.acknowledged_at ? new Date(a.acknowledged_at).toLocaleDateString('ja-JP') : ''}）
                  </div>
                )}
              </div>
              {!a.is_acknowledged && (
                <button className="btn btn-outline btn-sm" onClick={() => acknowledge(a.id)}>
                  確認済みにする
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
