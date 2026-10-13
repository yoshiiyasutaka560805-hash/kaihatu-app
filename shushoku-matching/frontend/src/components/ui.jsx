import React from 'react';

// 共通UI部品。各ページはこれらを使い、見た目と入力の扱いを統一する

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header row">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      <span className="spacer" />
      {children}
    </div>
  );
}

export function Card({ title, children, actions }) {
  return (
    <div className="card">
      {(title || actions) && <div className="row card-head">{title && <div className="card-title">{title}</div>}<span className="spacer" />{actions}</div>}
      {children}
    </div>
  );
}

export function ErrorText({ error }) {
  return error ? <div className="error" role="alert">{error}</div> : null;
}

export function Loading({ text = '読み込み中…' }) {
  return <div className="loading">{text}</div>;
}

// form: 値オブジェクト、set(name, value)
export function Field({ label, name, form, set, type = 'text', placeholder, hint, required, children, wide }) {
  return (
    <div className={`form-group${wide ? ' wide' : ''}`}>
      <label className="form-label">{label}{required && <span className="req"> *</span>}</label>
      {children || (
        <input className="form-input" type={type} value={form[name] ?? ''} placeholder={placeholder}
          onChange={e => set(name, e.target.value)} />
      )}
      {hint && <div className="muted">{hint}</div>}
    </div>
  );
}

export function Select({ label, name, form, set, options, empty = '（未選択）', hint, required }) {
  const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <Field label={label} hint={hint} required={required}>
      <select className="form-select" value={form[name] ?? ''} onChange={e => set(name, e.target.value)}>
        {empty !== null && <option value="">{empty}</option>}
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function TextArea({ label, name, form, set, rows = 3, hint }) {
  return (
    <Field label={label} hint={hint} wide>
      <textarea className="form-textarea" rows={rows} value={form[name] ?? ''} onChange={e => set(name, e.target.value)} />
    </Field>
  );
}

export function Check({ label, name, form, set }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={!!Number(form[name]) || form[name] === true} onChange={e => set(name, e.target.checked ? 1 : 0)} />{label}
    </label>
  );
}

// カンマ区切り値の複数選択（チップ）
export function MultiChips({ label, name, form, set, options, hint }) {
  const values = String(form[name] || '').split(',').map(s => s.trim()).filter(Boolean);
  const toggle = v => {
    const next = values.includes(v) ? values.filter(x => x !== v) : [...values, v];
    set(name, next.join(','));
  };
  return (
    <Field label={label} hint={hint} wide>
      <div className="chips">
        {options.map(o => (
          <button type="button" key={o} className={`chip${values.includes(o) ? ' on' : ''}`} onClick={() => toggle(o)}>{o}</button>
        ))}
      </div>
    </Field>
  );
}

const STATUS_COLOR = {
  受付: 'blue', 紹介中: 'orange', 面接: 'yellow', 内定: 'green', 就職: 'green', 終了: 'gray',
  未提案: 'gray', 提案済: 'blue', 応募: 'orange', 入職: 'green', 不採用: 'red', 辞退: 'gray',
  pending: 'orange', approved: 'green', rejected: 'gray', success: 'green', error: 'red', skipped: 'gray', running: 'blue',
};
export function Badge({ children, color }) {
  return <span className={`badge ${color || STATUS_COLOR[children] || 'gray'}`}>{children}</span>;
}

export const yen = v => (v == null || v === '' ? '—' : `${Number(v).toLocaleString()}円`);
export const WAGE_LABEL = { monthly: '月給', hourly: '時給', daily: '日給', annual: '年俸' };
export const LANG_LABEL = { ja: '日本語', easy_ja: 'やさしい日本語', en: 'English', vi: 'Tiếng Việt', id: 'Bahasa Indonesia', my: 'မြန်မာ', ne: 'नेपाली', zh: '中文', tl: 'Tagalog' };

// フォーム用：APIの null を '' に変換
export function toForm(obj) {
  return Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, v ?? '']));
}

// 警告一覧（収集禁止情報の検知・取込警告等）
export function Warnings({ items }) {
  if (!items?.length) return null;
  return <div className="warn-box">{items.map((w, i) => <div key={i}>⚠ {typeof w === 'string' ? w : `${w.term}（${w.category}）：職業紹介で原則収集してはならない情報の可能性があります`}</div>)}</div>;
}
