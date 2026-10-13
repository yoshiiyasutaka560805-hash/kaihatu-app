import React, { useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, post } from '../api/client';
import { useAction, useApi, useMeta } from '../hooks/useApi';
import { Badge, Card, Check, ErrorText, LANG_LABEL, Loading, PageHeader, toForm, WAGE_LABEL, Warnings } from '../components/ui';
import { Area, In, isEmpty, POSTING_LABELS, Sel } from './PostingDetail';

const KIND_LABEL = { seeker_intake: '受付フォーム（本人入力）', seeker_memo: '面談メモAI抽出', posting_ocr: '求人票AI読取' };
const STATUS_TABS = [['pending', '承認待ち'], ['approved', '承認済'], ['rejected', '却下']];
const STATUS_LABEL = { pending: '承認待ち', approved: '承認済', rejected: '却下' };

// 求職者項目（backend specs.seeker）の日本語ラベルと入力種別
const SEEKER_FIELDS = {
  name: ['氏名'], name_kana: ['氏名（カナ）'], phone: ['電話番号', 'tel'], email: ['メールアドレス', 'email'], address: ['住所'],
  birth_date: ['生年月日', 'date'], accepted_date: ['受付日', 'date'], validity_end: ['求職の有効期限', 'date'],
  consent_date: ['個人情報取扱いの同意日', 'date'], ai_consent: ['AI利用に同意', 'bool'], preferred_language: ['希望言語', 'lang'],
  prefecture: ['都道府県'], city: ['市区町村'], nearest_station: ['最寄り駅'], acceptable_cities: ['通勤可能な市区町村'],
  transport: ['通勤手段'], max_commute_minutes: ['通勤時間の上限（分）', 'number'], desired_categories: ['希望職種分類'],
  desired_facility_types: ['希望施設種別'], excluded_facility_types: ['除外する施設種別'], desired_job_kinds: ['希望職務'],
  desired_employment: ['希望雇用形態'], desired_wage_type: ['希望賃金形態', 'wage'], desired_wage_min: ['希望賃金の下限（円）', 'number'],
  available_start: ['勤務可能な開始時刻', 'time'], available_end: ['勤務可能な終了時刻', 'time'], shift_ok: ['交替制（シフト）可', 'bool'],
  night_max_per_month: ['夜勤上限（回/月）', 'number'], night_only: ['夜勤専従希望', 'bool'], max_days_per_week: ['週の勤務日数上限', 'number'],
  min_annual_holidays: ['年間休日の下限', 'number'], available_from: ['就業可能日', 'date'], licenses: ['保有資格'],
  experience_years: ['経験年数', 'number'], experience_note: ['職歴・経験', 'area'], priorities: ['重視する条件', 'area'],
  is_foreign_national: ['外国籍', 'bool'], visa_status: ['在留資格', 'visa'], residence_expiry: ['在留期限', 'date'],
  work_restriction: ['就労制限の有無'], extra_activity_permit: ['資格外活動許可', 'bool'], residence_checked_date: ['在留カード確認日', 'date'],
  residence_checked_by: ['在留カード確認者'], jlpt_level: ['日本語能力（JLPT）', 'jlpt'], care_japanese_test: ['介護日本語評価試験 合格', 'bool'],
  skill_test: ['技能試験'], notes: ['備考', 'area'], weight_profile: ['重視プロファイル'], status: ['状況'],
};
const SEEKER_GROUPS = [
  ['本人・連絡先', ['name', 'name_kana', 'birth_date', 'phone', 'email', 'address', 'preferred_language', 'consent_date', 'ai_consent', 'accepted_date', 'validity_end']],
  ['希望条件', ['prefecture', 'city', 'nearest_station', 'acceptable_cities', 'transport', 'max_commute_minutes', 'desired_categories',
    'desired_job_kinds', 'desired_facility_types', 'excluded_facility_types', 'desired_employment', 'desired_wage_type', 'desired_wage_min',
    'available_start', 'available_end', 'shift_ok', 'night_max_per_month', 'night_only', 'max_days_per_week', 'min_annual_holidays',
    'available_from', 'priorities']],
  ['資格・経験', ['licenses', 'experience_years', 'experience_note', 'skill_test']],
  ['在留情報・日本語', ['is_foreign_national', 'visa_status', 'residence_expiry', 'work_restriction', 'extra_activity_permit',
    'residence_checked_date', 'residence_checked_by', 'jlpt_level', 'care_japanese_test']],
];
const KNOWN_SEEKER_KEYS = new Set(SEEKER_GROUPS.flatMap(([, ks]) => ks));

function SeekerInput({ k, form, set, meta, required }) {
  const [label, type = 'text'] = SEEKER_FIELDS[k] || [k];
  const p = { label, name: k, form, set, required };
  switch (type) {
    case 'bool': return <div className="form-group"><Check label={label} name={k} form={form} set={set} /></div>;
    case 'area': return <Area {...p} rows={2} />;
    case 'number': return <In {...p} type="number" min="0" />;
    case 'lang': return <Sel {...p} options={Object.entries(LANG_LABEL).map(([value, l]) => ({ value, label: l }))} />;
    case 'wage': return <Sel {...p} options={Object.entries(WAGE_LABEL).map(([value, l]) => ({ value, label: l }))} />;
    case 'jlpt': return <Sel {...p} options={['N1', 'N2', 'N3', 'N4', 'N5', 'なし']} />;
    case 'visa': return <Sel {...p} options={meta?.visaTypes || []} />;
    default: return <In {...p} type={type} />;
  }
}

// 受付フォーム・面談メモ：求職者項目の編集フォーム（data に含まれる項目のみ。受付は主要項目を常に表示）
function SeekerForm({ form, set, meta, intake }) {
  const keys = Object.keys(form);
  const extra = keys.filter(k => !KNOWN_SEEKER_KEYS.has(k));
  return (
    <>
      {SEEKER_GROUPS.map(([title, ks]) => {
        const shown = ks.filter(k => keys.includes(k) || (intake && ['name', 'consent_date'].includes(k)));
        if (!shown.length) return null;
        return (
          <div key={title}>
            <div className="card-title" style={{ marginTop: 8 }}>{title}</div>
            <div className="grid2">
              {shown.map(k => <SeekerInput key={k} k={k} form={form} set={set} meta={meta} required={intake && (k === 'name' || k === 'consent_date')} />)}
            </div>
          </div>
        );
      })}
      {extra.length > 0 && (
        <div>
          <div className="card-title" style={{ marginTop: 8 }}>その他</div>
          <div className="grid2">{extra.map(k => <SeekerInput key={k} k={k} form={form} set={set} meta={meta} />)}</div>
        </div>
      )}
    </>
  );
}

// 求人票AI読取：項目の編集表
function OcrFields({ fields, setField }) {
  const idBase = useId();
  return (
    <table className="table">
      <thead><tr><th style={{ width: 200 }}>項目</th><th>読取値（修正可）</th></tr></thead>
      <tbody>
        {Object.keys(POSTING_LABELS).map(k => {
          const id = `${idBase}-${k}`;
          const v = fields[k] ?? '';
          return (
            <tr key={k}>
              <td><label htmlFor={id}>{POSTING_LABELS[k]}</label></td>
              <td>
                {k === 'description' || k === 'job_change_scope' || k === 'place_change_scope'
                  ? <textarea id={id} className="form-textarea" rows={k === 'description' ? 4 : 2} value={v} onChange={e => setField(k, e.target.value)} />
                  : <input id={id} className="form-input" value={v} onChange={e => setField(k, e.target.value)}
                      style={isEmpty(v) ? { background: 'var(--gray50)' } : undefined} />}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Uncertain({ items }) {
  if (!items?.length) return null;
  return (
    <div className="warn-box">
      <strong>要確認（AIが読み取りに自信のない点）</strong>
      <ul style={{ marginLeft: 18 }}>{items.map((u, i) => <li key={i}>{u}</li>)}</ul>
    </div>
  );
}

function PendingDraft({ d, meta, employers, onDone }) {
  const [open, setOpen] = useState(true);
  const initial = useMemo(() => {
    if (d.kind === 'posting_ocr') return toForm(d.data?.fields || {});
    const { uncertain_points, ...rest } = d.data || {}; // eslint-disable-line no-unused-vars
    return toForm(rest);
  }, [d]);
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const guessEmployer = useMemo(() => {
    const name = String(d.data?.fields?.company_name || '').replace(/\s/g, '');
    const hit = name && (employers || []).find(e => String(e.name).replace(/\s/g, '') === name);
    return hit ? String(hit.id) : '';
  }, [d, employers]);
  const [emp, setEmp] = useState({ employer_id: '' });
  const employerId = emp.employer_id || guessEmployer;
  const [run, busy, err, setErr] = useAction();
  const [rejRun, rejBusy, rejErr] = useAction();

  const approve = async () => {
    let body;
    if (d.kind === 'posting_ocr') {
      if (!employerId) { setErr('事業所を選択してください（自社受理求人として登録します）'); return; }
      body = { data: { fields: form }, employer_id: Number(employerId) };
    } else if (d.kind === 'seeker_intake') {
      if (isEmpty(form.name)) { setErr('氏名を入力してください'); return; }
      if (isEmpty(form.consent_date)) { setErr('個人情報取扱いの同意日を入力してください'); return; }
      body = { data: form };
    } else {
      // 面談メモ：空欄の項目は反映しない（既存の登録値を消さない）
      body = { data: Object.fromEntries(Object.entries(form).filter(([, v]) => !isEmpty(v))) };
    }
    const msg = d.kind === 'posting_ocr' ? 'この内容で自社受理求人として登録しますか？'
      : d.kind === 'seeker_intake' ? 'この内容で求職者を登録しますか？' : `この内容を${d.seeker_name || '求職者'}さんの登録情報に反映しますか？`;
    if (!window.confirm(msg)) return;
    await run(() => post(`/drafts/${d.id}/approve`, body)).then(r => onDone({ kind: d.kind, ...r })).catch(() => {});
  };
  const reject = async () => {
    if (!window.confirm('この下書きを却下しますか？（登録・反映はされません）')) return;
    await rejRun(() => post(`/drafts/${d.id}/reject`)).then(() => onDone(null)).catch(() => {});
  };

  const title = (
    <span>
      <Badge color="orange">{KIND_LABEL[d.kind] || d.kind}</Badge>{' '}
      {d.kind === 'posting_ocr' ? (d.data?.fields?.company_name || '（事業所名なし）') + ' ' + (d.data?.fields?.job_title || '')
        : d.kind === 'seeker_memo' ? `対象：${d.seeker_name || '（求職者不明）'}` : (d.data?.name || '（氏名なし）')}
    </span>
  );

  return (
    <Card title={title} actions={<>
      <span className="muted">#{d.id}　{d.created_at}{d.source_name ? `　${d.source_name}` : ''}</span>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(o => !o)}>{open ? '閉じる' : '開く'}</button>
    </>}>
      {open && (
        <>
          {d.kind === 'seeker_memo' && (
            <>
              <p className="muted">面談メモからAIが抽出した希望条件です。内容を確認・修正し、承認すると
                {d.seeker_id ? <Link to={`/seekers/${d.seeker_id}`}>{d.seeker_name}</Link> : '求職者'}さんの登録情報に反映します。空欄の項目は反映しません。</p>
              <Uncertain items={d.data?.uncertain_points} />
              {!Object.keys(form).length ? <div className="muted">抽出された項目はありません。</div> : <SeekerForm form={form} set={set} meta={meta} />}
            </>
          )}
          {d.kind === 'seeker_intake' && (
            <>
              <p className="muted">求職者本人が受付フォームで入力した内容です。本人確認・在留カード確認のうえ、必要に応じて修正して承認してください。</p>
              <SeekerForm form={form} set={set} meta={meta} intake />
            </>
          )}
          {d.kind === 'posting_ocr' && (
            <>
              <p className="muted">事業所から受け取った求人票をAIで読み取った結果です。承認すると、選択した事業所の<strong>自社受理求人</strong>として登録されます（日付・金額は登録時に正規化）。原本と照合してください。</p>
              <Uncertain items={d.data?.uncertain_points} />
              <div className="grid2">
                <Sel label="事業所" name="employer_id" form={{ employer_id: employerId }} set={(_, v) => setEmp({ employer_id: v })} required
                  empty="（選択してください）" options={(employers || []).map(e => ({ value: String(e.id), label: e.name }))}
                  hint={guessEmployer && !emp.employer_id ? '事業所名が一致する事業所を仮選択しています' : '一覧にない場合は先に事業所を登録してください'} />
              </div>
              <OcrFields fields={form} setField={set} />
            </>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-primary" disabled={busy || rejBusy} onClick={approve}>
              {busy ? '承認中…' : d.kind === 'seeker_intake' ? '承認して求職者登録' : d.kind === 'posting_ocr' ? '承認して求人登録' : '承認して反映'}
            </button>
            <button type="button" className="btn btn-outline" disabled={busy || rejBusy} onClick={reject}>{rejBusy ? '処理中…' : '却下'}</button>
            <ErrorText error={err || rejErr} />
          </div>
        </>
      )}
    </Card>
  );
}

function resultLink(kind, id) {
  if (!id) return null;
  return kind === 'posting_ocr' ? `/postings/${id}` : `/seekers/${id}`;
}

function ReviewedDraft({ d }) {
  const [open, setOpen] = useState(false);
  const to = d.status === 'approved' ? resultLink(d.kind, d.result_id) : null;
  const name = d.kind === 'posting_ocr' ? `${d.data?.fields?.company_name || ''} ${d.data?.fields?.job_title || ''}`
    : d.kind === 'seeker_memo' ? `対象：${d.seeker_name || '—'}` : (d.data?.name || '—');
  const entries = d.kind === 'posting_ocr'
    ? Object.entries(d.data?.fields || {}).filter(([, v]) => !isEmpty(v)).map(([k, v]) => [POSTING_LABELS[k] || k, v])
    : Object.entries(d.data || {}).filter(([k, v]) => k !== 'uncertain_points' && !isEmpty(v)).map(([k, v]) => [SEEKER_FIELDS[k]?.[0] || k, v]);
  return (
    <>
      <tr>
        <td>#{d.id}</td>
        <td>{KIND_LABEL[d.kind] || d.kind}</td>
        <td>{name}</td>
        <td>{d.created_at}</td>
        <td><Badge color={d.status === 'approved' ? 'green' : 'gray'}>{STATUS_LABEL[d.status]}</Badge></td>
        <td>{d.reviewed_at || '—'}{d.reviewed_by && <div className="muted">{d.reviewed_by}</div>}</td>
        <td>{to ? <Link to={to}>{d.kind === 'posting_ocr' ? '求人を開く' : '求職者を開く'}</Link> : '—'}</td>
        <td><button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(o => !o)}>{open ? '閉じる' : '内容'}</button></td>
      </tr>
      {open && (
        <tr><td colSpan={8}>
          <dl className="kv">{entries.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{String(v)}</dd></React.Fragment>)}</dl>
        </td></tr>
      )}
    </>
  );
}

export default function Drafts() {
  const nav = useNavigate();
  const meta = useMeta();
  const [status, setStatus] = useState('pending');
  const list = useApi(() => get('/drafts', { status }), [status]);
  const employers = useApi(() => get('/employers'), []);
  const [result, setResult] = useState(null);

  const done = r => { setResult(r); list.reload(); };
  const to = result ? resultLink(result.kind, result.resultId) : null;

  return (
    <>
      <PageHeader title="承認待ち" subtitle="受付フォーム（本人入力）・面談メモのAI抽出・求人票のAI読取は、担当者が確認して承認するまで登録されません" />

      {result && (
        <div className="ok-box row">
          <span>
            {result.kind === 'seeker_intake' ? '求職者を登録しました。' : result.kind === 'posting_ocr' ? '自社受理求人として登録しました。労働条件明示の未入力項目を確認してください。' : '求職者の登録情報に反映しました。'}
          </span>
          {to && <button type="button" className="btn btn-primary btn-sm" onClick={() => nav(to)}>{result.kind === 'posting_ocr' ? '登録した求人を開く' : '求職者を開く'}</button>}
          <span className="spacer" />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setResult(null)}>閉じる</button>
        </div>
      )}
      {result && <Warnings items={result.prohibited} />}

      <div className="tabs" role="tablist">
        {STATUS_TABS.map(([v, l]) => (
          <button type="button" role="tab" aria-selected={status === v} key={v} className={status === v ? 'active' : ''} onClick={() => setStatus(v)}>{l}</button>
        ))}
      </div>
      <ErrorText error={list.error || employers.error} />
      {list.loading && !list.data ? <Loading /> : list.data && !list.data.length ? (
        <Card><div className="muted">{STATUS_LABEL[status]}の下書きはありません。</div></Card>
      ) : list.data && (status === 'pending' ? (
        list.data.map(d => <PendingDraft key={d.id} d={d} meta={meta} employers={employers.data} onDone={done} />)
      ) : (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>No.</th><th>種類</th><th>内容</th><th>作成</th><th>状態</th><th>確認日時・確認者</th><th>登録先</th><th /></tr></thead>
              <tbody>{list.data.map(d => <ReviewedDraft key={d.id} d={d} />)}</tbody>
            </table>
          </div>
        </Card>
      ))}
    </>
  );
}
