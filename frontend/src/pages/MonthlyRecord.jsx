import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

const ROLES = [
  { code: 'care_worker',           label: '介護職員（計）' },
  { code: 'certified_care_worker', label: '介護福祉士' },
  { code: 'nurse',                 label: '看護職員' },
  { code: 'dietitian',             label: '管理栄養士' },
  { code: 'func_trainer',          label: '機能訓練指導員' },
  { code: 'life_consultant',       label: '生活相談員' },
];

const SERVICE_TYPES = [
  { id: 1, name: 'ユニット型特養' },
  { id: 2, name: '従来型特養' },
  { id: 3, name: 'ショートステイ' },
  { id: 4, name: 'ショートステイ予防' },
];

function getYearMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function MonthlyRecord() {
  const [yearMonth, setYearMonth] = useState(getYearMonth());
  const [records, setRecords] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getMonthly(yearMonth).then(d => setRecords(d.records));
  }, [yearMonth]);

  function getValue(serviceTypeId, roleCode, field) {
    const r = records.find(r => r.service_type_id === serviceTypeId && r.role_code === roleCode);
    return r ? r[field] : '';
  }

  function setValue(serviceTypeId, roleCode, field, value) {
    setRecords(prev => {
      const existing = prev.find(r => r.service_type_id === serviceTypeId && r.role_code === roleCode);
      if (existing) {
        return prev.map(r =>
          r.service_type_id === serviceTypeId && r.role_code === roleCode
            ? { ...r, [field]: value }
            : r
        );
      }
      return [...prev, { year_month: yearMonth, service_type_id: serviceTypeId, role_code: roleCode, [field]: value }];
    });
  }

  async function save() {
    setSaving(true);
    const toSave = records
      .filter(r => r.full_time_equiv != null && r.full_time_equiv !== '')
      .map(r => ({
        year_month: yearMonth,
        service_type_id: r.service_type_id,
        role_code: r.role_code,
        full_time_equiv: parseFloat(r.full_time_equiv) || 0,
        required_fta: r.required_fta ? parseFloat(r.required_fta) : null,
        notes: r.notes || null,
      }));
    await api.saveMonthly(toSave);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    // reload to get is_deficient flags
    const d = await api.getMonthly(yearMonth);
    setRecords(d.records);
  }

  const deficientCount = records.filter(r => r.is_deficient === 1).length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">月次人員配置記録</div>
        <div className="page-subtitle">常勤換算数の月次記録。基準値を下回ると赤アラートが表示されます。</div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <input
          type="month"
          className="form-input"
          style={{ width: 160 }}
          value={yearMonth}
          onChange={e => setYearMonth(e.target.value)}
        />
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? '保存中...' : saved ? '✓ 保存済み' : '保存'}
        </button>
      </div>

      {deficientCount > 0 && (
        <div className="alert-banner red" style={{ marginBottom: 16 }}>
          🔴 <strong>人員基準欠如の恐れがある項目が {deficientCount}件あります。</strong>
          翌々月から減算が発生する可能性があります。至急確認してください。
        </div>
      )}

      {SERVICE_TYPES.map(st => (
        <div key={st.id} className="card">
          <div className="card-title">{st.name}</div>
          <table className="table">
            <thead>
              <tr>
                <th>職種</th>
                <th>常勤換算数</th>
                <th>基準上必要な人数</th>
                <th>状態</th>
                <th>備考</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map(role => {
                const rec = records.find(r => r.service_type_id === st.id && r.role_code === role.code);
                const isDeficient = rec?.is_deficient === 1;
                const fta = getValue(st.id, role.code, 'full_time_equiv');
                const req = getValue(st.id, role.code, 'required_fta');
                return (
                  <tr key={role.code} style={{ background: isDeficient ? '#fef2f2' : undefined }}>
                    <td style={{ fontWeight: 500 }}>{role.label}</td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        style={{ width: 80 }}
                        value={fta}
                        onChange={e => setValue(st.id, role.code, 'full_time_equiv', e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        style={{ width: 80 }}
                        value={req}
                        onChange={e => setValue(st.id, role.code, 'required_fta', e.target.value)}
                        placeholder="-"
                      />
                    </td>
                    <td>
                      {fta === '' ? (
                        <span className="badge gray">未入力</span>
                      ) : isDeficient ? (
                        <span className="badge red">🔴 基準割れ</span>
                      ) : (
                        <span className="badge green">🟢 OK</span>
                      )}
                    </td>
                    <td>
                      <input
                        className="form-input"
                        style={{ fontSize: 12 }}
                        value={getValue(st.id, role.code, 'notes')}
                        onChange={e => setValue(st.id, role.code, 'notes', e.target.value)}
                        placeholder="備考..."
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
