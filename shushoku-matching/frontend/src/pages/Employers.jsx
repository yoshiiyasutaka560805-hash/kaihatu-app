import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../api/client';
import { useApi } from '../hooks/useApi';
import { Card, ErrorText, Loading, PageHeader } from '../components/ui';

export default function Employers() {
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState('');
  const qId = useId();
  const list = useApi(() => get('/employers', { q: applied }), [applied]);

  return (
    <>
      <PageHeader title="事業所" subtitle="求人申込みを受理する求人者（事業所）と、手数料・返戻金の契約条件を管理します">
        <Link className="btn btn-primary" to="/employers/new">＋ 事業所を登録</Link>
      </PageHeader>
      <Card>
        <form className="row" style={{ marginBottom: 12 }} onSubmit={e => { e.preventDefault(); setApplied(q.trim()); }}>
          <label htmlFor={qId} className="form-label" style={{ margin: 0 }}>検索</label>
          <input id={qId} className="form-input" style={{ maxWidth: 280 }} value={q} onChange={e => setQ(e.target.value)} placeholder="事業所名・市区町村" />
          <button type="submit" className="btn btn-primary btn-sm">検索</button>
          <span className="spacer" />
          {list.data && <span className="muted">{list.data.length}件</span>}
        </form>
        <ErrorText error={list.error} />
        {list.loading && !list.data ? <Loading /> : list.data && !list.data.length ? <div className="muted">事業所はまだ登録されていません。</div> : list.data && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>事業所名</th><th>所在地</th><th>担当者</th><th>契約締結日</th><th>手数料率</th><th>有効求人数</th><th>成約数</th></tr></thead>
              <tbody>
                {list.data.map(e => (
                  <tr key={e.id}>
                    <td><Link to={`/employers/${e.id}`}>{e.name}</Link></td>
                    <td>{[e.prefecture, e.city, e.address].filter(Boolean).join(' ') || '—'}</td>
                    <td>{e.contact_person ? `${e.contact_person}${e.contact_title ? `（${e.contact_title}）` : ''}` : '—'}</td>
                    <td>{e.contract_date || <span className="muted">未締結</span>}</td>
                    <td>{e.fee_rate_percent == null || e.fee_rate_percent === '' ? <span className="muted">設定画面の値</span> : `${e.fee_rate_percent}%`}</td>
                    <td>{e.active_postings ?? 0}</td>
                    <td>{e.placements ?? 0}</td>
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
