import React, { useState } from 'react';

const FIELD_GROUPS = [
  {
    title: '基本情報',
    fields: [
      { key: 'employee_no', label: '従業員番号' },
      { key: 'name_native', label: '氏名（現地表記）', required: true },
      { key: 'name_kana', label: '氏名（カナ）' },
      { key: 'name_romaji', label: '氏名（ローマ字）', required: true },
      { key: 'date_of_birth', label: '生年月日', type: 'date' },
      { key: 'gender', label: '性別' },
      { key: 'nationality', label: '国籍', required: true },
      { key: 'native_language', label: '母語' },
      { key: 'japanese_level', label: '日本語レベル', placeholder: '例: N3、JFT-Basic合格' },
    ],
  },
  {
    title: '在留資格・パスポート',
    fields: [
      { key: 'residence_status', label: '在留資格', placeholder: '例: 特定技能1号' },
      { key: 'specific_skill_field', label: '特定技能分野', placeholder: '例: 介護' },
      { key: 'residence_card_no', label: '在留カード番号' },
      { key: 'residence_period_from', label: '在留期間（開始）', type: 'date' },
      { key: 'residence_period_to', label: '在留期限', type: 'date' },
      { key: 'passport_no', label: 'パスポート番号' },
      { key: 'passport_expiry_date', label: 'パスポート有効期限', type: 'date' },
    ],
  },
  {
    title: '雇用情報',
    fields: [
      { key: 'employment_start_date', label: '雇用開始日', type: 'date' },
      { key: 'employment_end_date', label: '雇用終了日', type: 'date' },
      { key: 'employment_status', label: '雇用状況', type: 'select', options: [
        { value: 'active', label: '在籍中' },
        { value: 'on_leave', label: '休職中' },
        { value: 'resigned', label: '退職済' },
      ] },
      { key: 'department', label: '所属・配属先' },
    ],
  },
  {
    title: '連絡先',
    fields: [
      { key: 'address', label: '住所' },
      { key: 'phone', label: '電話番号' },
      { key: 'email', label: 'メールアドレス' },
      { key: 'emergency_contact_name', label: '緊急連絡先氏名' },
      { key: 'emergency_contact_relation', label: '緊急連絡先との関係' },
      { key: 'emergency_contact_phone', label: '緊急連絡先電話番号' },
    ],
  },
];

export default function WorkerForm({ initialValues = {}, onSubmit, submitLabel = '保存', disabled = false, readOnly = false }) {
  const [values, setValues] = useState(() => {
    const v = {};
    FIELD_GROUPS.forEach(g => g.fields.forEach(f => { v[f.key] = initialValues[f.key] ?? ''; }));
    return v;
  });

  function set(key, value) {
    setValues(v => ({ ...v, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit}>
      {FIELD_GROUPS.map(group => (
        <div key={group.title} style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#374151' }}>{group.title}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {group.fields.map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}{f.required && ' *'}</label>
                {f.type === 'select' ? (
                  <select
                    className="form-select"
                    value={values[f.key]}
                    onChange={e => set(f.key, e.target.value)}
                    disabled={readOnly}
                  >
                    {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    className="form-input"
                    type={f.type || 'text'}
                    value={values[f.key]}
                    onChange={e => set(f.key, e.target.value)}
                    required={f.required}
                    placeholder={f.placeholder}
                    disabled={readOnly}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {!readOnly && (
        <button type="submit" className="btn btn-primary" disabled={disabled}>
          {submitLabel}
        </button>
      )}
    </form>
  );
}
