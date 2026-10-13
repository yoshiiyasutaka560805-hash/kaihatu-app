import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../api/client';
import { useApi } from '../hooks/useApi';
import { Badge, Card, ErrorText, Loading, PageHeader, yen } from '../components/ui';
import { todayJst } from './PostingDetail';

// 請求・入金・返戻の状態
export function billingBadges(p, today = todayJst()) {
  const out = [];
  if (p.fee_amount != null && !p.invoice_date) out.push(['未請求', 'orange']);
  if (p.invoice_date && !p.paid_date) {
    if (p.due_date && p.due_date < today) out.push(['期日超過', 'red']);
    else out.push(['入金待ち', 'yellow']);
  }
  if (p.paid_date) out.push(['入金済', 'green']);
  if (p.fee_amount == null && !p.invoice_date) out.push(['手数料未計算', 'gray']);
  if (Number(p.refund_amount) > 0 && !p.refund_date) out.push(['返戻未処理', 'red']);
  return out;
}

const FILTERS = [['', 'すべて'], ['unbilled', '未請求'], ['waiting', '入金待ち'], ['overdue', '期日超過'], ['separated', '離職あり']];

export default function Placements() {
  const list = useApi(() => get('/placements'), []);
  const [filter, setFilter] = useState('');
  const today = todayJst();
  const rows = useMemo(() => (list.data || []).filter(p => {
    const b = billingBadges(p, today).map(([l]) => l);
    if (filter === 'unbilled') return b.includes('未請求');
    if (filter === 'waiting') return b.includes('入金待ち') || b.includes('期日超過');
    if (filter === 'overdue') return b.includes('期日超過');
    if (filter === 'separated') return !!p.separation_date;
    return true;
  }), [list.data, filter, today]);
  const count = key => (list.data || []).filter(p => billingBadges(p, today).some(([l]) => l === key)).length;

  return (
    <>
      <PageHeader title="成約・請求" subtitle="入職（成約）ごとに手数料の請求・入金、離職時の返戻金、定着フォローを管理します。成約登録は求職者のマッチング結果から行います" />
      <Card>
        <div className="tabs" role="tablist">
          {FILTERS.map(([v, l]) => (
            <button type="button" role="tab" aria-selected={filter === v} key={v} className={filter === v ? 'active' : ''} onClick={() => setFilter(v)}>
              {l}{v === 'unbilled' && list.data ? `（${count('未請求')}）` : v === 'overdue' && list.data ? `（${count('期日超過')}）` : ''}
            </button>
          ))}
        </div>
        <ErrorText error={list.error} />
        {list.loading && !list.data ? <Loading /> : list.data && !rows.length ? <div className="muted">該当する成約はありません。</div> : list.data && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr>
                <th>入職日</th><th>求職者</th><th>事業所・職種</th><th>無期/有期</th><th>手数料</th>
                <th>請求日</th><th>入金日</th><th>離職日</th><th>返戻金</th><th>状態</th>
              </tr></thead>
              <tbody>
                {rows.map(p => (
                  <tr key={p.id}>
                    <td><Link to={`/placements/${p.id}`}>{p.hire_date}</Link></td>
                    <td>{p.seeker_name}</td>
                    <td>{p.company_name}<div className="muted">{p.job_title}</div></td>
                    <td>{p.employment_term}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{yen(p.fee_amount)}</td>
                    <td>{p.invoice_date || '—'}{p.due_date && !p.paid_date && <div className="muted">期日 {p.due_date}</div>}</td>
                    <td>{p.paid_date || '—'}</td>
                    <td>{p.separation_date || (Number(p.separation_unknown) ? <span className="muted">在職不明</span> : '—')}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.refund_amount != null ? yen(p.refund_amount) : '—'}{p.refund_date && <div className="muted">返戻 {p.refund_date}</div>}</td>
                    <td>{billingBadges(p, today).map(([l, c]) => <React.Fragment key={l}><Badge color={c}>{l}</Badge>{' '}</React.Fragment>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
