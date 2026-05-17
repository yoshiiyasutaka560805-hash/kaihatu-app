import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function LawUpdates() {
  const [alerts, setAlerts] = useState([]);
  const [sources, setSources] = useState([]);
  const [checking, setChecking] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function load() {
    const [a, s] = await Promise.all([
      api.getLawAlerts(showAll),
      fetch('/api/law-alerts/sources').then(r => r.json()),
    ]);
    setAlerts(a);
    setSources(s);
  }

  useEffect(() => { load(); }, [showAll]);

  async function acknowledge(id) {
    await api.acknowledgeLawAlert(id);
    load();
  }

  async function checkNow() {
    setChecking(true);
    const result = await api.checkLawUpdatesNow();
    setChecking(false);
    alert(result.newAlerts > 0
      ? `${result.newAlerts}件の更新が見つかりました。`
      : '新しい更新はありませんでした。'
    );
    load();
  }

  const unacked = alerts.filter(a => !a.is_acknowledged);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">法改正情報</div>
        <div className="page-subtitle">
          厚生労働省・東京都のウェブサイトを月1回自動巡回し、介護保険関連の改定情報を検知します
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={checkNow} disabled={checking}>
          {checking ? '確認中...' : '🔍 今すぐ確認'}
        </button>
        <button
          className="btn btn-outline"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? '未確認のみ表示' : '全て表示'}
        </button>
      </div>

      {unacked.length === 0 && !showAll ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40 }}>✅</div>
          <div style={{ fontWeight: 600, marginTop: 12 }}>新しい法改正情報はありません</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            毎月1日に自動チェックを実施しています
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-title">
            {showAll ? '全アラート履歴' : `未確認のアラート（${unacked.length}件）`}
          </div>
          {alerts.map(alert => (
            <div
              key={alert.id}
              className="alert-banner blue"
              style={{ marginBottom: 10, opacity: alert.is_acknowledged ? .6 : 1 }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>
                  📰 {alert.source_name}
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{alert.alert_message}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                  検知日時: {new Date(alert.detected_at).toLocaleString('ja-JP')}
                </div>
                {alert.is_acknowledged && (
                  <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
                    ✓ 確認済み ({new Date(alert.acknowledged_at).toLocaleDateString('ja-JP')})
                  </div>
                )}
              </div>
              {!alert.is_acknowledged && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => acknowledge(alert.id)}
                >
                  確認済みにする
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">監視対象ソース</div>
        <table className="table">
          <thead>
            <tr>
              <th>サイト名</th>
              <th>確認方法</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {sources.map(s => (
              <tr key={s.id}>
                <td>
                  <a href={s.source_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
                    {s.source_name}
                  </a>
                </td>
                <td style={{ fontSize: 12, color: '#6b7280' }}>
                  {{ content_hash: 'コンテンツ変化検知', vol_number: 'Vol番号追跡', last_modified: '更新日検知' }[s.check_method]}
                </td>
                <td>
                  <span className={`badge ${s.is_active ? 'green' : 'gray'}`}>
                    {s.is_active ? '監視中' : '停止中'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
          毎月1日の深夜0時に自動チェックを実施。変化を検知した場合はダッシュボードに赤アラートを表示します。
        </div>
      </div>
    </div>
  );
}
