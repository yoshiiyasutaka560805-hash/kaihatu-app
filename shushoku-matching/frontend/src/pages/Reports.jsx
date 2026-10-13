import React, { useState } from 'react';
import { get, download } from '../api/client';
import { useApi, useAction } from '../hooks/useApi';
import { PageHeader, Card, ErrorText, Loading, Badge, yen } from '../components/ui';

// 帳簿・報告：法定帳簿CSV／事業報告集計／情報公開／選考ファネル

function currentFy() {
  const d = new Date();
  const y = d.getFullYear();
  return d.getMonth() + 1 < 4 ? y - 1 : y;
}
const fyRange = fy => ({ from: `${fy}-04-01`, to: `${fy + 1}-03-31` });
const fyLabel = fy => `${fy}年度（${fy}/4/1〜${fy + 1}/3/31）`;
const num = v => (v == null || v === '' ? '—' : Number(v).toLocaleString());

const LEDGERS = [
  { type: 'job', label: '求人管理簿' },
  { type: 'seeker', label: '求職管理簿' },
  { type: 'fee', label: '手数料管理簿' },
];
const STAGES = ['提案済', '応募', '面接', '内定', '入職'];

function LedgerCard({ fy }) {
  const [mode, setMode] = useState('all');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [run, busy, error] = useAction();
  const [done, setDone] = useState('');

  const range = mode === 'fy' ? fyRange(fy) : mode === 'custom' ? custom : { from: '', to: '' };
  const dl = async (l) => {
    setDone('');
    const qs = new URLSearchParams(Object.entries(range).filter(([, v]) => v)).toString();
    try {
      await run(() => download(`/reports/ledger/${l.type}${qs ? `?${qs}` : ''}`, `${l.label}.csv`));
      setDone(`${l.label}をダウンロードしました`);
    } catch { /* useAction がエラーを保持 */ }
  };

  return (
    <Card title="法定帳簿（CSV）">
      <div className="row" role="radiogroup" aria-label="出力期間" style={{ marginBottom: 10 }}>
        <label className="checkbox" style={{ marginBottom: 0 }}><input type="radio" name="ledger-range" checked={mode === 'all'} onChange={() => setMode('all')} />全期間</label>
        <label className="checkbox" style={{ marginBottom: 0 }}><input type="radio" name="ledger-range" checked={mode === 'fy'} onChange={() => setMode('fy')} />選択中の年度（{fyLabel(fy)}）</label>
        <label className="checkbox" style={{ marginBottom: 0 }}><input type="radio" name="ledger-range" checked={mode === 'custom'} onChange={() => setMode('custom')} />期間を指定</label>
      </div>
      {mode === 'custom' && (
        <div className="row" style={{ marginBottom: 10 }}>
          <label htmlFor="ledger-from" className="muted">開始</label>
          <input id="ledger-from" type="date" className="form-input" style={{ width: 170 }} value={custom.from} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} />
          <label htmlFor="ledger-to" className="muted">終了</label>
          <input id="ledger-to" type="date" className="form-input" style={{ width: 170 }} value={custom.to} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} />
        </div>
      )}
      <div className="row">
        {LEDGERS.map(l => (
          <button key={l.type} type="button" className="btn btn-primary" disabled={busy} onClick={() => dl(l)}>{l.label}をダウンロード</button>
        ))}
      </div>
      <ErrorText error={error} />
      {done && <div className="ok-box">{done}</div>}
      <div className="warn-box">
        職業安定法32条の15に基づく帳簿の記載事項を網羅するための元データです。様式・保存期間は業務運営要領で確認してください（要確認）。
        出力は操作ログに記録されます。
      </div>
    </Card>
  );
}

function Rows({ rows }) {
  return rows.map(([label, value, sub]) => (
    <tr key={label}>
      <td style={sub ? { paddingLeft: 28 } : undefined}>{label}</td>
      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</td>
    </tr>
  ));
}

function BusinessCard({ fy }) {
  const { data: r, error, loading } = useApi(() => get('/reports/business', { fy }), [fy]);
  const sep = r?.前年度無期雇用就職者の6か月以内離職 || {};
  return (
    <Card title={`職業紹介事業報告 集計（${fyLabel(fy)}）`}>
      <ErrorText error={error} />
      {loading && <Loading />}
      {r && !loading && (
        <>
          <div className="alert-banner blue">
            事業報告書は毎年4月30日までに、前年度（4/1〜3/31）分を管轄労働局へ提出します（提出方法・様式は管轄労働局で要確認）。
          </div>
          <table className="table">
            <thead><tr><th>項目</th><th style={{ textAlign: 'right' }}>値</th></tr></thead>
            <tbody>
              <tr><th colSpan={2}>求人</th></tr>
              <Rows rows={[['新規求人件数（自社受理）', num(r.求人?.新規求人件数)], ['新規求人数（人数）', num(r.求人?.新規求人数)]]} />
              <tr><th colSpan={2}>求職</th></tr>
              <Rows rows={[['新規求職申込件数', num(r.求職?.新規求職申込件数)]]} />
              <tr><th colSpan={2}>紹介</th></tr>
              <Rows rows={[['紹介件数（提案済への変更件数）', num(r.紹介?.紹介件数_提案)]]} />
              <tr><th colSpan={2}>就職</th></tr>
              <Rows rows={[['就職件数', num(r.就職?.就職件数)], ['うち無期雇用', num(r.就職?.うち無期雇用), true], ['うち外国籍', num(r.就職?.うち外国籍), true]]} />
              <tr><th colSpan={2}>前年度（{fy - 1}年度）無期雇用就職者の6か月以内離職</th></tr>
              <Rows rows={[['対象者数', num(sep.対象者数)], ['離職者数（解雇を除く）', num(sep.離職者数_解雇除く)], ['不明', num(sep.不明)], ['未到来（6か月未経過）', num(sep.未到来)]]} />
              <tr><th colSpan={2}>手数料</th></tr>
              <Rows rows={[['徴収額合計（入金額）', yen(r.手数料?.徴収額合計)], ['返戻額合計', yen(r.手数料?.返戻額合計)]]} />
            </tbody>
          </table>
          {sep.未到来 > 0 && (
            <div className="danger-box">
              6か月を経過していない対象者が {sep.未到来} 名います。6か月経過後に在籍・離職を確認し、成約画面の離職情報を更新してください。
            </div>
          )}
          {sep.不明 > 0 && <div className="warn-box">離職状況「不明」が {sep.不明} 名います。可能な範囲で確認してください。</div>}
          {r.注意 && <div className="muted" style={{ marginTop: 8 }}>※ {r.注意}</div>}
        </>
      )}
    </Card>
  );
}

function DisclosureCard({ fy }) {
  const { data, error, loading } = useApi(() => get('/reports/disclosure', { fy }), [fy]);
  const entries = data ? Object.entries(data).filter(([k]) => k !== 'fiscalYear' && k !== '注意') : [];
  return (
    <Card title={`情報公開用の数値（人材サービス総合サイト等）${fyLabel(fy)}`}>
      <ErrorText error={error} />
      {loading && <Loading />}
      {data && !loading && (
        <>
          <table className="table">
            <tbody>
              {entries.map(([k, v]) => (
                <tr key={k}><td>{k}</td><td style={{ textAlign: 'right' }}>{v == null ? '—（データなし）' : typeof v === 'number' ? num(v) : v}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="warn-box">参考値です。{data.注意 || '公開項目・算定方法は最新の省令・指針で要確認'}</div>
        </>
      )}
    </Card>
  );
}

function PipelineCard({ fy }) {
  const { data, error, loading } = useApi(() => get('/reports/pipeline', { fy }), [fy]);
  const funnel = data?.funnel || {};
  const max = Math.max(1, ...STAGES.map(s => funnel[s] || 0));
  const reasons = data?.declineReasons || [];
  const totalReasons = reasons.reduce((s, r) => s + (r.c || 0), 0);
  return (
    <Card title={`選考ファネルと辞退・不採用理由（${fyLabel(fy)}）`}>
      <ErrorText error={error} />
      {loading && <Loading />}
      {data && !loading && (
        <>
          <table className="table" aria-label="選考ファネル">
            <thead><tr><th>段階</th><th style={{ textAlign: 'right' }}>件数</th><th>規模</th><th style={{ textAlign: 'right' }}>前段階からの通過率</th></tr></thead>
            <tbody>
              {STAGES.map((s, i) => {
                const n = funnel[s] || 0;
                const prev = i > 0 ? funnel[STAGES[i - 1]] || 0 : null;
                const rate = prev ? Math.round((n / prev) * 1000) / 10 : null;
                return (
                  <tr key={s}>
                    <td><Badge>{s}</Badge></td>
                    <td style={{ textAlign: 'right' }}>{num(n)}</td>
                    <td style={{ width: '40%' }}>
                      <div style={{ background: 'var(--gray100)', borderRadius: 4, height: 14 }}>
                        <div style={{ width: `${(n / max) * 100}%`, background: 'var(--blue)', height: '100%', borderRadius: 4, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} />
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{i === 0 ? '—' : rate == null ? '—' : `${rate}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="muted" style={{ marginTop: 4 }}>年度内にその段階へ進んだ件数（重複なし）。前年度から継続中の案件があるため、通過率が100%を超えることがあります。</div>

          <h3 className="card-title" style={{ marginTop: 16 }}>辞退・不採用理由</h3>
          {reasons.length === 0 ? <div className="muted">記録はありません</div> : (
            <table className="table">
              <thead><tr><th>理由</th><th>区分</th><th style={{ textAlign: 'right' }}>件数</th><th style={{ textAlign: 'right' }}>割合</th></tr></thead>
              <tbody>
                {reasons.map((r, i) => (
                  <tr key={`${r.reason}-${r.status}-${i}`}>
                    <td>{r.reason}</td><td><Badge>{r.status}</Badge></td>
                    <td style={{ textAlign: 'right' }}>{num(r.c)}</td>
                    <td style={{ textAlign: 'right' }}>{totalReasons ? `${Math.round((r.c / totalReasons) * 1000) / 10}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 className="card-title" style={{ marginTop: 16 }}>売上（入職日が年度内の成約）</h3>
          <dl className="kv">
            <dt>請求額（手数料額）</dt><dd>{yen(data.revenue?.billed)}</dd>
            <dt>入金額</dt><dd>{yen(data.revenue?.paid)}</dd>
            <dt>未入金（差額）</dt><dd>{yen((data.revenue?.billed || 0) - (data.revenue?.paid || 0))}</dd>
          </dl>
        </>
      )}
    </Card>
  );
}

export default function Reports() {
  const [fy, setFy] = useState(currentFy());
  const cur = currentFy();
  const years = Array.from({ length: 6 }, (_, i) => cur - i);

  return (
    <div>
      <PageHeader title="帳簿・報告" subtitle="法定帳簿の出力、事業報告・情報公開の集計">
        <div className="row no-print">
          <label htmlFor="fy-select" className="muted">年度</label>
          <select id="fy-select" className="form-select" style={{ width: 'auto' }} value={fy} onChange={e => setFy(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{fyLabel(y)}</option>)}
          </select>
          <button type="button" className="btn btn-outline" onClick={() => window.print()}>集計を印刷</button>
        </div>
      </PageHeader>

      <div className="no-print"><LedgerCard fy={fy} /></div>

      <div className="print-area">
        <h2 className="print-only" style={{ display: 'none' }}>株式会社リアネット 集計 {fyLabel(fy)}</h2>
        <BusinessCard fy={fy} />
        <DisclosureCard fy={fy} />
        <PipelineCard fy={fy} />
      </div>
      <style>{`@media print { .print-only { display: block !important; margin-bottom: 8px; } .card { box-shadow: none; border: 1px solid #ddd; break-inside: avoid; } }`}</style>
    </div>
  );
}
