import React, { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, post, upload } from '../api/client';
import { useApi, useAction } from '../hooks/useApi';
import { PageHeader, Card, ErrorText, Badge, WAGE_LABEL } from '../components/ui';

// 条件表から判定：求職者の条件表（Excel・Word・PDF）を取り込み → 内容を確認・修正 → 保存して全求人と照合
// 判定は「案内可（マッチ度高）／案内可／要確認／案内不可」の4段階（マッチング結果画面で表示）

const FIELDS = [
  ['基本情報', [['name', '氏名', true], ['name_kana', 'フリガナ'], ['birth_date', '生年月日', false, 'date'], ['phone', '電話番号'], ['email', 'メール'], ['address', '住所']]],
  ['勤務地・通勤', [['prefecture', '都道府県'], ['city', '居住市区町村'], ['nearest_station', '最寄り駅'], ['acceptable_cities', '通勤可能な市区町村（カンマ区切り）'],
    ['transport', '通勤手段'], ['max_commute_minutes', '通勤時間の上限（分）', false, 'number']]],
  ['希望の仕事', [['desired_categories', '希望職種'], ['desired_job_kinds', '希望職務'], ['desired_facility_types', '希望施設種別'], ['excluded_facility_types', '希望しない施設種別'],
    ['desired_employment', '希望雇用形態'], ['desired_wage_type', '賃金形態', false, 'wage'], ['desired_wage_min', '最低希望ライン（下限）']]],
  ['働き方', [['available_start', '勤務可能（開始）', false, 'time'], ['available_end', '勤務可能（終了）', false, 'time'], ['shift_ok', '夜勤・交替制', false, 'yn'],
    ['night_max_per_month', '夜勤上限（回/月、0=不可）', false, 'number'], ['night_only', '夜勤専従希望', false, 'yn'], ['max_days_per_week', '週の勤務日数上限', false, 'number'],
    ['min_annual_holidays', '希望年間休日', false, 'number'], ['available_from', '就業可能日', false, 'date']]],
  ['資格・経験', [['licenses', '保有資格'], ['experience_years', '経験年数', false, 'number'], ['experience_note', '職務経歴', false, 'textarea'], ['priorities', '優先順位', false, 'textarea']]],
  ['ヒアリング', [['shift_pattern', '希望勤務時間帯（日勤のみ/早番・遅番可/夜勤可/オンコール可）'], ['desired_wage_target', '希望給与'],
    ['required_benefits', '必須の手当・待遇'], ['holiday_pref', '休日・休暇の希望'], ['fixed_day_off', '固定休日希望（曜日）'],
    ['driver_license', '運転免許'], ['experience_settings', '経験した現場'], ['night_experience', '夜勤経験'], ['nurse_specialty', '看護師の診療科・病棟経験'],
    ['employment_status', '現職の状況（在職中/離職中）'], ['resignation_date', '退職予定日', false, 'date'], ['job_search_status', '転職活動の状況'],
    ['offer_deadline', '他社内定の回答期限', false, 'date'], ['interview_availability', '面接・見学が可能な曜日・時間帯'],
    ['disclosure_scope', '紹介先へ提供してよい情報の範囲'], ['contact_method', '連絡方法'], ['contact_time', '連絡のとりやすい時間帯'],
    ['referral_source', '紹介元・担当者'], ['unavailable_times', '勤務に制約のある曜日・時間帯', false, 'textarea'],
    ['must_conditions', '避けたい条件・譲れない条件', false, 'textarea'], ['motivation', '志望動機・転職理由', false, 'textarea']]],
  ['外国籍の方', [['is_foreign_national', '外国籍', false, 'yn'], ['visa_status', '在留資格'], ['residence_expiry', '在留期限', false, 'date'], ['jlpt_level', '日本語能力（N1〜N5/なし）'],
    ['care_japanese_test', '介護日本語評価試験 合格', false, 'yn'], ['skill_test', '技能試験']]],
  ['その他', [['notes', '備考（AIへは送信しません）', false, 'textarea']]],
];

const METHOD_LABEL = { template: '自社テンプレートとして読み取り（AI不使用）', ai: 'AIで抽出（氏名・連絡先等は伏せて送信）', manual: '自動読み取りできない様式のため手入力' };
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

function Input({ f, label, required, type, form, set }) {
  const id = useId();
  const v = form[f] ?? '';
  let control;
  if (type === 'textarea') control = <textarea id={id} className="form-textarea" rows={3} value={v} onChange={e => set(f, e.target.value)} />;
  else if (type === 'yn') control = (
    <select id={id} className="form-select" value={v === '' ? '' : String(Number(v))} onChange={e => set(f, e.target.value)}>
      <option value="">（未記入）</option><option value="1">はい・可</option><option value="0">いいえ・不可</option>
    </select>);
  else if (type === 'wage') control = (
    <select id={id} className="form-select" value={v} onChange={e => set(f, e.target.value)}>
      <option value="">（未記入）</option>{Object.entries(WAGE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>);
  else control = <input id={id} className="form-input" type={type || 'text'} value={v} onChange={e => set(f, e.target.value)} />;
  return (
    <div className={`form-group${type === 'textarea' ? ' wide' : ''}`}>
      <label className="form-label" htmlFor={id}>{label}{required && <span className="req"> *</span>}</label>
      {control}
    </div>
  );
}

export default function Screening() {
  const nav = useNavigate();
  const seekers = useApi(() => get('/seekers'), []);
  const [seekerId, setSeekerId] = useState('');
  const [aiOk, setAiOk] = useState(false);
  const [file, setFile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [form, setForm] = useState({});
  const [consentDate, setConsentDate] = useState(today());
  const [searchWeb, setSearchWeb] = useState(true);
  const [readRun, reading, readErr] = useAction();
  const [saveRun, saving, saveErr, setSaveErr] = useAction();
  const fileId = useId();
  const set = (k, v) => setForm(x => ({ ...x, [k]: v }));
  const existing = seekers.data?.find(s => String(s.id) === String(seekerId));

  async function read() {
    if (!file) return;
    const fields = { ...(seekerId ? { seeker_id: seekerId } : {}), ai_ok: aiOk ? '1' : '0' };
    const r = await readRun(() => upload('/drafts/sheet', file, fields)).catch(() => null);
    if (!r) return;
    setDraft(r);
    setForm(Object.fromEntries(Object.entries(r.data || {}).map(([k, v]) => [k, v ?? ''])));
  }

  async function saveAndJudge() {
    const fields = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '' && v != null));
    if (!draft.seeker_id) {
      if (!fields.name) { setSaveErr('氏名を入力してください'); return; }
      if (!consentDate) { setSaveErr('個人情報取扱いの同意日を入力してください'); return; }
      fields.consent_date = consentDate;
      fields.ai_consent = aiOk ? 1 : 0;
    }
    const r = await saveRun(() => post(`/drafts/${draft.draftId}/approve`, { data: { fields } })).catch(() => null);
    if (r?.resultId) nav(`/seekers/${r.resultId}/matches?run=1${searchWeb ? '&web=1' : ''}`);
  }

  return (
    <>
      <PageHeader title="条件表から判定" subtitle="求職者の条件表を取り込み、登録済みの求人すべてについて案内できるか・マッチ度を判定します">
        <a className="btn btn-outline" href="/joken-template.xlsx" download="条件表テンプレート.xlsx">条件表テンプレート（Excel）</a>
      </PageHeader>

      <Card title="① 条件表を選ぶ">
        <div className="grid2">
          <div className="form-group">
            <label className="form-label" htmlFor={fileId}>条件表ファイル（Excel .xlsx／Word .docx／PDF）</label>
            <input id={fileId} className="form-input" type="file" accept=".xlsx,.docx,.pdf" onChange={e => { setFile(e.target.files[0] || null); setDraft(null); }} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sc-seeker">求職者</label>
            <select id="sc-seeker" className="form-select" value={seekerId} onChange={e => { setSeekerId(e.target.value); setDraft(null); }}>
              <option value="">新しい求職者として登録</option>
              {(seekers.data || []).map(s => <option key={s.id} value={s.id}>{s.name}（{s.status}）</option>)}
            </select>
          </div>
        </div>
        {!seekerId ? (
          <label className="checkbox">
            <input type="checkbox" checked={aiOk} onChange={e => setAiOk(e.target.checked)} />
            本人から外部AI（Claude）の利用に同意を得ている（自社テンプレート以外の様式をAIで読み取る場合に必要。氏名・連絡先等は伏せて送信）
          </label>
        ) : (
          <div className="muted">AIの利用は、この求職者の登録情報の同意（{existing ? 'AI同意の有無は求職者画面で確認' : ''}）に従います。</div>
        )}
        <div className="muted">自社の条件表テンプレート（Excel）で受け取ると、AIを使わずに正確に読み取れます。</div>
        <ErrorText error={readErr} />
        <button type="button" className="btn btn-primary" disabled={!file || reading} onClick={read}>{reading ? '読み取り中…' : '読み取る'}</button>
      </Card>

      {draft && (
        <Card title="② 内容を確認・修正">
          <div className="row" style={{ marginBottom: 8 }}>
            <Badge color={draft.method === 'template' ? 'green' : draft.method === 'ai' ? 'blue' : 'orange'}>{METHOD_LABEL[draft.method]}</Badge>
            {draft.seeker_id && <span>更新対象：<Link to={`/seekers/${draft.seeker_id}`}>{existing?.name}</Link>（空欄の項目は今の登録内容を残します）</span>}
          </div>
          {draft.uncertain?.length > 0 && <div className="warn-box"><strong>要確認：</strong>{draft.uncertain.map((u, i) => <div key={i}>・{u}</div>)}</div>}
          {draft.preview && (
            <details style={{ margin: '8px 0' }}><summary>読み取った文字を表示（手入力の参考）</summary><pre className="muted" style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>{draft.preview}</pre></details>
          )}
          {FIELDS.map(([section, fields]) => (
            <div key={section} style={{ marginTop: 12 }}>
              <div className="card-title" style={{ fontSize: 14 }}>{section}</div>
              <div className="grid2">
                {fields.filter(([f]) => !(draft.seeker_id && ['name'].includes(f))).map(([f, label, req, type]) =>
                  <Input key={f} f={f} label={label} required={req && !draft.seeker_id} type={type} form={form} set={set} />)}
                {section === '基本情報' && !draft.seeker_id && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="sc-consent">個人情報取扱いの同意日<span className="req"> *</span></label>
                    <input id="sc-consent" className="form-input" type="date" value={consentDate} onChange={e => setConsentDate(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          ))}
          <label className="checkbox" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={searchWeb} onChange={e => setSearchWeb(e.target.checked)} />
            保存後、ネット（ハローワークインターネットサービス・求人サイト等）でこの条件の求人を探してから判定する（1〜3分。検索には氏名・連絡先は使いません）
          </label>
          <ErrorText error={saveErr} />
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={saveAndJudge}>{saving ? '保存中…' : '③ 保存して判定する'}</button>
            <button type="button" className="btn btn-outline" onClick={() => setDraft(null)}>やり直す</button>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>判定結果は「案内可（マッチ度高）／案内可／要確認／案内不可」で表示します。判定は補助情報です。案内・紹介の可否は担当者が最終確認してください。</div>
        </Card>
      )}
    </>
  );
}
