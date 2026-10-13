import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get } from '../api/client';
import { useApi, useMeta } from '../hooks/useApi';
import { PageHeader, Card, Badge, ErrorText, Loading } from '../components/ui';

// 今日（ローカル日付）から dateStr までの日数。dateStr が空なら null
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const t = Date.parse(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(t)) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((t - today) / 86400000);
}

function scoreClass(s) {
  if (s == null) return 'low';
  return s >= 75 ? 'high' : s >= 55 ? 'mid' : 'low';
}

function ResidenceCell({ s }) {
  if (!Number(s.is_foreign_national)) return <span className="muted">—</span>;
  const left = daysUntil(s.residence_expiry);
  const alert = left != null && left <= 90;
  return (
    <div>
      <div>{s.visa_status || <span className="muted">在留資格未入力</span>}</div>
      {s.residence_expiry && (
        <div style={alert ? { color: 'var(--red)', fontWeight: 600 } : undefined} className={alert ? '' : 'muted'}>
          期限 {s.residence_expiry}
          {alert && (left < 0 ? '（期限切れ）' : `（残り${left}日）`)}
        </div>
      )}
    </div>
  );
}

export default function SeekerList() {
  const meta = useMeta();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useApi(() => get('/seekers', { q, status }), [q, status]);

  const submit = e => { e.preventDefault(); setQ(input.trim()); };

  return (
    <div>
      <PageHeader title="求職者" subtitle="求職者の一覧と検索。氏名をクリックすると詳細・編集、「マッチング」で候補求人を確認できます。">
        <button type="button" className="btn btn-primary" onClick={() => navigate('/seekers/new')}>＋ 求職者を登録</button>
      </PageHeader>

      <Card>
        <form className="row" onSubmit={submit} role="search">
          <label htmlFor="seeker-q" className="muted">検索</label>
          <input id="seeker-q" className="form-input" style={{ maxWidth: 280 }} placeholder="氏名・カナ・市区町村"
            value={input} onChange={e => setInput(e.target.value)} />
          <button type="submit" className="btn btn-outline btn-sm">検索</button>
          {(q || input) && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setInput(''); setQ(''); }}>クリア</button>
          )}
          <label htmlFor="seeker-status" className="muted" style={{ marginLeft: 12 }}>ステータス</label>
          <select id="seeker-status" className="form-select" style={{ maxWidth: 160 }} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">すべて</option>
            {(meta?.seekerStatuses || []).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="spacer" />
          <button type="button" className="btn btn-outline btn-sm" onClick={reload} disabled={loading}>再読込</button>
        </form>
      </Card>

      <Card title={data ? `一覧（${data.length}名）` : '一覧'}>
        <ErrorText error={error} />
        {loading && !data ? <Loading /> : data && data.length === 0 ? (
          <div className="muted">該当する求職者はいません。</div>
        ) : data && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">氏名</th>
                  <th scope="col">ステータス</th>
                  <th scope="col">居住</th>
                  <th scope="col">希望職種</th>
                  <th scope="col">外国籍/在留資格</th>
                  <th scope="col">候補</th>
                  <th scope="col">最高点</th>
                  <th scope="col">更新日</th>
                  <th scope="col"><span className="muted">操作</span></th>
                </tr>
              </thead>
              <tbody>
                {data.map(s => {
                  const wish = [s.desired_categories, s.desired_job_kinds].filter(Boolean).join(' / ');
                  return (
                    <tr key={s.id}>
                      <td>
                        <Link to={`/seekers/${s.id}`}>{s.name}</Link>
                        {s.name_kana && <div className="muted">{s.name_kana}</div>}
                      </td>
                      <td><Badge>{s.status}</Badge></td>
                      <td>{s.city || <span className="muted">—</span>}</td>
                      <td style={{ maxWidth: 220 }}>{wish || <span className="muted">—</span>}</td>
                      <td><ResidenceCell s={s} /></td>
                      <td>
                        {s.match_count || 0}件
                        {s.new_count > 0 && <> <Badge color="orange">新着{s.new_count}</Badge></>}
                      </td>
                      <td>{s.top_score != null ? <span className={`score ${scoreClass(s.top_score)}`} style={{ fontSize: 15, minWidth: 0 }}>{s.top_score}</span> : <span className="muted">—</span>}</td>
                      <td className="muted">{(s.updated_at || '').slice(0, 10)}</td>
                      <td>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate(`/seekers/${s.id}/matches`)}>マッチング</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
