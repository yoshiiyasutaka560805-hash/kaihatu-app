import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import ServiceTypeTab from '../components/ServiceTypeTab';

const CATEGORY_LABELS = {
  A: '基本体制', B: '安全・コンプライアンス', C: '人員・看護配置',
  D: '個別ケア・リハビリ', E: 'LIFE・科学的介護', F: '食事・療養',
  G: '看取り・連携', H: 'サービス提供体制・処遇改善', I: 'ショートステイ固有',
};

const STATUS_LABELS = {
  claiming: '算定中', not_claiming: '非算定', unknown: '未確認',
};

const RISK_ICONS = { red: '🔴', yellow: '🟡', green: '🟢' };

export default function SubsidyList() {
  const [serviceTypes, setServiceTypes] = useState([]);
  const [subsidies, setSubsidies] = useState([]);
  const [activeServiceType, setActiveServiceType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('claiming');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getServiceTypes(), loadSubsidies()]).then(([st]) => {
      setServiceTypes(st);
    });
  }, []);

  async function loadSubsidies() {
    setLoading(true);
    const params = {};
    if (activeServiceType !== 'all') params.service_type = activeServiceType;
    if (statusFilter !== 'all') params.status = statusFilter;
    const data = await api.getSubsidies(params);
    setSubsidies(data);
    setLoading(false);
  }

  useEffect(() => { loadSubsidies(); }, [activeServiceType, statusFilter]);

  const grouped = {};
  for (const s of subsidies) {
    const cat = s.category || 'Z';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">加算一覧</div>
        <div className="page-subtitle">各加算の現在の状況と確認ステータス</div>
      </div>

      <ServiceTypeTab
        serviceTypes={serviceTypes}
        activeCode={activeServiceType}
        onChange={code => { setActiveServiceType(code); }}
      />

      <div style={{ marginBottom: 16 }}>
        <select
          className="form-select"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="claiming">算定中のみ</option>
          <option value="all">全ての加算</option>
          <option value="not_claiming">非算定のみ</option>
        </select>
      </div>

      {loading && <div className="loading">読み込み中...</div>}

      {!loading && Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
        <div key={cat} className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">{CATEGORY_LABELS[cat] || cat}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {items.map(item => (
              <SubsidyCard key={`${item.id}-${item.service_type_id}`} item={item} />
            ))}
          </div>
        </div>
      ))}

      {!loading && subsidies.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 30, color: '#6b7280' }}>
          該当する加算がありません
        </div>
      )}
    </div>
  );
}

function SubsidyCard({ item }) {
  const riskIcon = RISK_ICONS[item.risk_level] || '';
  const statusLabel = STATUS_LABELS[item.claiming_status] || '未確認';

  return (
    <Link
      to={`/subsidies/${item.id}/${item.service_type_id}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div style={{
        border: `1px solid ${item.risk_level === 'red' ? '#fca5a5' : item.risk_level === 'yellow' ? '#fde047' : '#e5e7eb'}`,
        borderRadius: 8,
        padding: 12,
        background: item.risk_level === 'red' ? '#fef2f2' : item.risk_level === 'yellow' ? '#fefce8' : 'white',
        cursor: 'pointer',
        transition: 'opacity .15s',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {riskIcon} {item.name_ja}
          </div>
          <span className={`badge ${item.claiming_status === 'claiming' ? 'green' : 'gray'}`}>
            {statusLabel}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
          {item.service_type_name}
          {item.claiming_tier && <span style={{ marginLeft: 4 }}>({item.claiming_tier})</span>}
        </div>
        {item.current_concerns && (
          <div style={{ fontSize: 11, color: '#d97706', marginTop: 4, borderTop: '1px solid #fde68a', paddingTop: 4 }}>
            ⚠️ {item.current_concerns.slice(0, 50)}...
          </div>
        )}
        {item.failed_req_count > 0 && (
          <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
            ✗ 未確認項目 {item.failed_req_count}件
          </div>
        )}
      </div>
    </Link>
  );
}
