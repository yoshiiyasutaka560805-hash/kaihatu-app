import React, { useEffect, useId, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { get, post, put } from '../api/client';
import { useAction, useApi, useMeta } from '../hooks/useApi';
import { Badge, Card, Check, ErrorText, Loading, PageHeader, toForm, yen, WAGE_LABEL } from '../components/ui';

// ── 求人ページ群（求人・事業所・成約・承認待ち）で共有するローカル部品 ──
// ※ui.jsx の Field はラベルと入力が htmlFor で関連付いていないため、ここでは useId で関連付けた版を使う

export const todayJst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

export function In({ label, name, form, set, type = 'text', hint, required, wide, ...rest }) {
  const id = useId();
  return (
    <div className={`form-group${wide ? ' wide' : ''}`}>
      <label className="form-label" htmlFor={id}>{label}{required && <span className="req"> *</span>}</label>
      <input id={id} className="form-input" type={type} value={form[name] ?? ''} required={required}
        onChange={e => set(name, e.target.value)} {...rest} />
      {hint && <div className="muted">{hint}</div>}
    </div>
  );
}

export function Sel({ label, name, form, set, options, empty = '（未選択）', hint, required, wide }) {
  const id = useId();
  const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <div className={`form-group${wide ? ' wide' : ''}`}>
      <label className="form-label" htmlFor={id}>{label}{required && <span className="req"> *</span>}</label>
      <select id={id} className="form-select" value={form[name] ?? ''} onChange={e => set(name, e.target.value)}>
        {empty !== null && <option value="">{empty}</option>}
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <div className="muted">{hint}</div>}
    </div>
  );
}

export function Area({ label, name, form, set, rows = 3, hint }) {
  const id = useId();
  return (
    <div className="form-group wide">
      <label className="form-label" htmlFor={id}>{label}</label>
      <textarea id={id} className="form-textarea" rows={rows} value={form[name] ?? ''} onChange={e => set(name, e.target.value)} />
      {hint && <div className="muted">{hint}</div>}
    </div>
  );
}

export const isEmpty = v => v == null || v === '';

export const POSTING_LABELS = {
  posting_no: '求人番号', company_name: '事業所名', prefecture: '都道府県', city: '市区町村', address: '住所（就業場所）',
  nearest_station: '最寄り駅', job_title: '職種', job_category: '職種分類', facility_type: '施設種別', job_kind: '職務',
  visiting_care: '訪問系業務', employment_type: '雇用形態', employment_term: '無期/有期', contract_period: '契約期間・更新',
  trial_period: '試用期間', wage_type: '賃金形態', wage_min: '賃金下限', wage_max: '賃金上限', allowances_monthly: '固定手当（月額）',
  night_allowance: '夜勤手当（1回）', nights_per_month: '夜勤回数（月）', bonus_months: '賞与（月数）', other_annual: 'その他年額支給',
  work_start: '始業時刻', work_end: '終業時刻', daily_hours: '所定労働時間（日）', shift_work: '交替制', days_per_week: '週所定労働日数',
  annual_holidays: '年間休日数', holidays_note: '休日等', overtime: '時間外労働', social_insurance: '加入保険',
  smoking_measure: '受動喫煙対策', job_change_scope: '業務の変更の範囲', place_change_scope: '就業場所の変更の範囲',
  commute_note: '通勤・マイカー', required_licenses: '必須資格', preferred_licenses: '歓迎資格', experience_required: '必要経験年数',
  japanese_level: '日本語レベル', age_min: '年齢下限', age_max: '年齢上限', age_exception_reason: '年齢制限の例外事由',
  foreigner_ok: '外国人雇用', tokutei_ok: '特定技能受入', openings: '求人数', description: '仕事内容',
  received_date: '受理日', expiry_date: '紹介期限', source_url: 'URL',
};

const BOOL_FIELDS = ['visiting_care', 'shift_work', 'foreigner_ok', 'tokutei_ok'];
const YEN_FIELDS = ['wage_min', 'wage_max', 'allowances_monthly', 'night_allowance', 'other_annual'];

export function postingValue(field, v) {
  if (isEmpty(v)) return '—';
  if (BOOL_FIELDS.includes(field)) return Number(v) ? 'あり' : 'なし';
  if (YEN_FIELDS.includes(field)) return yen(v);
  if (field === 'wage_type') return WAGE_LABEL[v] || v;
  return String(v);
}

export const SOURCE_LABEL = { hw_api: 'HW求人API（自動取得）', hw_provision: 'オンライン提供（労働局）', manual: 'CSV手動取込', own: '自社登録', ocr: '求人票AI読取' };

// 職業安定法の労働条件明示項目（バックエンド postingStore.DISCLOSURE_ITEMS と対応）
const DISCLOSURE_FIELDS = new Set(['job_title', 'description', 'job_change_scope', 'employment_term', 'trial_period', 'address',
  'place_change_scope', 'work_start', 'work_end', 'overtime', 'annual_holidays', 'wage_min', 'social_insurance',
  'smoking_measure', 'employment_type', 'contract_period']);
const DISCLOSURE_LABELS = [
  ['job_title', '従事すべき業務の内容'], ['description', '業務内容の詳細'], ['job_change_scope', '業務の変更の範囲'],
  ['employment_term', '労働契約の期間（無期/有期）'], ['trial_period', '試用期間'],
  ['address', '就業の場所'], ['place_change_scope', '就業場所の変更の範囲'],
  ['work_start', '始業時刻'], ['work_end', '終業時刻'], ['overtime', '時間外労働の有無'],
  ['annual_holidays', '休日（年間休日数）'], ['wage_min', '賃金'], ['social_insurance', '加入保険'],
  ['smoking_measure', '受動喫煙防止措置'], ['employment_type', '雇用形態'],
];
// 保存前の目安表示用（正はサーバの disclosure_missing）
function localDisclosureMissing(f) {
  const shift = !!Number(f.shift_work);
  const missing = DISCLOSURE_LABELS.filter(([k]) => isEmpty(f[k]) && !(shift && (k === 'work_start' || k === 'work_end'))).map(([, l]) => l);
  if (f.employment_term === '有期' && isEmpty(f.contract_period)) missing.push('契約期間・更新の有無と上限');
  return missing;
}

// [項目, 種別, オプション]
const GROUPS = [
  ['基本', [
    ['employer_id', 'employer', { required: true }], ['company_name', 'text', { hint: '空欄なら事業所名を使用', label: '事業所名（求人票の表記）' }],
    ['job_title', 'text', { required: true }], ['job_category', 'text'], ['facility_type', 'facility'], ['job_kind', 'jobKind'],
    ['visiting_care', 'bool', { label: '訪問系業務あり' }], ['description', 'area', { rows: 4 }],
  ]],
  ['契約', [
    ['employment_type', 'text', { placeholder: '正社員・契約社員・パート等' }], ['employment_term', 'term'],
    ['contract_period', 'text', { hint: '有期の場合：期間・更新の有無・更新上限' }], ['trial_period', 'text', { placeholder: 'なし／3か月 等' }],
    ['job_change_scope', 'area', { rows: 2, hint: '雇入れ直後と変更の範囲の両方を記載' }], ['place_change_scope', 'area', { rows: 2, hint: '雇入れ直後と変更の範囲の両方を記載' }],
  ]],
  ['勤務地', [
    ['prefecture', 'text'], ['city', 'text'], ['address', 'text', { wide: true }], ['nearest_station', 'text'], ['commute_note', 'text'],
  ]],
  ['賃金', [
    ['wage_type', 'wageType'], ['wage_min', 'number', { hint: '円' }], ['wage_max', 'number', { hint: '円' }],
    ['allowances_monthly', 'number', { hint: '毎月定額で支払う手当（円）' }], ['night_allowance', 'number', { hint: '円/回' }],
    ['nights_per_month', 'number', { hint: '回/月' }], ['bonus_months', 'number', { step: '0.1', hint: '年間の月数' }],
    ['other_annual', 'number', { hint: '円/年' }],
  ]],
  ['時間・休日', [
    ['work_start', 'time'], ['work_end', 'time'], ['daily_hours', 'number', { step: '0.25', hint: '時間' }],
    ['shift_work', 'bool', { label: '交替制（シフト制）' }], ['days_per_week', 'number'], ['annual_holidays', 'number'],
    ['holidays_note', 'text', { wide: true }], ['overtime', 'text', { wide: true, placeholder: 'あり（月平均10時間）／なし 等' }],
  ]],
  ['要件', [
    ['required_licenses', 'text'], ['preferred_licenses', 'text'], ['experience_required', 'number', { hint: '年' }],
    ['japanese_level', 'text', { placeholder: 'N3以上 等' }], ['age_min', 'number'], ['age_max', 'number'],
    ['age_exception_reason', 'text', { wide: true, hint: '年齢制限を設ける場合は雇用対策法施行規則の例外事由を記載' }],
    ['foreigner_ok', 'bool', { label: '外国人雇用可' }], ['tokutei_ok', 'bool', { label: '特定技能の受入可' }],
  ]],
  ['その他', [
    ['social_insurance', 'text', { placeholder: '雇用・労災・健康・厚生' }], ['smoking_measure', 'text', { placeholder: '敷地内禁煙 等' }],
    ['openings', 'number'], ['received_date', 'date'], ['expiry_date', 'date'], ['source_url', 'url', { wide: true }],
  ]],
];
const EDIT_FIELDS = GROUPS.flatMap(([, fs]) => fs.map(([k]) => k));

function PostingField({ field, kind, opt = {}, form, set, meta, employers }) {
  const label = opt.label || POSTING_LABELS[field] || field;
  const req = opt.required;
  const hint = [opt.hint, DISCLOSURE_FIELDS.has(field) ? '労働条件明示項目' : null].filter(Boolean).join('／') || undefined;
  const common = { label, name: field, form, set, hint, required: req, wide: opt.wide };
  switch (kind) {
    case 'employer':
      return <Sel {...common} label="事業所" empty="（選択してください）"
        options={(employers || []).map(e => ({ value: String(e.id), label: e.name }))} />;
    case 'facility': return <Sel {...common} options={meta?.facilityTypes || []} />;
    case 'jobKind': return <Sel {...common} options={meta?.jobKinds || []} />;
    case 'term': return <Sel {...common} options={['無期', '有期']} />;
    case 'wageType': return <Sel {...common} empty={null} options={Object.entries(WAGE_LABEL).map(([value, l]) => ({ value, label: l }))} />;
    case 'bool': return <div className="form-group"><Check label={label} name={field} form={form} set={set} /></div>;
    case 'area': return <Area {...common} rows={opt.rows || 3} />;
    case 'number': return <In {...common} type="number" step={opt.step || '1'} min="0" inputMode="decimal" />;
    default: return <In {...common} type={kind === 'text' ? 'text' : kind} placeholder={opt.placeholder} />;
  }
}

export default function PostingDetail() {
  const { id } = useParams();
  const isNew = !id;
  const { data, error, loading, reload } = useApi(() => (isNew ? Promise.resolve(null) : get(`/postings/${id}`)), [id]);
  if (!isNew && loading && !data) return <Loading />;
  if (!isNew && error) return <><PageHeader title="求人" /><ErrorText error={error} /><Link to="/postings">← 求人一覧へ</Link></>;
  if (!isNew && data?.origin === 'hw') return <HwPosting p={data} reload={reload} />;
  return <OwnPosting key={id || 'new'} p={data} isNew={isNew} reload={reload} />;
}

function ActiveToggle({ p, reload }) {
  const [run, busy, err] = useAction();
  const active = !!Number(p.is_active);
  const toggle = async () => {
    const msg = active ? 'この求人を募集終了にしますか？（マッチング対象外になります）' : 'この求人の募集を再開しますか？';
    if (!window.confirm(msg)) return;
    await run(() => put(`/postings/${p.id}/active`, { active: !active })).then(reload).catch(() => {});
  };
  return (
    <>
      <button type="button" className={`btn ${active ? 'btn-outline' : 'btn-primary'}`} disabled={busy} onClick={toggle}>
        {busy ? '更新中…' : active ? '募集終了にする' : '募集を再開する'}
      </button>
      <ErrorText error={err} />
    </>
  );
}

function StatusBadge({ p }) {
  if (Number(p.is_active)) return <Badge color="green">有効</Badge>;
  return Number(p.closed_manually) ? <Badge color="gray">募集終了</Badge> : <Badge color="gray">無効（期限切れ）</Badge>;
}

function Referrals({ list }) {
  return (
    <Card title={`紹介中の求職者（${list?.length || 0}名）`}>
      {!list?.length ? <div className="muted">提案済み以降の求職者はいません。</div> : (
        <table className="table">
          <thead><tr><th>求職者</th><th>紹介状況</th><th /></tr></thead>
          <tbody>
            {list.map(r => (
              <tr key={r.id}>
                <td><Link to={`/seekers/${r.seeker_id}`}>{r.name}</Link></td>
                <td><Badge>{r.intro_status}</Badge></td>
                <td><Link to={`/seekers/${r.seeker_id}/matches`}>マッチング結果へ</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// ── ハローワーク求人（読み取り専用） ──
function HwPosting({ p, reload }) {
  const nav = useNavigate();
  const emps = useApi(() => get('/employers'), []);
  const [form, setForm] = useState({ employer_id: '', received_date: todayJst(), expiry_date: p.expiry_date || '', confirmed: 0 });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [run, busy, err, setErr] = useAction();

  const convert = async () => {
    if (!Number(form.confirmed)) { setErr('求人者からの求人申込みの受理と、手数料・返戻金の合意を確認してください'); return; }
    try {
      const r = await run(() => post(`/postings/${p.id}/convert`, {
        employer_id: form.employer_id ? Number(form.employer_id) : null,
        received_date: form.received_date, expiry_date: form.expiry_date, confirmed: true,
      }));
      nav(`/postings/${r.id}`, { state: { converted: true, disclosure_missing: r.disclosure_missing } });
    } catch (e) {
      if (e.status === 409 && e.body?.id) nav(`/postings/${e.body.id}`);
    }
  };

  return (
    <>
      <PageHeader title={`${p.job_title || '求人'}（${p.company_name || ''}）`} subtitle={`求人番号 ${p.posting_no}`}>
        <Badge color="blue">HW求人</Badge><StatusBadge p={p} />
        <ActiveToggle p={p} reload={reload} />
        <Link className="btn btn-outline" to="/postings">一覧へ</Link>
      </PageHeader>

      <div className="warn-box">
        ハローワーク求人は「探すための情報」です。このままでは紹介・成約登録はできません。
        紹介して手数料を得るには、求人者へ連絡して求人申込みを受理し、手数料・返戻金について合意したうえで「自社求人化」してください。
      </div>
      {p.source === 'hw_provision' && (
        <div className="danger-box">
          オンライン提供（労働局）の求人データです。職業紹介以外への利用、第三者への提供、Web等への公開は禁止されています。
        </div>
      )}

      {p.own_copy ? (
        <div className="ok-box">
          自社求人化済み → <Link to={`/postings/${p.own_copy.id}`}>{p.own_copy.posting_no}</Link>（紹介・成約は自社求人側で行ってください）
        </div>
      ) : (
        <Card title="自社求人化（求人申込みの受理）">
          <p className="muted" style={{ marginBottom: 8 }}>
            求人内容をコピーして自社受理求人（R-番号）を作成します。作成後、労働条件明示の未入力項目（業務・就業場所の変更の範囲、受動喫煙対策など）を補ってください。
          </p>
          <div className="grid2">
            <Sel label="事業所" name="employer_id" form={form} set={set} empty="（新規作成：求人の事業所名で登録）"
              options={(emps.data || []).map(e => ({ value: String(e.id), label: `${e.name}${e.city ? `（${e.city}）` : ''}` }))}
              hint="選ばない場合は、求人の事業所名・所在地で事業所を新規作成します" />
            <In label="受理日" name="received_date" type="date" form={form} set={set} hint="空欄なら本日" />
            <In label="紹介期限" name="expiry_date" type="date" form={form} set={set} hint="空欄ならHW求人の紹介期限" />
          </div>
          <ErrorText error={emps.error} />
          <Check label="求人者から求人申込みを受理し、手数料・返戻金について合意した（必須）" name="confirmed" form={form} set={set} />
          <ErrorText error={err} />
          <button type="button" className="btn btn-primary" disabled={busy || !Number(form.confirmed)} onClick={convert}>
            {busy ? '処理中…' : '自社求人化する'}
          </button>
        </Card>
      )}

      <Card title="求人内容（取込データ・編集不可）">
        <dl className="kv">
          {Object.keys(POSTING_LABELS).map(k => (
            <React.Fragment key={k}>
              <dt>{POSTING_LABELS[k]}</dt>
              <dd style={{ whiteSpace: 'pre-wrap' }}>
                {k === 'source_url' && p[k] ? <a href={p[k]} target="_blank" rel="noreferrer noopener">{p[k]}</a> : postingValue(k, p[k])}
              </dd>
            </React.Fragment>
          ))}
          <dt>取得元</dt><dd>{SOURCE_LABEL[p.source] || p.source || '—'}{p.source_file ? `（${p.source_file}）` : ''}</dd>
          <dt>取込日時</dt><dd>{p.fetched_at || '—'}</dd>
        </dl>
      </Card>

      <Referrals list={p.referrals} />
    </>
  );
}

// ── 自社受理求人（新規・編集） ──
function OwnPosting({ p, isNew, reload }) {
  const nav = useNavigate();
  const location = useLocation();
  const [sp] = useSearchParams();
  const meta = useMeta();
  const emps = useApi(() => get('/employers'), []);
  const initial = useMemo(() => {
    if (p) {
      const f = toForm(p);
      return { ...f, employer_id: isEmpty(p.employer_id) ? '' : String(p.employer_id) };
    }
    return { employer_id: sp.get('employerId') || '', wage_type: 'monthly', received_date: todayJst() };
  }, [p]); // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [serverMissing, setServerMissing] = useState(null);
  const [saved, setSaved] = useState(location.state?.saved ? '登録しました' : location.state?.converted ? '自社求人化しました。未入力の明示項目を補ってください' : '');
  const [run, busy, err, setErr] = useAction();

  useEffect(() => { if (p?.disclosure_missing) setServerMissing(p.disclosure_missing); }, [p]);

  const save = async () => {
    setSaved('');
    if (!form.employer_id) { setErr('事業所を選択してください'); return; }
    if (isEmpty(form.job_title)) { setErr('職種を入力してください'); return; }
    const body = {};
    for (const k of EDIT_FIELDS) body[k] = typeof form[k] === 'string' ? form[k].trim() : (form[k] ?? '');
    body.employer_id = Number(form.employer_id);
    try {
      if (isNew) {
        const r = await run(() => post('/postings', body));
        nav(`/postings/${r.id}`, { replace: true, state: { saved: true } });
      } else {
        const r = await run(() => put(`/postings/${p.id}`, body));
        setServerMissing(r.disclosure_missing || []);
        setSaved('保存しました');
        reload();
      }
    } catch { /* ErrorText で表示 */ }
  };

  const missing = serverMissing ?? (isNew ? localDisclosureMissing(form) : null);

  return (
    <>
      <PageHeader title={isNew ? '自社求人の登録' : `${p.job_title || '求人'}（${p.company_name || ''}）`}
        subtitle={isNew ? '求人者から求人申込みを受理した求人（自社受理求人）を登録します' : `求人番号 ${p.posting_no}`}>
        {!isNew && <><Badge color="green">自社受理求人</Badge><StatusBadge p={p} /><ActiveToggle p={p} reload={reload} /></>}
        <Link className="btn btn-outline" to="/postings">一覧へ</Link>
      </PageHeader>

      {!isNew && (
        <div className="muted" style={{ marginBottom: 8 }}>
          {p.hw_posting_no && <>元のHW求人番号：{p.hw_posting_no}　</>}
          取得元：{SOURCE_LABEL[p.source] || p.source || '—'}{p.source_file ? `（${p.source_file}）` : ''}
          {p.employer_id && <>　<Link to={`/employers/${p.employer_id}`}>事業所情報を開く</Link></>}
        </div>
      )}

      {missing && (missing.length ? (
        <div className="warn-box">
          <strong>労働条件明示の未入力項目（{missing.length}件）{isNew ? '　※保存前の確認' : ''}</strong>
          <div>{missing.join('、')}</div>
          <div className="muted">自社受理求人は職業安定法に基づき、求職者へ労働条件を明示する必要があります。紹介前に入力してください。</div>
        </div>
      ) : <div className="ok-box">労働条件明示の主な項目はすべて入力されています。</div>)}

      {GROUPS.map(([title, fields]) => (
        <Card key={title} title={title}>
          <div className="grid2">
            {fields.map(([k, kind, opt]) => (
              <PostingField key={k} field={k} kind={kind} opt={opt} form={form} set={set} meta={meta} employers={emps.data} />
            ))}
          </div>
          {title === '基本' && emps.data && !emps.data.length && (
            <div className="warn-box">事業所が登録されていません。<Link to="/employers/new">事業所を登録</Link>してから求人を登録してください。</div>
          )}
        </Card>
      ))}

      <div className="card row" style={{ position: 'sticky', bottom: 0, zIndex: 1 }}>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? '保存中…' : isNew ? '登録する' : '保存する'}</button>
        {saved && <span className="ok-box" style={{ margin: 0 }}>{saved}</span>}
        <ErrorText error={err || emps.error} />
      </div>

      {!isNew && <Referrals list={p.referrals} />}
    </>
  );
}
