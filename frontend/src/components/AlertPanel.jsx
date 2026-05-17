import React from 'react';
import { Link } from 'react-router-dom';

export default function AlertPanel({ redItems = [], yellowItems = [], lawAlerts = [], activeDeductions = [] }) {
  const hasRed    = redItems.length > 0 || lawAlerts.length > 0 || activeDeductions.length > 0;
  const hasYellow = yellowItems.length > 0;

  if (!hasRed && !hasYellow) return null;

  return (
    <div className="no-print">
      {lawAlerts.map(a => (
        <div key={`law-${a.id}`} className="alert-banner red">
          <span>🔴</span>
          <div style={{ flex: 1 }}>
            <strong>法令改定情報が更新されています</strong>
            <div style={{ fontSize: 12, marginTop: 2 }}>{a.alert_message}</div>
            <div style={{ fontSize: 11, marginTop: 2, color: '#666' }}>
              {new Date(a.detected_at).toLocaleDateString('ja-JP')}
            </div>
          </div>
          <Link to="/law-updates" className="btn btn-outline btn-sm">確認する</Link>
        </div>
      ))}

      {activeDeductions.map(d => (
        <div key={`ded-${d.id}`} className="alert-banner red">
          <span>🔴</span>
          <div style={{ flex: 1 }}>
            <strong>減算中：{d.service_type_name}</strong>
            <div style={{ fontSize: 12, marginTop: 2 }}>
              {DEDUCTION_LABELS[d.deduction_type] || d.deduction_type} — {d.reason}
            </div>
            <div style={{ fontSize: 11, marginTop: 2, color: '#666' }}>
              開始：{d.start_date}
            </div>
          </div>
          <Link to="/monthly" className="btn btn-outline btn-sm">対応する</Link>
        </div>
      ))}

      {redItems.length > 0 && (
        <div className="alert-banner red">
          <span>🔴</span>
          <div style={{ flex: 1 }}>
            <strong>要件を満たしていない可能性のある加算（{redItems.length}件）</strong>
            <ul style={{ fontSize: 12, marginTop: 4, paddingLeft: 16 }}>
              {redItems.slice(0, 3).map(item => (
                <li key={item.id}>
                  {item.service_type_name} › {item.subsidy_name}
                  {item.failed_req_count > 0 && ` — 未確認チェック項目 ${item.failed_req_count}件`}
                  {item.current_concerns && ` — ${item.current_concerns.slice(0, 30)}...`}
                </li>
              ))}
              {redItems.length > 3 && <li>他 {redItems.length - 3}件</li>}
            </ul>
          </div>
          <Link to="/alerts" className="btn btn-danger btn-sm">全て確認</Link>
        </div>
      )}

      {yellowItems.length > 0 && (
        <div className="alert-banner yellow">
          <span>🟡</span>
          <div style={{ flex: 1 }}>
            <strong>確認が必要な事項（{yellowItems.length}件）</strong>
            <ul style={{ fontSize: 12, marginTop: 4, paddingLeft: 16 }}>
              {yellowItems.slice(0, 2).map(item => (
                <li key={item.id}>
                  {item.service_type_name} › {item.subsidy_name}
                  {item.current_concerns && ` — ${item.current_concerns.slice(0, 40)}...`}
                </li>
              ))}
              {yellowItems.length > 2 && <li>他 {yellowItems.length - 2}件</li>}
            </ul>
          </div>
          <Link to="/alerts" className="btn btn-outline btn-sm">一覧を見る</Link>
        </div>
      )}
    </div>
  );
}

const DEDUCTION_LABELS = {
  restraint_no_filing: '身体拘束廃止届出未提出（-10%）',
  abuse_prevention:    '虐待防止未実施（-1%）',
  bcp_not_filed:       'BCP未策定（-1%）',
  over_capacity:       '定員超過（-70%）',
  staff_shortage:      '人員基準欠如（-30%または-70%）',
};
