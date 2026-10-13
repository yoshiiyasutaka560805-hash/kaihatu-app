import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post, put, getOperator } from '../api/client';
import { useApi, useAction } from '../hooks/useApi';
import { PageHeader, Card, ErrorText, Loading, Badge } from '../components/ui';

// 苦情受付簿：職業紹介責任者が苦情処理を行い、その記録を保存する

const FROM_TYPES = ['求職者', '求人者', 'その他'];
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const emptyForm = () => ({ received_date: today(), from_type: '', from_name: '', seeker_id: '', employer_id: '', content: '' });

function EditRow({ c, onSaved, onCancel }) {
  const [f, setF] = useState({
    response: c.response || '',
    responder: c.responder || getOperator() || '',
    completed_date: c.completed_date || '',
  });
  const [run, busy, error] = useAction();
  const save = async () => {
    try {
      await run(() => put(`/complaints/${c.id}`, { response: f.response, responder: f.responder, completed_date: f.completed_date || null }));
      onSaved();
    } catch { /* useAction がエラーを保持 */ }
  };
  const id = `cmp-${c.id}`;
  return (
    <tr>
      <td colSpan={10} style={{ background: 'var(--gray50)' }}>
        <div className="grid2">
          <div className="form-group wide">
            <label className="form-label" htmlFor={`${id}-res`}>対応内容</label>
            <textarea id={`${id}-res`} className="form-textarea" rows={4} maxLength={3000} value={f.response} onChange={e => setF(x => ({ ...x, response: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${id}-who`}>対応者</label>
            <input id={`${id}-who`} className="form-input" maxLength={30} value={f.responder} onChange={e => setF(x => ({ ...x, responder: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${id}-done`}>完了日（入力すると「完了」）</label>
            <div className="row">
              <input id={`${id}-done`} type="date" className="form-input" style={{ flex: 1 }} value={f.completed_date} onChange={e => setF(x => ({ ...x, completed_date: e.target.value }))} />
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setF(x => ({ ...x, completed_date: today() }))}>今日</button>
            </div>
          </div>
        </div>
        <ErrorText error={error} />
        <div className="row">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={onCancel}>キャンセル</button>
        </div>
      </td>
    </tr>
  );
}

export default function Complaints() {
  const list = useApi(() => get('/complaints'), []);
  const seekers = useApi(() => get('/seekers'), []);
  const employers = useApi(() => get('/employers'), []);
  const [form, setForm] = useState(emptyForm());
  const [run, busy, error, setError] = useAction();
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const rows = useMemo(() => {
    const all = list.data || [];
    if (filter === 'open') return all.filter(c => !c.completed_date);
    if (filter === 'done') return all.filter(c => c.completed_date);
    return all;
  }, [list.data, filter]);
  const openCount = (list.data || []).filter(c => !c.completed_date).length;

  const submit = async () => {
    setMsg('');
    if (!form.from_type) { setError('申出者区分を選択してください'); return; }
    if (!form.content.trim()) { setError('内容を入力してください'); return; }
    const body = {
      received_date: form.received_date || today(), from_type: form.from_type, from_name: form.from_name,
      seeker_id: form.seeker_id ? Number(form.seeker_id) : null, employer_id: form.employer_id ? Number(form.employer_id) : null,
      content: form.content,
    };
    try {
      await run(() => post('/complaints', body));
      setForm(emptyForm());
      setMsg('苦情を登録しました');
      list.reload();
    } catch { /* useAction がエラーを保持 */ }
  };

  return (
    <div>
      <PageHeader title="苦情受付簿" subtitle="求職者・求人者等からの苦情の受付と処理の記録" />
      <div className="alert-banner blue">
        職業紹介責任者が苦情処理を行い、その内容と対応を記録・保存します。受付後は速やかに対応し、対応内容・対応者・完了日を記入してください。
      </div>

      <Card title={`一覧（対応中 ${openCount}件）`} actions={
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          {[['all', 'すべて'], ['open', '対応中'], ['done', '完了']].map(([k, l]) => (
            <button key={k} type="button" className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      }>
        <ErrorText error={list.error} />
        {list.loading && !list.data && <Loading />}
        {list.data && rows.length === 0 && <div className="muted">記録はありません</div>}
        {rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>受付日</th><th>区分</th><th>申出者</th><th>関連</th><th>内容</th><th>対応</th><th>対応者</th><th>完了日</th><th>状態</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map(c => (
                  <React.Fragment key={c.id}>
                    <tr>
                      <td style={{ whiteSpace: 'nowrap' }}>{c.received_date}</td>
                      <td>{c.from_type}</td>
                      <td>{c.from_name || '—'}</td>
                      <td>
                        {c.seeker_id && <div><Link to={`/seekers/${c.seeker_id}`}>{c.seeker_name || `求職者#${c.seeker_id}`}</Link></div>}
                        {c.employer_id && <div><Link to={`/employers/${c.employer_id}`}>{c.employer_name || `事業所#${c.employer_id}`}</Link></div>}
                        {!c.seeker_id && !c.employer_id && '—'}
                      </td>
                      <td style={{ whiteSpace: 'pre-wrap', minWidth: 200 }}>{c.content}</td>
                      <td style={{ whiteSpace: 'pre-wrap', minWidth: 160 }}>{c.response || <span className="muted">未記入</span>}</td>
                      <td>{c.responder || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{c.completed_date || '—'}</td>
                      <td><Badge color={c.completed_date ? 'green' : 'orange'}>{c.completed_date ? '完了' : '対応中'}</Badge></td>
                      <td>
                        {editing !== c.id && (
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(c.id)}>対応を記入</button>
                        )}
                      </td>
                    </tr>
                    {editing === c.id && (
                      <EditRow c={c} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="新規受付">
        <div className="grid2">
          <div className="form-group">
            <label className="form-label" htmlFor="c-date">受付日</label>
            <input id="c-date" type="date" className="form-input" value={form.received_date} onChange={e => set('received_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="c-type">申出者区分<span className="req"> *</span></label>
            <select id="c-type" className="form-select" value={form.from_type} onChange={e => set('from_type', e.target.value)}>
              <option value="">（選択してください）</option>
              {FROM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="c-name">申出者名</label>
            <input id="c-name" className="form-input" maxLength={50} value={form.from_name} onChange={e => set('from_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="c-seeker">関連する求職者（任意）</label>
            <select id="c-seeker" className="form-select" value={form.seeker_id} onChange={e => set('seeker_id', e.target.value)}>
              <option value="">（なし）</option>
              {(seekers.data || []).map(s => <option key={s.id} value={s.id}>{s.name}{s.name_kana ? `（${s.name_kana}）` : ''}</option>)}
            </select>
            <ErrorText error={seekers.error} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="c-employer">関連する事業所（任意）</label>
            <select id="c-employer" className="form-select" value={form.employer_id} onChange={e => set('employer_id', e.target.value)}>
              <option value="">（なし）</option>
              {(employers.data || []).map(e => <option key={e.id} value={e.id}>{e.name}{e.city ? `（${e.city}）` : ''}</option>)}
            </select>
            <ErrorText error={employers.error} />
          </div>
          <div className="form-group wide">
            <label className="form-label" htmlFor="c-content">内容<span className="req"> *</span></label>
            <textarea id="c-content" className="form-textarea" rows={4} maxLength={3000} value={form.content} onChange={e => set('content', e.target.value)} />
          </div>
        </div>
        <ErrorText error={error} />
        {msg && <div className="ok-box">{msg}</div>}
        <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? '登録中…' : '登録'}</button>
      </Card>
    </div>
  );
}
