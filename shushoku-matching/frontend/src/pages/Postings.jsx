import React, { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post, put, upload } from '../api/client';
import { useAction, useApi } from '../hooks/useApi';
import { Badge, Card, ErrorText, Loading, PageHeader, yen, WAGE_LABEL } from '../components/ui';
import { SOURCE_LABEL } from './PostingDetail';

const TABS = [['', 'すべて'], ['hw', 'HW求人'], ['own', '自社受理求人']];

function wageText(p) {
  if (p.wage_min == null && p.wage_max == null) return '—';
  const t = WAGE_LABEL[p.wage_type] || '';
  if (p.wage_min != null && p.wage_max != null && p.wage_min !== p.wage_max) return `${t} ${yen(p.wage_min)}〜${yen(p.wage_max)}`;
  return `${t} ${yen(p.wage_min ?? p.wage_max)}`;
}

function FilePicker({ label, accept, onFile, busy, busyText }) {
  const ref = useRef(null);
  const id = useId();
  return (
    <>
      <input id={id} ref={ref} type="file" accept={accept} style={{ display: 'none' }} aria-label={label}
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
      <button type="button" className="btn btn-outline" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? busyText : label}
      </button>
    </>
  );
}

function ImportResult({ r }) {
  if (!r) return null;
  const hasErr = r.errors?.length > 0;
  return (
    <div className={hasErr && !r.inserted && !r.updated ? 'danger-box' : 'ok-box'}>
      <div>CSV取込：新規 {r.inserted}件・更新 {r.updated}件・スキップ {r.skipped}件（自社求人と同番号）・期限切れ無効化 {r.deactivated}件</div>
      {r.rematch && <div>再マッチング：対象求職者 {r.rematch.seekers}名、新着候補 {r.rematch.newCandidates}件</div>}
      {hasErr && (
        <details open={r.errors.length <= 10}>
          <summary>エラー {r.errors.length}件</summary>
          <ul style={{ marginLeft: 18 }}>{r.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

function FetchResult({ r }) {
  if (!r) return null;
  const pv = r.provision || {};
  return (
    <div className={pv.error ? 'danger-box' : 'ok-box'}>
      <div>
        オンライン提供の取込：
        {pv.error ? `エラー（${pv.error}）` : pv.skipped ? '無効のため実行されませんでした（利用承認後に設定画面で有効化）'
          : !pv.files?.length ? '取込対象のファイルはありませんでした' : `${pv.files.length}ファイル`}
      </div>
      {pv.files?.length > 0 && (
        <ul style={{ marginLeft: 18 }}>
          {pv.files.map(f => <li key={f.file}>{f.file}：{f.error ? `エラー（${f.error}）` : `新規 ${f.inserted}件・更新 ${f.updated}件・エラー ${f.errors}件`}</li>)}
        </ul>
      )}
      <div>期限切れ無効化 {r.deactivated ?? 0}件</div>
      {r.rematch && <div>再マッチング：対象求職者 {r.rematch.seekers}名、新着候補 {r.rematch.newCandidates}件</div>}
    </div>
  );
}

function ImportCard({ onDone }) {
  const [csvRun, csvBusy, csvErr] = useAction();
  const [fetchRun, fetchBusy, fetchErr] = useAction();
  const [ocrRun, ocrBusy, ocrErr] = useAction();
  const [csvRes, setCsvRes] = useState(null);
  const [fetchRes, setFetchRes] = useState(null);
  const [ocrRes, setOcrRes] = useState(null);

  const importCsv = file => {
    setCsvRes(null);
    csvRun(() => upload('/postings/import-csv', file)).then(r => { setCsvRes(r); onDone(); }).catch(() => {});
  };
  const fetchNow = () => {
    setFetchRes(null);
    fetchRun(() => post('/postings/fetch-now')).then(r => { setFetchRes(r); onDone(); }).catch(() => {});
  };
  const ocr = file => {
    setOcrRes(null);
    ocrRun(() => upload('/postings/ocr', file)).then(r => setOcrRes({ ...r, fileName: file.name })).catch(() => {});
  };

  return (
    <Card title="求人の取込・登録">
      <div className="row">
        <FilePicker label="CSV取込" accept=".csv,text/csv" onFile={importCsv} busy={csvBusy} busyText="取込中…" />
        <a className="btn btn-outline" href="/postings-template.csv" download="求人取込テンプレート.csv">CSVテンプレート</a>
        <button type="button" className="btn btn-outline" disabled={fetchBusy} onClick={fetchNow}>
          {fetchBusy ? '取込実行中…' : '定期取込を今すぐ実行'}
        </button>
        <FilePicker label="求人票PDF・画像をAIで読取" accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
          onFile={ocr} busy={ocrBusy} busyText="AI読取中…" />
        <span className="spacer" />
        <Link className="btn btn-primary" to="/postings/new">＋ 自社求人を登録</Link>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        CSV取込は求人番号で上書き更新します（自社受理求人と同じ番号の行はスキップ）。求人票のAI読取は事業所から受け取った求人票が対象で、結果は承認待ちに入ります。
      </p>
      <ErrorText error={csvErr} /><ImportResult r={csvRes} />
      <ErrorText error={fetchErr} /><FetchResult r={fetchRes} />
      <ErrorText error={ocrErr} />
      {ocrRes && (
        <div className="ok-box">
          「{ocrRes.fileName}」を読み取りました。<Link to="/drafts">承認待ち（/drafts）</Link>で内容を確認し、事業所を選んで承認してください。
          {ocrRes.uncertain_points?.length > 0 && <div className="muted">要確認の箇所：{ocrRes.uncertain_points.length}件</div>}
        </div>
      )}
      <div className="warn-box">
        オンライン提供（労働局）の求人データは、職業紹介以外への利用・第三者への提供・公開（Web掲載、SNS、印刷物の配布等）が禁止されています。
        HW求人は「探すための情報」です。紹介するには求人者へ連絡して求人申込みを受理し、手数料・返戻金の合意のうえ「自社求人化」してください。
      </div>
    </Card>
  );
}

function RunsCard({ runs }) {
  const [open, setOpen] = useState(false);
  return (
    <Card title="取込ログ" actions={<button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(o => !o)}>{open ? '閉じる' : '表示'}</button>}>
      {open && (runs.loading ? <Loading /> : runs.error ? <ErrorText error={runs.error} /> : !runs.data?.length ? <div className="muted">取込履歴はありません。</div> : (
        <table className="table">
          <thead><tr><th>開始</th><th>終了</th><th>取得元</th><th>状態</th><th>新規</th><th>更新</th><th>無効化</th><th>メッセージ</th></tr></thead>
          <tbody>
            {runs.data.map(r => (
              <tr key={r.id}>
                <td>{r.started_at}</td><td>{r.finished_at || '—'}</td>
                <td>{SOURCE_LABEL[r.source] || r.source}</td>
                <td><Badge>{r.status}</Badge></td>
                <td>{r.inserted ?? 0}</td><td>{r.updated ?? 0}</td><td>{r.deactivated ?? 0}</td>
                <td style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{r.message || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </Card>
  );
}

function ActiveCell({ p, onChanged }) {
  const [run, busy, err] = useAction();
  const active = !!Number(p.is_active);
  const toggle = () => run(() => put(`/postings/${p.id}/active`, { active: !active })).then(onChanged).catch(() => {});
  return (
    <>
      {active ? <Badge color="green">有効</Badge> : <Badge color="gray">{Number(p.closed_manually) ? '募集終了' : '無効'}</Badge>}{' '}
      <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={toggle}>{active ? '募集終了' : '再開'}</button>
      {err && <div className="error">{err}</div>}
    </>
  );
}

export default function Postings() {
  const [origin, setOrigin] = useState('');
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [all, setAll] = useState(false);
  const [applied, setApplied] = useState({ q: '', city: '' });
  const qId = useId(); const cityId = useId();
  const list = useApi(() => get('/postings', { origin, q: applied.q, city: applied.city, active: all ? 'all' : undefined }),
    [origin, applied.q, applied.city, all]);
  const runs = useApi(() => get('/postings/runs'), []);
  const reloadAll = () => { list.reload(); runs.reload(); };
  const search = e => { e.preventDefault(); setApplied({ q: q.trim(), city: city.trim() }); };

  return (
    <>
      <PageHeader title="求人" subtitle="ハローワーク求人（探すための情報）と自社受理求人（紹介できる求人）を管理します" />
      <ImportCard onDone={reloadAll} />

      <Card>
        <div className="tabs" role="tablist">
          {TABS.map(([v, l]) => (
            <button type="button" role="tab" aria-selected={origin === v} key={v} className={origin === v ? 'active' : ''} onClick={() => setOrigin(v)}>{l}</button>
          ))}
        </div>
        <form className="row" onSubmit={search} style={{ marginBottom: 12 }}>
          <label htmlFor={qId} className="form-label" style={{ margin: 0 }}>検索</label>
          <input id={qId} className="form-input" style={{ maxWidth: 260 }} value={q} onChange={e => setQ(e.target.value)} placeholder="事業所・職種・求人番号・施設種別" />
          <label htmlFor={cityId} className="form-label" style={{ margin: 0 }}>市区町村</label>
          <input id={cityId} className="form-input" style={{ maxWidth: 160 }} value={city} onChange={e => setCity(e.target.value)} />
          <button type="submit" className="btn btn-primary btn-sm">絞込</button>
          <label className="checkbox" style={{ margin: 0 }}>
            <input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} />無効・募集終了も表示
          </label>
          <span className="spacer" />
          {list.data && <span className="muted">{list.data.length}件{list.data.length >= 1000 ? '（上限1000件まで表示）' : ''}</span>}
        </form>
        <ErrorText error={list.error} />
        {list.loading && !list.data ? <Loading /> : list.data && !list.data.length ? <div className="muted">該当する求人はありません。</div> : list.data && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr>
                <th>求人番号</th><th>区分</th><th>事業所</th><th>職種</th><th>施設種別</th><th>勤務地</th>
                <th>雇用形態</th><th>賃金</th><th>紹介期限</th><th>取得元</th><th>状態</th>
              </tr></thead>
              <tbody>
                {list.data.map(p => (
                  <tr key={p.id}>
                    <td><Link to={`/postings/${p.id}`}>{p.posting_no}</Link>
                      {p.hw_posting_no && <div className="muted">元HW {p.hw_posting_no}</div>}</td>
                    <td>{p.origin === 'own' ? <Badge color="green">自社</Badge> : p.origin === 'web' ? <Badge color="yellow">ネット</Badge> : <Badge color="blue">HW</Badge>}</td>
                    <td>{p.company_name}</td>
                    <td>{p.job_title}</td>
                    <td>{p.facility_type || '—'}</td>
                    <td>{[p.prefecture, p.city].filter(Boolean).join(' ') || '—'}</td>
                    <td>{p.employment_type || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{wageText(p)}</td>
                    <td>{p.expiry_date || '—'}</td>
                    <td>{SOURCE_LABEL[p.source] || p.source || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}><ActiveCell p={p} onChanged={list.reload} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RunsCard runs={runs} />
    </>
  );
}
