import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import ServiceTypeTab from '../components/ServiceTypeTab';

const CATEGORY_LABELS = {
  A: '基本体制', B: '安全・コンプライアンス', C: '人員・看護配置',
  D: '個別ケア・リハビリ', E: 'LIFE・科学的介護', F: '食事・療養',
  G: '看取り・連携', H: 'サービス提供体制・処遇改善', I: 'ショートステイ固有',
};

export default function ExportPage() {
  const [serviceTypes, setServiceTypes] = useState([]);
  const [subsidies, setSubsidies] = useState([]);
  const [activeServiceType, setActiveServiceType] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [facilityName, setFacilityName] = useState('');
  const [printAuthor, setPrintAuthor] = useState('');
  const [printDate, setPrintDate] = useState(new Date().toISOString().slice(0, 10));
  const [details, setDetails] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    Promise.all([api.getServiceTypes(), api.getSettings()]).then(([st, settings]) => {
      setServiceTypes(st);
      if (settings.facility_name) setFacilityName(settings.facility_name);
      if (settings.print_author) setPrintAuthor(settings.print_author);
    });
  }, []);

  useEffect(() => {
    const params = { status: 'claiming' };
    if (activeServiceType !== 'all') params.service_type = activeServiceType;
    api.getSubsidies(params).then(setSubsidies);
  }, [activeServiceType]);

  function toggleSelect(key) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(subsidies.map(s => `${s.id}-${s.service_type_id}`)));
  }

  function clearAll() { setSelected(new Set()); }

  async function startPreview() {
    setLoadingDetail(true);
    const loaded = [];
    for (const key of selected) {
      const [subsidyId, serviceTypeId] = key.split('-');
      try {
        const d = await api.getSubsidyDetail(subsidyId, serviceTypeId);
        loaded.push({ key, ...d });
      } catch {
        // skip on error
      }
    }
    setDetails(loaded);
    setLoadingDetail(false);
    setPreviewing(true);
  }

  const printDateJa = (() => {
    const [y, m, d] = printDate.split('-');
    return `${y}年${parseInt(m, 10)}月${parseInt(d, 10)}日`;
  })();

  if (previewing) {
    return (
      <div>
        <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => window.print()}>🖨️ 印刷する</button>
          <button className="btn btn-outline" onClick={() => setPreviewing(false)}>← 戻る</button>
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            Ctrl+P または上の「印刷する」ボタンでPDF保存・紙印刷ができます
          </span>
        </div>

        {details.map((detail, idx) => {
          const reqItems = detail.reqItems || [];
          const evidTemplates = detail.evidenceTemplates || [];

          return (
            <div key={detail.key} className="print-report-item">
              <div style={{ textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>介護保険加算 要件充足確認表</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{facilityName}</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                  作成日：{printDateJa}　作成者：{printAuthor}
                </div>
              </div>

              <table className="print-table" style={{ marginBottom: 12 }}>
                <tbody>
                  <tr>
                    <th style={{ width: 130 }}>サービス種別</th>
                    <td>{detail.service_type_name}</td>
                    <th style={{ width: 130 }}>算定区分</th>
                    <td>{detail.claiming_tier || (detail.claiming_status === 'claiming' ? '算定中' : '非算定')}</td>
                  </tr>
                  <tr>
                    <th>加算名</th>
                    <td colSpan={3} style={{ fontWeight: 600 }}>{detail.name_ja}</td>
                  </tr>
                  <tr>
                    <th>担当者</th>
                    <td>{detail.responsible_name || '—'}</td>
                    <th>法令根拠</th>
                    <td style={{ fontSize: 11 }}>{detail.legal_basis || '—'}</td>
                  </tr>
                </tbody>
              </table>

              {reqItems.length > 0 && (
                <>
                  <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>■ 要件充足確認</div>
                  <table className="print-table" style={{ marginBottom: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 30 }}>No</th>
                        <th>要件内容</th>
                        <th style={{ width: 60 }}>充足</th>
                        <th style={{ width: 200 }}>備考</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reqItems.map((item, i) => {
                        const sat = item.is_satisfied;
                        return (
                          <tr key={item.id}>
                            <td style={{ textAlign: 'center' }}>{i + 1}</td>
                            <td>{item.item_name}</td>
                            <td style={{
                              textAlign: 'center',
                              color: sat === 1 ? '#16a34a' : sat === 0 ? '#dc2626' : '#9ca3af',
                            }}>
                              {sat === 1 ? '✓' : sat === 0 ? '✗★' : '—'}
                            </td>
                            <td style={{ fontSize: 10 }}>{item.check_notes || ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}

              {evidTemplates.length > 0 && (
                <>
                  <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>■ 算定根拠書類確認</div>
                  <table className="print-table" style={{ marginBottom: 12 }}>
                    <thead>
                      <tr>
                        <th>書類名</th>
                        <th style={{ width: 60 }}>確認</th>
                        <th style={{ width: 100 }}>確認日</th>
                        <th>アクセス方法</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidTemplates.map(tmpl => (
                        <tr key={tmpl.id}>
                          <td>{tmpl.evidence_name}</td>
                          <td style={{
                            textAlign: 'center',
                            color: tmpl.is_confirmed === 1 ? '#16a34a' : '#9ca3af',
                          }}>
                            {tmpl.is_confirmed === 1 ? '✓' : '—'}
                          </td>
                          <td style={{ fontSize: 10 }}>{tmpl.confirmed_date || ''}</td>
                          <td style={{ fontSize: 10, color: '#555' }}>{tmpl.access_path || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>■ 特記事項</div>
              <div style={{
                border: '1px solid #ccc', minHeight: 50, padding: '6px 8px',
                fontSize: 12, marginBottom: 8,
              }}>
                {detail.current_concerns || 'なし'}
              </div>

              {detail.legal_basis && (
                <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>
                  法令根拠：{detail.legal_basis}
                  {detail.notification_no && `　通知番号：${detail.notification_no}`}
                  {detail.latest_info_vol && `　最新情報：${detail.latest_info_vol}`}
                </div>
              )}

              <div style={{ textAlign: 'right', fontSize: 10, color: '#9ca3af', marginTop: 16 }}>
                {idx + 1} / {details.length}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const grouped = {};
  for (const s of subsidies) {
    const cat = s.category || 'Z';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">監査提出用 印刷資料</div>
        <div className="page-subtitle">加算を選択して要件充足確認表を印刷・提出します</div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">印刷設定</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>施設名</label>
            <input
              className="form-input"
              value={facilityName}
              onChange={e => setFacilityName(e.target.value)}
              placeholder="施設名を入力"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>作成者</label>
            <input
              className="form-input"
              value={printAuthor}
              onChange={e => setPrintAuthor(e.target.value)}
              placeholder="作成者名を入力"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>作成日</label>
            <input
              type="date"
              className="form-input"
              value={printDate}
              onChange={e => setPrintDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            出力する加算を選択（{selected.size}件選択中）
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={selectAll}>全選択</button>
            <button className="btn btn-outline btn-sm" onClick={clearAll}>クリア</button>
          </div>
        </div>

        <ServiceTypeTab
          serviceTypes={serviceTypes}
          activeCode={activeServiceType}
          onChange={setActiveServiceType}
        />

        {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
              {CATEGORY_LABELS[cat] || cat}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6 }}>
              {items.map(item => {
                const key = `${item.id}-${item.service_type_id}`;
                const checked = selected.has(key);
                return (
                  <label
                    key={key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px',
                      border: `1px solid ${checked ? '#2563eb' : '#e5e7eb'}`,
                      borderRadius: 6,
                      background: checked ? '#eff6ff' : 'white',
                      cursor: 'pointer', fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(key)}
                      style={{ flexShrink: 0 }}
                    />
                    <span>
                      {item.name_ja}
                      <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 4 }}>
                        {item.service_type_name}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        {subsidies.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: '#6b7280', fontSize: 13 }}>
            算定中の加算がありません
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          className="btn btn-primary"
          onClick={startPreview}
          disabled={selected.size === 0 || loadingDetail}
        >
          {loadingDetail ? '読み込み中...' : `🖨️ 印刷プレビュー（${selected.size}件）`}
        </button>
        {selected.size === 0 && (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>加算を選択してください</span>
        )}
      </div>
    </div>
  );
}
