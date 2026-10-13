import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

const STATUSES = ['受付', '紹介中', '面接', '内定', '就職', '終了'];
const EMPTY = {
  name: '', name_kana: '', phone: '', email: '', address: '', birth_date: '',
  prefecture: '', city: '', acceptable_cities: '', desired_categories: '', desired_employment: '',
  desired_wage_type: 'monthly', desired_wage_min: '', available_start: '', available_end: '',
  shift_ok: false, max_days_per_week: '', min_annual_holidays: '', licenses: '', experience_years: '',
  experience_note: '', is_foreign_national: false, visa_status: '', notes: '', status: '受付',
  consent_date: '', ai_consent: false,
};

function Field({ label, name, form, set, type = 'text', placeholder, children }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children || (
        <input className="form-input" type={type} value={form[name] ?? ''} placeholder={placeholder}
          onChange={e => set(name, e.target.value)} />
      )}
    </div>
  );
}

function Check({ label, name, form, set }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={!!form[name]} onChange={e => set(name, e.target.checked)} />{label}
    </label>
  );
}

export default function SeekerEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) api.getSeeker(id).then(r => setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ''])) }))
      .catch(e => setError(e.message));
  }, [id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const p = { form, set };

  async function save(andMatch) {
    setSaving(true); setError('');
    try {
      const data = { ...form };
      for (const k of ['desired_wage_min', 'max_days_per_week', 'min_annual_holidays', 'experience_years']) {
        data[k] = data[k] === '' ? '' : Number(data[k]);
      }
      delete data.id; delete data.created_at; delete data.updated_at;
      let sid = id;
      if (id) await api.updateSeeker(id, data);
      else sid = (await api.createSeeker(data)).id;
      nav(andMatch ? `/seekers/${sid}/matches?run=1` : '/');
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function remove() {
    if (!window.confirm('この求職者の情報とマッチング履歴を削除します。よろしいですか？')) return;
    await api.deleteSeeker(id);
    nav('/');
  }

  return (
    <>
      <div className="page-header row">
        <h1 className="page-title">{id ? '求職者情報の編集' : '求職者の登録'}</h1>
        <span className="spacer" />
        {id && <Link className="btn btn-outline" to={`/seekers/${id}/matches`}>マッチング結果へ</Link>}
      </div>

      <div className="card">
        <div className="card-title">基本情報・同意（※この欄はAIへ送信しません）</div>
        <div className="grid2">
          <Field label="氏名 *" name="name" {...p} />
          <Field label="フリガナ" name="name_kana" {...p} />
          <Field label="生年月日" name="birth_date" type="date" {...p} />
          <Field label="電話" name="phone" {...p} />
          <Field label="メール" name="email" {...p} />
          <Field label="住所" name="address" {...p} />
          <Field label="個人情報取扱い同意日 *" name="consent_date" type="date" {...p} />
          <Field label="ステータス" name="status" {...p}>
            <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Check label="外部AI（Claude）による適合理由の補足に同意（氏名・連絡先等を除いた仮名化データのみ送信）" name="ai_consent" {...p} />
      </div>

      <div className="card">
        <div className="card-title">希望条件（マッチング判定に使用）</div>
        <div className="grid2">
          <Field label="都道府県" name="prefecture" placeholder="大阪府" {...p} />
          <Field label="居住市区町村" name="city" placeholder="堺市" {...p} />
          <Field label="通勤可能な市区町村（カンマ区切り）" name="acceptable_cities" placeholder="和泉市,高石市" {...p} />
          <Field label="希望職種（カンマ区切り）" name="desired_categories" placeholder="介護,事務" {...p} />
          <Field label="希望雇用形態（カンマ区切り）" name="desired_employment" placeholder="正社員,パート" {...p} />
          <Field label="希望賃金の形態" name="desired_wage_type" {...p}>
            <select className="form-select" value={form.desired_wage_type} onChange={e => set('desired_wage_type', e.target.value)}>
              <option value="monthly">月給</option><option value="hourly">時給</option><option value="daily">日給</option>
            </select>
          </Field>
          <Field label="希望賃金（下限・円）" name="desired_wage_min" type="number" {...p} />
          <Field label="勤務可能 開始" name="available_start" type="time" {...p} />
          <Field label="勤務可能 終了" name="available_end" type="time" {...p} />
          <Field label="週の勤務日数 上限" name="max_days_per_week" type="number" {...p} />
          <Field label="希望年間休日（以上）" name="min_annual_holidays" type="number" {...p} />
          <Field label="保有資格（カンマ区切り）" name="licenses" placeholder="介護福祉士,普通自動車免許" {...p} />
          <Field label="関連経験年数" name="experience_years" type="number" {...p} />
          <Field label="在留資格（外国籍の場合）" name="visa_status" placeholder="特定技能1号（介護）" {...p} />
        </div>
        <div className="row">
          <Check label="夜勤・交替制 可" name="shift_ok" {...p} />
          <Check label="外国籍" name="is_foreign_national" {...p} />
        </div>
        <Field label="経験概要" name="experience_note" {...p}>
          <textarea className="form-textarea" value={form.experience_note} onChange={e => set('experience_note', e.target.value)} />
        </Field>
        <Field label="メモ（AIへ送信しません）" name="notes" {...p}>
          <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
      </div>

      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="btn btn-primary" disabled={saving} onClick={() => save(true)}>保存してマッチング判定</button>
        <button className="btn btn-outline" disabled={saving} onClick={() => save(false)}>保存のみ</button>
        <span className="spacer" />
        {id && <button className="btn btn-danger" onClick={remove}>削除</button>}
      </div>
    </>
  );
}
