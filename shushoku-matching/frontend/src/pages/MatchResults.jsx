import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

const INTRO = ['未提案', '提案済', '応募', '面接', '内定', '不採用', '辞退'];
const WAGE = { monthly: '月給', hourly: '時給', daily: '日給' };
const yen = v => (v == null ? '?' : Number(v).toLocaleString());

function MatchCard({ m, onStatus }) {
  const b = m.breakdown;
  const cls = m.score >= 75 ? 'high' : m.score >= 55 ? 'mid' : 'low';
  return (
    <div className="match-card">
      <div className="row">
        <div className={`score ${cls}`}>{m.score}</div>
        <div>
          <div><b>{m.company_name}</b>　{m.job_title}</div>
          <div className="muted">
            求人番号 {m.posting_no}｜{m.prefecture}{m.city}｜{m.employment_type}｜
            {WAGE[m.wage_type] || m.wage_type} {yen(m.wage_min)}〜{yen(m.wage_max)}円｜
            {m.shift_work ? '交替制あり' : `${m.work_start || '?'}〜${m.work_end || '?'}`}｜
            年間休日 {m.annual_holidays ?? '?'}｜紹介期限 {m.expiry_date || '?'}
            {!m.is_active && <span className="badge red">無効</span>}
          </div>
        </div>
        <span className="spacer" />
        <select className="form-select" style={{ width: 110 }} value={m.intro_status}
          onChange={e => onStatus(m.id, e.target.value)}>
          {INTRO.map(s => <option key={s}>{s}</option>)}
        </select>
        {m.source_url && <a className="btn btn-sm btn-outline" href={m.source_url} target="_blank" rel="noreferrer">求人票</a>}
      </div>

      <div className="row muted" style={{ marginTop: 6 }}>
        {b.items.map(i => (
          <span key={i.label} title={i.note}>
            {i.label} <span className="bar"><i style={{ width: `${(i.points / i.max) * 100}%` }} /></span> {i.points}/{i.max}
          </span>
        ))}
      </div>

      {b.warnings.length > 0 && (
        <div className="warn-box">{b.warnings.map(w => <div key={w}>⚠ {w}</div>)}</div>
      )}

      {m.ai_comment && (
        <div className="ai-box">
          <div><b>AI補足：</b>{m.ai_comment.fit_summary}</div>
          {m.ai_comment.strengths.length > 0 && <><b>強み</b><ul>{m.ai_comment.strengths.map(s => <li key={s}>{s}</li>)}</ul></>}
          {m.ai_comment.concerns.length > 0 && <><b>懸念点</b><ul>{m.ai_comment.concerns.map(s => <li key={s}>{s}</li>)}</ul></>}
          {m.ai_comment.questions_to_confirm.length > 0 && <><b>確認事項</b><ul>{m.ai_comment.questions_to_confirm.map(s => <li key={s}>{s}</li>)}</ul></>}
          <div className="muted">※AIによる参考情報です。事実確認のうえ担当者が判断してください。</div>
        </div>
      )}
    </div>
  );
}

export default function MatchResults() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [seeker, setSeeker] = useState(null);
  const [matches, setMatches] = useState(null);
  const [summary, setSummary] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const autoRan = useRef(false);

  const load = useCallback(() => api.getMatches(id).then(setMatches).catch(e => setError(e.message)), [id]);

  const run = useCallback(async withAi => {
    setRunning(true); setError('');
    try { setSummary(await api.runMatching(Number(id), withAi)); await load(); }
    catch (e) { setError(e.message); } finally { setRunning(false); }
  }, [id, load]);

  useEffect(() => {
    api.getSeeker(id).then(setSeeker).catch(e => setError(e.message));
    if (params.get('run') && !autoRan.current) {
      autoRan.current = true;
      setParams({}, { replace: true });
      run(true);
    } else load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onStatus(matchId, s) {
    await api.setIntroStatus(matchId, s);
    load();
  }

  return (
    <>
      <div className="page-header row">
        <div>
          <h1 className="page-title">マッチング結果：{seeker?.name}</h1>
          <p className="page-subtitle">必須条件で足切り後、職種30・賃金25・勤務地15・雇用形態10・休日10・経験資格10 の100点満点</p>
        </div>
        <span className="spacer" />
        <Link className="btn btn-outline" to={`/seekers/${id}`}>条件を編集</Link>
        <button className="btn btn-outline" disabled={running} onClick={() => run(false)}>ルール判定のみ</button>
        <button className="btn btn-primary" disabled={running} onClick={() => run(true)}>{running ? '判定中…' : '判定＋AI補足'}</button>
      </div>

      {summary && (
        <div className="alert-banner blue">
          有効求人 {summary.total}件 → 条件外 {summary.excluded}件を除外、候補 {summary.candidates}件｜{summary.aiStatus}
        </div>
      )}
      {error && <div className="error">{error}</div>}

      {!matches ? <div className="loading">読み込み中…</div>
        : matches.length === 0 ? <div className="card muted">候補はありません。「判定」を実行するか、求人DBを更新してください。</div>
        : matches.map(m => <MatchCard key={m.id} m={m} onStatus={onStatus} />)}
    </>
  );
}
