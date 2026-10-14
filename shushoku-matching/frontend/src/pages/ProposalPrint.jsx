import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { get } from '../api/client';
import { useApi } from '../hooks/useApi';
import { ErrorText, Loading, LANG_LABEL } from '../components/ui';

// 印刷用の提案書（サイドメニューなし）。A4縦。
const PRINT_CSS = `
@page { size: A4 portrait; margin: 12mm; }
.pp-wrap { max-width: 210mm; margin: 0 auto; padding: 16px; background: #fff; color: #111; }
.pp-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; padding: 10px 12px;
  background: var(--gray100, #f3f4f6); border-radius: 8px; }
.pp-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; border-bottom: 2px solid #111;
  padding-bottom: 6px; margin-bottom: 12px; }
.pp-title { font-size: 20px; font-weight: 700; }
.pp-meta { font-size: 11px; text-align: right; line-height: 1.5; }
.pp-cmp { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
.pp-cmp th, .pp-cmp td { border: 1px solid #9ca3af; padding: 5px 7px; vertical-align: top; word-break: break-word; }
.pp-cmp thead th { background: #e5e7eb; text-align: left; }
.pp-cmp tbody th { background: #f3f4f6; text-align: left; font-weight: 600; width: 26mm; }
.pp-cmp tr { break-inside: avoid; page-break-inside: avoid; }
.pp-item { border: 1px solid #9ca3af; border-radius: 6px; margin-bottom: 10px; break-inside: avoid; page-break-inside: avoid; }
.pp-item-head { background: #e5e7eb; padding: 6px 10px; font-weight: 700; font-size: 14px; border-radius: 6px 6px 0 0; }
.pp-item-head small { font-weight: 400; color: #4b5563; margin-left: 8px; font-size: 11px; }
.pp-item dl { display: grid; grid-template-columns: 30mm 1fr; margin: 0; font-size: 12px; }
.pp-item dt, .pp-item dd { padding: 4px 10px; border-top: 1px solid #e5e7eb; }
.pp-item dt { background: #f9fafb; color: #374151; font-weight: 600; }
.pp-note { margin-top: 12px; font-size: 11px; border-top: 1px solid #9ca3af; padding-top: 6px; }
.pp-pre { white-space: pre-wrap; }
@media print {
  body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pp-wrap { padding: 0; max-width: none; }
  .pp-cmp thead { display: table-header-group; }
}
`;

const CARD_THRESHOLD = 3; // 3件以上は縦カード

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* フォールバックへ */ }
  }
  // http 環境などで Clipboard API が使えない場合
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

function CompareTable({ labels, items, keys }) {
  return (
    <table className="pp-cmp">
      <thead>
        <tr>
          <th scope="col" style={{ width: '26mm' }} aria-label="項目" />
          {items.map((it, i) => <th scope="col" key={i}>【{i + 1}】{it.fields.company}<div style={{ fontWeight: 400, fontSize: 10 }}>{it.id}</div></th>)}
        </tr>
      </thead>
      <tbody>
        {keys.filter(k => k !== 'company').map(k => (
          <tr key={k}>
            <th scope="row">{labels[k]}</th>
            {items.map((it, i) => <td key={i} className="pp-pre">{it.fields[k] ?? '—'}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ItemCards({ labels, items, keys }) {
  return items.map((it, i) => (
    <section className="pp-item" key={i} aria-label={`${i + 1}件目 ${it.fields.company}`}>
      <div className="pp-item-head">【{i + 1}】{it.fields.company}<small>{it.id}</small></div>
      <dl>
        {keys.filter(k => k !== 'company').map(k => (
          <React.Fragment key={k}>
            <dt>{labels[k]}</dt>
            <dd className="pp-pre">{it.fields[k] ?? '—'}</dd>
          </React.Fragment>
        ))}
      </dl>
    </section>
  ));
}

export default function ProposalPrint() {
  const { id } = useParams();
  const { data, error, loading } = useApi(() => get(`/proposals/${id}`), [id]);
  const [showOriginal, setShowOriginal] = useState(false);
  const [layout, setLayout] = useState('auto');
  const [copyMsg, setCopyMsg] = useState('');

  useEffect(() => { document.title = `提案書 #${id}`; }, [id]);

  if (loading && !data) return <Loading />;
  if (!data) return <div className="pp-wrap"><ErrorText error={error || '提案書が見つかりません'} /></div>;

  const c = data.content || {};
  const useOrig = showOriginal && c.original;
  const labels = (useOrig ? c.original.labels : c.labels) || {};
  const items = (useOrig ? c.original.items : c.items) || [];
  const keys = Object.keys(labels);
  const asCards = layout === 'cards' || (layout === 'auto' && items.length >= CARD_THRESHOLD);
  const header = c.header || {};

  const copy = async () => {
    const ok = await copyText(c.lineText || '');
    setCopyMsg(ok ? 'コピーしました' : 'コピーできませんでした。ブラウザの設定を確認してください');
    setTimeout(() => setCopyMsg(''), 3000);
  };

  return (
    <div className="pp-wrap">
      <style>{PRINT_CSS}</style>

      <div className="pp-toolbar no-print">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>印刷 / PDF保存</button>
        <button type="button" className="btn btn-outline" onClick={copy} disabled={!c.lineText}>LINE等用テキストをコピー</button>
        {copyMsg && <span className="muted" role="status">{copyMsg}</span>}
        <label className="muted" htmlFor="pp-layout" style={{ marginLeft: 8 }}>表示形式</label>
        <select id="pp-layout" className="form-select" style={{ width: 'auto' }} value={layout} onChange={e => setLayout(e.target.value)}>
          <option value="auto">自動（3件以上はカード）</option>
          <option value="table">横比較表</option>
          <option value="cards">縦カード</option>
        </select>
        {c.original && (
          <label className="checkbox" style={{ marginBottom: 0 }}>
            <input type="checkbox" checked={showOriginal} onChange={e => setShowOriginal(e.target.checked)} />日本語原文を表示
          </label>
        )}
        <span className="muted">
          言語：{LANG_LABEL[c.language] || c.language || '日本語'}　作成者：{data.operator || '—'}　作成：{data.created_at || '—'}
        </span>
      </div>

      {c.warnings?.length > 0 && (
        <div className="warn-box no-print" style={{ marginBottom: 12 }}>
          {c.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}
      {data.override_reason && (
        <div className="danger-box no-print">転職勧奨禁止期間中の作成理由：{data.override_reason}</div>
      )}

      <header className="pp-head">
        <div>
          <div className="pp-title">求人のご紹介（比較表）</div>
          <div style={{ fontSize: 11 }}>ご提案する求人：{items.length}件</div>
        </div>
        <div className="pp-meta">
          <div style={{ fontWeight: 700, fontSize: 13 }}>{header.company || ''}</div>
          {header.license_no && <div>有料職業紹介事業 許可番号 {header.license_no}</div>}
          {header.contact && <div>お問い合わせ・苦情 {header.contact}</div>}
          <div>作成日 {header.date || (data.created_at || '').slice(0, 10)}</div>
        </div>
      </header>

      {items.length === 0 ? <div className="muted">求人がありません。</div>
        : asCards ? <ItemCards labels={labels} items={items} keys={keys} />
          : <CompareTable labels={labels} items={items} keys={keys} />}

      {(useOrig ? '正式な労働条件は求人票・労働条件通知書で確認してください。' : c.note) && (
        <div className="pp-note">{useOrig ? '正式な労働条件は求人票・労働条件通知書で確認してください。' : c.note}</div>
      )}
    </div>
  );
}
