import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { del, get, post, put } from '../api/client';
import { useAction, useApi, useMeta } from '../hooks/useApi';
import { Badge, Card, Check, ErrorText, Loading, MultiChips, PageHeader, toForm } from '../components/ui';
import { Area, In, isEmpty } from './PostingDetail';

const FIELDS = ['name', 'corporate_number', 'prefecture', 'city', 'address', 'contact_person', 'contact_title', 'phone', 'email',
  'facility_types', 'tokutei_support', 'council_joined', 'contract_date', 'fee_rate_percent', 'notes'];

function parseRefund(json) {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) ? v.map(t => ({ withinDays: String(t.withinDays ?? ''), rate: String(t.rate ?? '') })) : [];
  } catch { return []; }
}

// 返戻金規定の行エディタ：[{ withinDays, rate }] → JSON
function RefundEditor({ rows, setRows }) {
  const update = (i, k, v) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="form-group wide">
      <div className="form-label">返戻金規定</div>
      {!rows.length && <div className="muted" style={{ marginBottom: 6 }}>未設定：設定画面の返戻金規定（既定）を使います。</div>}
      {rows.map((r, i) => (
        <div className="row" key={i} style={{ marginBottom: 6 }}>
          <label>入職後
            <input className="form-input" type="number" min="1" step="1" style={{ width: 90, margin: '0 4px' }} value={r.withinDays}
              aria-label={`${i + 1}行目 入職後の日数`} onChange={e => update(i, 'withinDays', e.target.value)} />
            日以内に離職 →
          </label>
          <label>返戻率
            <input className="form-input" type="number" min="0" max="100" step="1" style={{ width: 80, margin: '0 4px' }} value={r.rate}
              aria-label={`${i + 1}行目 返戻率`} onChange={e => update(i, 'rate', e.target.value)} />
            %
          </label>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>削除</button>
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setRows(rs => [...rs, { withinDays: '', rate: '' }])}>＋ 行を追加</button>
      <div className="muted">例：30日以内 80%、90日以内 50%、180日以内 10%。日数の短い順に判定します。手数料と同様、求人者との契約内容に合わせてください。</div>
    </div>
  );
}

function buildPolicy(rows) {
  const filled = rows.filter(r => !isEmpty(r.withinDays) || !isEmpty(r.rate));
  for (const r of filled) {
    const d = Number(r.withinDays); const rate = Number(r.rate);
    if (isEmpty(r.withinDays) || isEmpty(r.rate) || !Number.isInteger(d) || d <= 0 || !Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new Error('返戻金規定：日数は1以上の整数、返戻率は0〜100で入力してください');
    }
  }
  if (!filled.length) return '';
  return JSON.stringify(filled.map(r => ({ withinDays: Number(r.withinDays), rate: Number(r.rate) })).sort((a, b) => a.withinDays - b.withinDays));
}

export default function EmployerEdit() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();
  const location = useLocation();
  const meta = useMeta();
  const { data, error, loading, reload } = useApi(() => (isNew ? Promise.resolve(null) : get(`/employers/${id}`)), [id]);
  const [form, setForm] = useState({});
  const [rows, setRows] = useState([]);
  const [saved, setSaved] = useState(location.state?.saved ? '登録しました' : '');
  const [run, busy, err, setErr] = useAction();
  const [delRun, delBusy, delErr] = useAction();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (data) { setForm(toForm(data)); setRows(parseRefund(data.refund_policy)); }
    else if (isNew) { setForm({}); setRows([]); }
  }, [data, isNew]);

  const save = async () => {
    setSaved('');
    if (isEmpty(String(form.name ?? '').trim())) { setErr('事業所名を入力してください'); return; }
    let refund;
    try { refund = buildPolicy(rows); } catch (e) { setErr(e.message); return; }
    const body = {};
    for (const k of FIELDS) body[k] = typeof form[k] === 'string' ? form[k].trim() : (form[k] ?? '');
    body.refund_policy = refund;
    try {
      if (isNew) {
        const r = await run(() => post('/employers', body));
        setSaved('登録しました');
        nav(`/employers/${r.id}`, { replace: true, state: { saved: true } });
      } else {
        await run(() => put(`/employers/${id}`, body));
        setSaved('保存しました');
        reload();
      }
    } catch { /* ErrorText で表示 */ }
  };

  const remove = async () => {
    if (!window.confirm(`「${data?.name}」を削除しますか？\n（論理削除：一覧・選択肢から消えます。登録済みの求人・成約の記録は残ります）`)) return;
    await delRun(() => del(`/employers/${id}`)).then(() => nav('/employers')).catch(() => {});
  };

  if (!isNew && loading && !data) return <Loading />;
  if (!isNew && error) return <><PageHeader title="事業所" /><ErrorText error={error} /><Link to="/employers">← 事業所一覧へ</Link></>;

  return (
    <>
      <PageHeader title={isNew ? '事業所の登録' : data?.name || '事業所'} subtitle={isNew ? '求人者（事業所）と契約条件を登録します' : undefined}>
        {!isNew && <Link className="btn btn-primary" to={`/postings/new?employerId=${id}`}>この事業所の求人を登録</Link>}
        <Link className="btn btn-outline" to="/employers">一覧へ</Link>
      </PageHeader>

      <Card title="基本情報">
        <div className="grid2">
          <In label="事業所名" name="name" form={form} set={set} required />
          <In label="法人番号" name="corporate_number" form={form} set={set} inputMode="numeric" maxLength={13} hint="13桁" />
          <In label="都道府県" name="prefecture" form={form} set={set} />
          <In label="市区町村" name="city" form={form} set={set} />
          <In label="住所" name="address" form={form} set={set} wide />
          <In label="担当者名" name="contact_person" form={form} set={set} />
          <In label="担当者の役職" name="contact_title" form={form} set={set} />
          <In label="電話番号" name="phone" type="tel" form={form} set={set} />
          <In label="メールアドレス" name="email" type="email" form={form} set={set} />
          <MultiChips label="施設種別（複数選択）" name="facility_types" form={form} set={set} options={meta?.facilityTypes || []} />
        </div>
      </Card>

      <Card title="特定技能の受入体制">
        <div className="grid2">
          <div className="form-group wide"><Check label="介護分野における特定技能協議会に加入済み" name="council_joined" form={form} set={set} /></div>
          <Area label="特定技能の支援体制" name="tokutei_support" form={form} set={set} rows={2}
            hint="自社支援／登録支援機関への委託（機関名）など" />
        </div>
      </Card>

      <Card title="契約条件（手数料・返戻金）">
        <div className="grid2">
          <In label="契約締結日" name="contract_date" type="date" form={form} set={set} hint="求人申込みの受理・手数料に関する契約を締結した日" />
          <In label="手数料率（%）" name="fee_rate_percent" type="number" step="0.1" min="0" form={form} set={set}
            hint="未設定なら設定画面の値を使います。届出した手数料表の範囲内で設定してください" />
          <RefundEditor rows={rows} setRows={setRows} />
          <Area label="備考" name="notes" form={form} set={set} />
        </div>
      </Card>

      <div className="card row">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? '保存中…' : isNew ? '登録する' : '保存する'}</button>
        {saved && <span className="ok-box" style={{ margin: 0 }}>{saved}</span>}
        <ErrorText error={err} />
        <span className="spacer" />
        {!isNew && <button type="button" className="btn btn-danger" disabled={delBusy} onClick={remove}>{delBusy ? '削除中…' : '削除'}</button>}
        <ErrorText error={delErr} />
      </div>

      {!isNew && data && (
        <Card title={`この事業所の求人（${data.postings?.length || 0}件）`}
          actions={<Link className="btn btn-outline btn-sm" to={`/postings/new?employerId=${id}`}>＋ 求人を登録</Link>}>
          {!data.postings?.length ? <div className="muted">求人はまだありません。</div> : (
            <table className="table">
              <thead><tr><th>求人番号</th><th>職種</th><th>受理日</th><th>紹介期限</th><th>状態</th></tr></thead>
              <tbody>
                {data.postings.map(p => (
                  <tr key={p.id}>
                    <td><Link to={`/postings/${p.id}`}>{p.posting_no}</Link></td>
                    <td>{p.job_title}</td>
                    <td>{p.received_date || '—'}</td>
                    <td>{p.expiry_date || '—'}</td>
                    <td>{Number(p.is_active) ? <Badge color="green">有効</Badge> : <Badge color="gray">無効・募集終了</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </>
  );
}
