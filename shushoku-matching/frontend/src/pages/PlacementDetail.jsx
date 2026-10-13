import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, post, put } from '../api/client';
import { useAction, useApi } from '../hooks/useApi';
import { Badge, Card, Check, ErrorText, Loading, PageHeader, toForm, Warnings, yen } from '../components/ui';
import { Area, In, isEmpty, Sel, todayJst } from './PostingDetail';
import { billingBadges } from './Placements';

const FIELDS = ['hire_date', 'employment_term', 'monthly_wage', 'fee_basis_months', 'fee_rate_percent', 'fee_amount', 'fee_basis_note',
  'invoice_no', 'invoice_date', 'due_date', 'paid_date', 'paid_amount', 'separation_date', 'separation_type', 'separation_reason',
  'separation_unknown', 'refund_rate', 'refund_amount', 'refund_date'];
const SEPARATION_TYPES = ['自己都合', '会社都合', '解雇', '契約満了', 'その他'];
const METHODS = ['電話', '訪問', '面談', 'メール', 'SNS', 'その他'];

const num = v => (isEmpty(v) ? undefined : Number(String(v).replace(/[,，円\s]/g, '')));

export default function PlacementDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(() => get(`/placements/${id}`), [id]);
  const [form, setForm] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [run, busy, err, setErr] = useAction();
  const [calcRun, calcBusy, calcErr] = useAction();
  const [saveRes, setSaveRes] = useState(null);
  const [calcRes, setCalcRes] = useState(null);

  useEffect(() => { if (data) setForm(toForm(data)); }, [data]);

  if (loading && !data) return <Loading />;
  if (error) return <><PageHeader title="成約" /><ErrorText error={error} /><Link to="/placements">← 成約一覧へ</Link></>;
  if (!data) return null;

  const calc = async () => {
    setCalcRes(null);
    try {
      // 空欄の項目は送らない（サーバ側で保存値 → 事業所 → 設定の順に補完）
      const r = await calcRun(() => post(`/placements/${id}/calc-fee`, {
        monthly_wage: num(form.monthly_wage), fee_basis_months: num(form.fee_basis_months), fee_rate_percent: num(form.fee_rate_percent),
      }));
      setCalcRes(r);
      if (r.amount != null) {
        setForm(f => ({ ...f, fee_amount: r.amount, fee_rate_percent: r.rate, fee_basis_months: r.months, fee_basis_note: r.basisNote || f.fee_basis_note }));
      }
    } catch { /* ErrorText */ }
  };

  const save = async () => {
    setSaveRes(null);
    if (isEmpty(form.hire_date)) { setErr('入職日を入力してください'); return; }
    if (isEmpty(form.employment_term)) { setErr('無期/有期を選択してください'); return; }
    const body = {};
    for (const k of FIELDS) {
      const v = typeof form[k] === 'string' ? form[k].trim() : (form[k] ?? '');
      if (v === '') {
        // 算定月数は必須列。空欄なら送らない（保存値を維持）
        if (k === 'fee_basis_months') continue;
        // 返戻率・返戻額：空欄で送ると自動計算されないため、保存値が無いときは送らない（離職日入力時に自動計算）
        if ((k === 'refund_rate' || k === 'refund_amount') && data[k] == null) continue;
      }
      body[k] = v;
    }
    try {
      const r = await run(() => put(`/placements/${id}`, body));
      setSaveRes(r);
      reload();
    } catch { /* ErrorText */ }
  };

  const rateHint = `未入力なら${data.employer_fee_rate != null ? `事業所の率（${data.employer_fee_rate}%）` : '事業所の率（未設定）→ 設定画面の率'}を使用`;
  const badges = billingBadges(data);

  return (
    <>
      <PageHeader title={`成約：${data.seeker_name}`} subtitle={`${data.employer_name || data.company_name}／${data.job_title}`}>
        {badges.map(([l, c]) => <Badge key={l} color={c}>{l}</Badge>)}
        <Link className="btn btn-outline" to="/placements">一覧へ</Link>
      </PageHeader>

      <Card title="概要">
        <dl className="kv" style={{ marginBottom: 12 }}>
          <dt>求職者</dt><dd><Link to={`/seekers/${data.seeker_id}`}>{data.seeker_name}</Link></dd>
          <dt>事業所</dt><dd>{data.employer_id ? <Link to={`/employers/${data.employer_id}`}>{data.employer_name || data.company_name}</Link> : data.company_name}</dd>
          <dt>職種</dt><dd>{data.job_title}</dd>
          <dt>求人番号</dt><dd><Link to={`/postings/${data.posting_id}`}>{data.posting_no}</Link></dd>
          <dt>登録日時</dt><dd>{data.created_at}</dd>
        </dl>
        <div className="grid2">
          <In label="入職日" name="hire_date" type="date" form={form} set={set} required />
          <Sel label="無期/有期" name="employment_term" form={form} set={set} options={['無期', '有期']} required empty={null} />
        </div>
      </Card>

      <Card title="手数料">
        <div className="grid2">
          <In label="算定基礎の月額賃金（円）" name="monthly_wage" type="number" min="0" form={form} set={set} hint="成約時に求人の賃金下限から自動設定。実際の賃金に合わせて修正" />
          <In label="算定月数" name="fee_basis_months" type="number" step="0.5" min="0" form={form} set={set} hint="空欄なら設定画面の月数" />
          <In label="手数料率（%）" name="fee_rate_percent" type="number" step="0.1" min="0" form={form} set={set} hint={rateHint} />
          <div className="form-group" style={{ alignSelf: 'end' }}>
            <button type="button" className="btn btn-outline" disabled={calcBusy} onClick={calc}>{calcBusy ? '計算中…' : '再計算'}</button>
          </div>
          <In label="手数料額（円）" name="fee_amount" type="number" min="0" form={form} set={set} hint={`現在の保存値：${yen(data.fee_amount)}`} />
          <In label="算定根拠" name="fee_basis_note" form={form} set={set} wide />
        </div>
        <ErrorText error={calcErr} />
        {calcRes && (
          calcRes.amount != null
            ? <div className="ok-box">再計算結果：{yen(calcRes.amount)}（{calcRes.basisNote}）をフォームに反映しました。保存すると確定します。</div>
            : <div className="danger-box">手数料を計算できませんでした。</div>
        )}
        {calcRes && <Warnings items={calcRes.warnings} />}
      </Card>

      <Card title="請求・入金">
        <div className="grid2">
          <In label="請求書番号" name="invoice_no" form={form} set={set} />
          <In label="請求日" name="invoice_date" type="date" form={form} set={set} hint="入力して保存すると、支払期日が空欄なら設定の日数後に自動設定されます" />
          <In label="支払期日" name="due_date" type="date" form={form} set={set} />
          <In label="入金日" name="paid_date" type="date" form={form} set={set} />
          <In label="入金額（円）" name="paid_amount" type="number" min="0" form={form} set={set}
            hint={!isEmpty(form.paid_amount) && !isEmpty(form.fee_amount) && Number(form.paid_amount) !== Number(form.fee_amount) ? '⚠ 手数料額と一致しません' : undefined} />
        </div>
      </Card>

      <Card title="離職・返戻金">
        <div className="grid2">
          <In label="離職日" name="separation_date" type="date" form={form} set={set} />
          <Sel label="離職区分" name="separation_type" form={form} set={set} options={SEPARATION_TYPES} />
          <Area label="離職理由" name="separation_reason" form={form} set={set} rows={2} />
          <div className="form-group wide">
            <Check label="6か月時点で在職状況を把握できなかった（不明）" name="separation_unknown" form={form} set={set} />
            <div className="muted">事業報告書（6か月以内の離職状況）で「不明」として扱います。</div>
          </div>
          <In label="返戻率（%）" name="refund_rate" type="number" step="0.1" min="0" max="100" form={form} set={set} />
          <In label="返戻額（円）" name="refund_amount" type="number" min="0" form={form} set={set} />
          <In label="返戻日" name="refund_date" type="date" form={form} set={set} />
        </div>
        <p className="muted">
          離職日を入力して保存すると、返戻率・返戻額が空欄の場合は事業所（未設定なら設定画面）の返戻金規定で自動計算します（入金額があれば入金額、なければ手数料額を基準）。
          既に返戻額が保存されている場合は再計算されません。再計算する場合は返戻率・返戻額を空欄にして一度保存し、もう一度保存してください。
        </p>
      </Card>

      <div className="card row">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存する'}</button>
        {saveRes && <span className="ok-box" style={{ margin: 0 }}>保存しました</span>}
        <ErrorText error={err} />
      </div>
      {saveRes && <Warnings items={saveRes.warnings} />}

      <Followups placementId={id} list={data.followups || []} reload={reload} />
    </>
  );
}

function FollowupRow({ placementId, f, reload }) {
  const today = todayJst();
  const [form, setForm] = useState(() => ({
    done_date: f.done_date || '', method: f.method || '', note: f.note || '',
    still_employed: f.still_employed == null ? '' : String(f.still_employed),
  }));
  const set = (k, v) => setForm(s => ({ ...s, [k]: v }));
  const [open, setOpen] = useState(false);
  const [run, busy, err, setErr] = useAction();
  const overdue = !f.done_date && f.due_date < today;

  const save = async () => {
    if (isEmpty(form.done_date)) { setErr('実施日を入力してください'); return; }
    const body = { done_date: form.done_date, method: form.method.trim(), note: form.note.trim() };
    if (form.still_employed !== '') body.still_employed = Number(form.still_employed);
    await run(() => put(`/placements/${placementId}/followups/${f.id}`, body)).then(() => { setOpen(false); reload(); }).catch(() => {});
  };

  return (
    <>
      <tr>
        <td>{f.kind}{f.kind === '6か月' && <div className="muted">事業報告書の6か月以内離職の確認に使用</div>}</td>
        <td>{f.due_date}{overdue && <> <Badge color="red">期日超過</Badge></>}</td>
        <td>{f.done_date || '—'}</td>
        <td>{f.method || '—'}</td>
        <td>{f.still_employed == null ? '—' : Number(f.still_employed) ? <Badge color="green">在職</Badge> : <Badge color="red">離職</Badge>}</td>
        <td style={{ whiteSpace: 'pre-wrap' }}>{f.note || ''}{f.operator && <div className="muted">記録：{f.operator}</div>}</td>
        <td><button type="button" className="btn btn-outline btn-sm" onClick={() => { setOpen(o => !o); if (!form.done_date) set('done_date', today); }}>
          {open ? '閉じる' : f.done_date ? '修正' : '実施記録'}</button></td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} style={{ background: 'var(--gray50)' }}>
            <div className="grid2">
              <In label="実施日" name="done_date" type="date" form={form} set={set} required />
              <In label="方法" name="method" form={form} set={set} list="followup-methods" placeholder="電話・訪問 等" />
              <Sel label="在職確認" name="still_employed" form={form} set={set} empty="（未確認）"
                options={[{ value: '1', label: '在職' }, { value: '0', label: '離職' }]}
                hint={form.still_employed === '0' ? '離職の場合は上の「離職・返戻金」に離職日を入力してください' : undefined} />
              <Area label="メモ" name="note" form={form} set={set} rows={2} />
            </div>
            <div className="row">
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{busy ? '記録中…' : '記録する'}</button>
              <ErrorText error={err} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Followups({ placementId, list, reload }) {
  const [form, setForm] = useState({ due_date: '', note: '' });
  const set = (k, v) => setForm(s => ({ ...s, [k]: v }));
  const [run, busy, err, setErr] = useAction();
  const [added, setAdded] = useState(false);
  const add = async () => {
    setAdded(false);
    if (isEmpty(form.due_date)) { setErr('予定日を入力してください'); return; }
    await run(() => post(`/placements/${placementId}/followups`, { kind: 'その他', due_date: form.due_date, note: form.note.trim() }))
      .then(() => { setForm({ due_date: '', note: '' }); setAdded(true); reload(); }).catch(() => {});
  };
  return (
    <Card title="定着フォロー">
      <datalist id="followup-methods">{METHODS.map(m => <option key={m} value={m} />)}</datalist>
      {!list.length ? <div className="muted">フォロー予定はありません。</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>種類</th><th>予定日</th><th>実施日</th><th>方法</th><th>在職確認</th><th>メモ</th><th /></tr></thead>
            <tbody>{list.map(f => <FollowupRow key={f.id} placementId={placementId} f={f} reload={reload} />)}</tbody>
          </table>
        </div>
      )}
      <div className="card-title" style={{ marginTop: 16 }}>フォローを追加</div>
      <div className="grid2">
        <In label="予定日" name="due_date" type="date" form={form} set={set} required />
        <In label="メモ" name="note" form={form} set={set} />
      </div>
      <div className="row">
        <button type="button" className="btn btn-outline" disabled={busy} onClick={add}>{busy ? '追加中…' : 'フォローを追加'}</button>
        {added && <span className="ok-box" style={{ margin: 0 }}>追加しました</span>}
        <ErrorText error={err} />
      </div>
    </Card>
  );
}
