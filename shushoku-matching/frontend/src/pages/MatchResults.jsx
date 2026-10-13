import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { get, post, put } from '../api/client';
import { useApi, useAction, useMeta } from '../hooks/useApi';
import { PageHeader, Card, Badge, ErrorText, Loading, yen, WAGE_LABEL, LANG_LABEL } from '../components/ui';

const DEFAULT_INTRO = ['未提案', '提案済', '応募', '面接', '内定', '入職', '不採用', '辞退'];
const DECLINE_STATUSES = ['不採用', '辞退'];
const scoreClass = s => (s >= 75 ? 'high' : s >= 55 ? 'mid' : 'low');
const toLocalInput = v => (v ? String(v).replace(' ', 'T').slice(0, 16) : '');
const fromLocalInput = v => (v ? v.replace('T', ' ') : '');

function GuardBox({ guard }) {
  if (!guard) return null;
  return (
    <div className="danger-box" role="alert">
      <strong>転職勧奨禁止期間中</strong>：{guard.hire_date} に自社紹介で {guard.company} に無期雇用で就職しています。
      {guard.until} までは転職を勧奨してはいけません。本人から求職の申込みがあった場合のみ、その旨を記録して対応してください。
    </div>
  );
}

// ── 成約登録フォーム ──
function PlacementForm({ m, onDone, onCancel }) {
  const navigate = useNavigate();
  const [f, setF] = useState({ hire_date: '', employment_term: m.employment_term || '', monthly_wage: '' });
  const [run, busy, error, setError] = useAction();
  const [feeWarnings, setFeeWarnings] = useState(null);
  const ids = { hire: useId(), wage: useId(), term: useId() };

  const submit = async () => {
    if (!f.hire_date) { setError('入職日を入力してください'); return; }
    if (!f.employment_term) { setError('無期／有期を選択してください'); return; }
    try {
      const r = await run(() => post('/placements', { match_id: m.id, hire_date: f.hire_date, employment_term: f.employment_term, monthly_wage: f.monthly_wage }));
      if (r?.feeWarnings?.length) setFeeWarnings({ id: r.id, items: r.feeWarnings });
      else navigate(`/placements/${r.id}`);
    } catch { /* error */ }
  };

  if (feeWarnings) {
    return (
      <div className="ok-box">
        成約を登録しました。
        <div className="warn-box">{feeWarnings.items.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/placements/${feeWarnings.id}`)}>成約詳細へ</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={onDone}>閉じる</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ok-box">
      <strong>成約登録（入職）</strong>
      <div className="grid2" style={{ marginTop: 8 }}>
        <div className="form-group">
          <label className="form-label" htmlFor={ids.hire}>入職日<span className="req"> *</span></label>
          <input id={ids.hire} className="form-input" type="date" value={f.hire_date} onChange={e => setF({ ...f, hire_date: e.target.value })} />
        </div>
        <div className="form-group">
          <div className="form-label" id={ids.term}>雇用期間<span className="req"> *</span></div>
          <div className="row" role="radiogroup" aria-labelledby={ids.term}>
            {['無期', '有期'].map(t => (
              <label key={t} className="checkbox" style={{ marginBottom: 0 }}>
                <input type="radio" name={`term-${m.id}`} value={t} checked={f.employment_term === t} onChange={() => setF({ ...f, employment_term: t })} />{t}
              </label>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={ids.wage}>算定基礎の月額賃金（任意）</label>
          <input id={ids.wage} className="form-input" value={f.monthly_wage} placeholder="空欄なら求人の下限から算出" onChange={e => setF({ ...f, monthly_wage: e.target.value })} />
        </div>
      </div>
      <ErrorText error={error} />
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>{busy ? '登録中…' : '成約を登録'}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} disabled={busy}>キャンセル</button>
        <span className="muted">登録すると候補は「入職」、求職者は「就職」になります。</span>
      </div>
    </div>
  );
}

// ── 候補カード ──
function MatchCard({ m, seekerId, introOptions, declineReasons, selected, onToggle, isNew, onChanged }) {
  const init = () => ({
    intro_status: m.intro_status, decline_reason: m.decline_reason || '', interview_at: toLocalInput(m.interview_at),
    interview_place: m.interview_place || '', interview_result: m.interview_result || '', note: m.note || '',
  });
  const sig = JSON.stringify([m.intro_status, m.decline_reason, m.interview_at, m.interview_place, m.interview_result, m.note]);
  const [sf, setSf] = useState(init);
  useEffect(() => { setSf(init()); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const [saveRun, saving, saveError, setSaveError] = useAction();
  const [saved, setSaved] = useState('');

  const [commute, setCommute] = useState(m.commute_minutes ?? '');
  useEffect(() => { setCommute(m.commute_minutes ?? ''); }, [m.commute_minutes]);
  const [cRun, cBusy, cError] = useAction();
  const [cMsg, setCMsg] = useState('');

  const [events, setEvents] = useState(null);
  const [showEvents, setShowEvents] = useState(false);
  const [evRun, evBusy, evError] = useAction();
  const [placing, setPlacing] = useState(false);

  const b = m.breakdown || {};
  const est = b.estimates || {};
  const ai = m.ai_comment;
  const isHw = m.origin === 'hw';
  const placed = m.intro_status === '入職' || !!m.placement_id;
  const dirty = JSON.stringify(sf) !== JSON.stringify(init());
  const needReason = DECLINE_STATUSES.includes(sf.intro_status);
  const uid = useId();

  const loadEvents = async () => { try { setEvents(await evRun(() => get(`/matches/${m.id}/events`))); } catch { /* evError */ } };
  const toggleEvents = () => { const next = !showEvents; setShowEvents(next); if (next) loadEvents(); };

  const saveStatus = async () => {
    setSaved('');
    if (needReason && !sf.decline_reason) { setSaveError(`${sf.intro_status}の理由を選択してください`); return; }
    try {
      await saveRun(() => put(`/matches/${m.id}`, { ...sf, decline_reason: needReason ? sf.decline_reason : '', interview_at: fromLocalInput(sf.interview_at) }));
      setSaved('保存しました');
      if (showEvents) loadEvents();
      onChanged();
    } catch { /* saveError */ }
  };

  const saveCommute = async () => {
    setCMsg('');
    try {
      await cRun(() => put('/commute', { seeker_id: Number(seekerId), posting_id: m.posting_id, minutes: commute === '' ? null : commute }));
      setCMsg(commute === '' ? '通勤時間を消去しました' : '保存しました（スコアは再判定で反映）');
      onChanged();
    } catch { /* cError */ }
  };

  const wage = `${WAGE_LABEL[m.wage_type] || ''} ${yen(m.wage_min)}〜${yen(m.wage_max)}`;
  const nights = m.shift_work || m.nights_per_month ? `夜勤あり（月${m.nights_per_month ?? '?'}回）` : '夜勤なし';
  const hours = m.shift_work ? '交替制' : `${m.work_start || '?'}〜${m.work_end || '?'}`;

  return (
    <div className="match-card">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <input type="checkbox" id={`${uid}-sel`} checked={selected} onChange={onToggle} style={{ marginTop: 8 }}
          aria-label={`${m.company_name} ${m.job_title} を提案書に含める`} />
        <div className={`score ${scoreClass(m.score)}`} aria-label={`スコア${m.score}点`}>{m.score}<span style={{ fontSize: 11 }}>点</span></div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="row">
            <strong style={{ fontSize: 15 }}>{m.company_name}</strong>
            <span>{m.job_title}</span>
            {m.facility_type && <Badge color="blue">{m.facility_type}</Badge>}
            {isNew && <Badge color="orange">新着</Badge>}
            <Badge>{m.intro_status}</Badge>
            {!m.is_active && <Badge color="red">募集終了</Badge>}
          </div>
          <div className="row" style={{ marginTop: 4 }}>
            {isHw
              ? <Badge color="yellow">HW求人（紹介前に自社受理が必要）</Badge>
              : <Badge color="green">自社求人</Badge>}
            <Link to={`/postings/${m.posting_id}`} className="muted">求人 {m.posting_no}</Link>
            <span className="muted">
              完成度 {m.completeness ?? '—'}%
            </span>
            {m.completeness != null && m.completeness < 60 && <Badge color="gray">情報不足</Badge>}
          </div>
        </div>
      </div>

      <dl className="kv" style={{ marginTop: 10 }}>
        <dt>勤務地</dt><dd>{m.prefecture || ''}{m.city || '—'}</dd>
        <dt>雇用形態</dt><dd>{m.employment_type || '—'}{m.employment_term ? `（${m.employment_term}）` : ''}</dd>
        <dt>賃金</dt><dd>{wage}</dd>
        <dt>見込み月額</dt><dd>{est.monthlyMin != null ? `${yen(est.monthlyMin)}〜${est.monthlyMax != null && est.monthlyMax !== est.monthlyMin ? yen(est.monthlyMax) : ''}` : '—'}
          {est.desiredMonthly ? <span className="muted">（希望 月{yen(est.desiredMonthly)}）</span> : null}</dd>
        <dt>見込み年収</dt><dd>{est.annualMin != null ? `約${yen(est.annualMin)}〜` : '—'}</dd>
        <dt>勤務時間/夜勤</dt><dd>{hours}／{nights}</dd>
        <dt>年間休日</dt><dd>{m.annual_holidays != null ? `${m.annual_holidays}日` : '—'}</dd>
        <dt>紹介期限</dt><dd>{m.expiry_date || '—'}</dd>
        <dt><label htmlFor={`${uid}-commute`}>通勤時間</label></dt>
        <dd>
          <div className="row">
            <input id={`${uid}-commute`} className="form-input" type="number" min={0} max={600} style={{ width: 90 }} value={commute}
              onChange={e => setCommute(e.target.value)} />
            <span>分</span>
            {m.commute_source && <span className="muted">（{m.commute_source === 'manual' ? '手入力' : '自動計算'}）</span>}
            <button type="button" className="btn btn-outline btn-sm" onClick={saveCommute}
              disabled={cBusy || String(commute) === String(m.commute_minutes ?? '')}>保存</button>
            {cMsg && <span className="muted" role="status">{cMsg}</span>}
          </div>
          <ErrorText error={cError} />
        </dd>
      </dl>

      {b.items?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="muted">加点内訳</div>
          <table style={{ fontSize: 12, borderCollapse: 'collapse' }}>
            <tbody>
              {b.items.map(it => (
                <tr key={it.label}>
                  <td style={{ paddingRight: 8, whiteSpace: 'nowrap' }}>{it.label}</td>
                  <td style={{ paddingRight: 8 }}>
                    <span className="bar" role="img" aria-label={`${it.points}/${it.max}点`}>
                      <i style={{ width: `${it.max ? Math.round((it.points / it.max) * 100) : 0}%` }} />
                    </span>
                  </td>
                  <td style={{ paddingRight: 8, whiteSpace: 'nowrap' }}>{it.points}/{it.max}</td>
                  <td className="muted">{it.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {b.warnings?.length > 0 && (
        <div className="warn-box">{b.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>
      )}

      {ai && (
        <div className="ai-box">
          <div className="row"><strong>AI補足</strong><span className="muted">AIによる参考情報です。判断は担当者が行ってください。</span></div>
          {ai.fit_summary && <div style={{ marginTop: 4 }}>{ai.fit_summary}</div>}
          {ai.strengths?.length > 0 && <><div className="muted">強み</div><ul>{ai.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
          {ai.concerns?.length > 0 && <><div className="muted">懸念</div><ul>{ai.concerns.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
          {ai.questions_to_confirm?.length > 0 && <><div className="muted">確認事項</div><ul>{ai.questions_to_confirm.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
        </div>
      )}

      {/* 選考管理 */}
      <div style={{ borderTop: '1px solid var(--gray200)', marginTop: 10, paddingTop: 10 }}>
        <div className="row" style={{ marginBottom: 6 }}>
          <strong style={{ fontSize: 13 }}>選考管理</strong>
          {m.proposed_date && <span className="muted">提案 {m.proposed_date}</span>}
          {m.applied_date && <span className="muted">応募 {m.applied_date}</span>}
          {m.offer_date && <span className="muted">内定 {m.offer_date}</span>}
          <span className="spacer" />
          <button type="button" className="btn btn-outline btn-sm" onClick={toggleEvents} aria-expanded={showEvents}>{showEvents ? '履歴を閉じる' : '履歴を表示'}</button>
        </div>
        {placed ? (
          <div className="ok-box">入職済み{m.placement_id && <>　<Link to={`/placements/${m.placement_id}`}>成約詳細を開く</Link></>}</div>
        ) : (
          <>
            <div className="grid2">
              <div className="form-group">
                <label className="form-label" htmlFor={`${uid}-st`}>紹介状況</label>
                <select id={`${uid}-st`} className="form-select" value={sf.intro_status} onChange={e => setSf({ ...sf, intro_status: e.target.value })}>
                  {introOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {needReason && (
                <div className="form-group">
                  <label className="form-label" htmlFor={`${uid}-dr`}>{sf.intro_status}の理由<span className="req"> *</span></label>
                  <select id={`${uid}-dr`} className="form-select" value={sf.decline_reason} onChange={e => setSf({ ...sf, decline_reason: e.target.value })}>
                    <option value="">（選択してください）</option>
                    {declineReasons.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor={`${uid}-ia`}>面接日時</label>
                <input id={`${uid}-ia`} className="form-input" type="datetime-local" value={sf.interview_at} onChange={e => setSf({ ...sf, interview_at: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={`${uid}-ip`}>面接場所</label>
                <input id={`${uid}-ip`} className="form-input" value={sf.interview_place} onChange={e => setSf({ ...sf, interview_place: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={`${uid}-ir`}>面接結果</label>
                <input id={`${uid}-ir`} className="form-input" value={sf.interview_result} onChange={e => setSf({ ...sf, interview_result: e.target.value })} />
              </div>
              <div className="form-group wide">
                <label className="form-label" htmlFor={`${uid}-nt`}>メモ</label>
                <textarea id={`${uid}-nt`} className="form-textarea" rows={2} value={sf.note} onChange={e => setSf({ ...sf, note: e.target.value })} />
              </div>
            </div>
            <ErrorText error={saveError} />
            <div className="row">
              <button type="button" className="btn btn-primary btn-sm" onClick={saveStatus} disabled={saving || !dirty}>{saving ? '保存中…' : '選考状況を保存'}</button>
              {dirty && <button type="button" className="btn btn-outline btn-sm" onClick={() => { setSf(init()); setSaveError(''); }} disabled={saving}>元に戻す</button>}
              {saved && !dirty && <span className="muted" role="status">{saved}</span>}
              <span className="spacer" />
              {m.intro_status === '内定' && !placing && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setPlacing(true)} disabled={isHw}
                  title={isHw ? 'ハローワーク求人のままでは成約登録できません' : undefined}>成約登録</button>
              )}
            </div>
            {m.intro_status === '内定' && isHw && (
              <div className="muted" style={{ marginTop: 4 }}>
                ハローワーク求人のままでは成約登録できません。求人者から求人申込みを受理し「自社求人化」してから登録してください（<Link to={`/postings/${m.posting_id}`}>求人を開く</Link>）。
              </div>
            )}
            {placing && !isHw && <PlacementForm m={m} onDone={onChanged} onCancel={() => setPlacing(false)} />}
          </>
        )}
        {showEvents && (
          <div style={{ marginTop: 8 }}>
            <ErrorText error={evError} />
            {evBusy && !events ? <Loading /> : events && (events.length === 0 ? <div className="muted">履歴はありません。</div> : (
              <table className="table">
                <thead><tr><th scope="col">日時</th><th scope="col">遷移</th><th scope="col">メモ</th><th scope="col">操作者</th></tr></thead>
                <tbody>
                  {events.map(e => (
                    <tr key={e.id}><td>{e.at}</td><td>{e.from_status || '—'} → {e.to_status}</td><td>{e.note || ''}</td><td>{e.operator || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 提案書作成パネル ──
function ProposalPanel({ seekerId, seeker, selectedIds, guard, onGuard, onCreated }) {
  const meta = useMeta();
  const [language, setLanguage] = useState(seeker?.preferred_language || 'ja');
  useEffect(() => { if (seeker?.preferred_language) setLanguage(seeker.preferred_language); }, [seeker?.preferred_language]);
  const [markProposed, setMarkProposed] = useState(true);
  const [reason, setReason] = useState('');
  const [run, busy, error, setError] = useAction();
  const [created, setCreated] = useState(null);
  const ids = { lang: useId(), reason: useId(), mark: useId() };
  const languages = meta?.languages || Object.keys(LANG_LABEL);

  const create = async () => {
    setCreated(null);
    if (!selectedIds.length) { setError('提案する求人を選んでください'); return; }
    if (selectedIds.length > 10) { setError('提案書に含められるのは10件までです'); return; }
    if (guard && !reason.trim()) { setError('転職勧奨禁止期間中のため、本人からの求職申込みである旨などの理由を入力してください'); return; }
    // ポップアップブロック回避のため、クリック直後に空タブを開いておく
    const w = window.open('', '_blank');
    try {
      const r = await run(() => post('/proposals', {
        seeker_id: Number(seekerId), match_ids: selectedIds, language, mark_proposed: markProposed, override_reason: guard ? reason.trim() : undefined,
      }));
      const url = `/proposals/${r.id}`;
      if (w) w.location.href = url; else window.open(url, '_blank');
      setCreated({ id: r.id, warnings: r.warnings || [] });
      onCreated(markProposed);
    } catch (e) {
      if (w) w.close();
      if (e.status === 409 && e.body?.guard) onGuard(e.body.guard);
    }
  };

  return (
    <Card title={`提案書（選択 ${selectedIds.length}件）`}>
      <GuardBox guard={guard} />
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor={ids.lang}>言語</label>
          <select id={ids.lang} className="form-select" value={language} onChange={e => setLanguage(e.target.value)}>
            {languages.map(l => <option key={l} value={l}>{LANG_LABEL[l] || l}</option>)}
          </select>
        </div>
        <label className="checkbox" htmlFor={ids.mark} style={{ marginBottom: 8 }}>
          <input id={ids.mark} type="checkbox" checked={markProposed} onChange={e => setMarkProposed(e.target.checked)} />未提案の候補を「提案済」にする
        </label>
        <button type="button" className="btn btn-primary" onClick={create} disabled={busy || !selectedIds.length} style={{ marginBottom: 6 }}>
          {busy ? (language !== 'ja' ? '翻訳・作成中…' : '作成中…') : '選んだ求人で提案書を作成'}
        </button>
      </div>
      {guard && (
        <div className="form-group" style={{ marginTop: 10 }}>
          <label className="form-label" htmlFor={ids.reason}>作成理由（転職勧奨禁止期間中のため必須）<span className="req"> *</span></label>
          <input id={ids.reason} className="form-input" value={reason} onChange={e => setReason(e.target.value)}
            placeholder="例：2026-10-01 本人から来所し求職の申込みあり" />
        </div>
      )}
      <ErrorText error={error} />
      {created && (
        <div className="ok-box">
          提案書を作成しました。<a href={`/proposals/${created.id}`} target="_blank" rel="noreferrer">提案書を開く</a>
          {created.warnings.length > 0 && <div className="warn-box">{created.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>}
        </div>
      )}
      <div className="muted" style={{ marginTop: 6 }}>各候補カード左のチェックで選択（1〜10件）。翻訳には外部AIを使用します。</div>
    </Card>
  );
}

// ── 本体 ──
export default function MatchResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const meta = useMeta();
  const [searchParams, setSearchParams] = useSearchParams();
  const seeker = useApi(() => get(`/seekers/${id}`), [id]);
  const matches = useApi(() => get('/matches', { seekerId: id }), [id]);
  const near = useApi(() => get('/matches/near-misses', { seekerId: id }), [id]);
  const [runResult, setRunResult] = useState(null);
  const [judge, judging, judgeError] = useAction();
  const [estRun, estimating, estError] = useAction();
  const [estMsg, setEstMsg] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [newIds, setNewIds] = useState(() => new Set());
  const [proposalGuard, setProposalGuard] = useState(null);
  const autoRan = useRef(false);

  const runJudge = async withAi => {
    setEstMsg('');
    try {
      const r = await judge(() => post('/matches/run', { seekerId: Number(id), withAi }));
      setRunResult(r);
      matches.reload();
      near.reload();
    } catch { /* judgeError */ }
  };

  // ?run=1 で開いたら初回のみ自動判定（AIあり）し、クエリを消す
  useEffect(() => {
    if (searchParams.get('run') === '1' && !autoRan.current) {
      autoRan.current = true;
      setSearchParams({}, { replace: true });
      runJudge(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 新着を記録してから既読化（表示中は「新着」バッジを残す）
  useEffect(() => {
    const list = matches.data;
    if (!list) return;
    const fresh = list.filter(m => Number(m.is_new)).map(m => m.id);
    if (fresh.length) {
      setNewIds(prev => new Set([...prev, ...fresh]));
      post('/matches/seen', { seekerId: Number(id) }).catch(() => {});
    }
    // 消えた候補は選択から外す
    setSelected(prev => {
      const valid = new Set(list.map(m => m.id));
      const next = new Set([...prev].filter(x => valid.has(x)));
      return next.size === prev.size ? prev : next;
    });
  }, [matches.data, id]);

  const estimate = async () => {
    setEstMsg('');
    try {
      const r = await estRun(() => post('/commute/estimate', { seekerId: Number(id) }));
      setEstMsg(`${r?.results?.length || 0}件の通勤時間を更新しました（手入力済みの値は上書きしません。スコアへの反映は再判定が必要です）`);
      matches.reload();
    } catch { /* estError */ }
  };

  const toggle = mid => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(mid)) next.delete(mid); else next.add(mid);
    return next;
  });

  if (seeker.loading && !seeker.data) return <Loading />;
  if (!seeker.data) return <div><PageHeader title="マッチング結果" /><ErrorText error={seeker.error} /><Link to="/seekers">一覧へ戻る</Link></div>;

  const s = seeker.data;
  const list = matches.data || [];
  const guard = proposalGuard || runResult?.guard || s.guard;
  const introOptions = (meta?.introStatuses || DEFAULT_INTRO).filter(x => x !== '入職');
  const declineReasons = meta?.declineReasons || [];
  const nearList = runResult?.nearMisses || near.data || [];
  const lastJudged = list.reduce((a, m) => (m.judged_at && m.judged_at > a ? m.judged_at : a), '');
  const selectedIds = list.filter(m => selected.has(m.id)).map(m => m.id);

  return (
    <div>
      <PageHeader title={`${s.name} さんのマッチング結果`}
        subtitle={[s.city, s.desired_categories, s.desired_job_kinds].filter(Boolean).join(' / ') || undefined}>
        <button type="button" className="btn btn-outline" onClick={() => navigate(`/seekers/${id}`)}>条件を編集</button>
        <button type="button" className="btn btn-outline" onClick={() => runJudge(false)} disabled={judging}>ルール判定のみ</button>
        <button type="button" className="btn btn-primary" onClick={() => runJudge(true)} disabled={judging}>{judging ? '判定中…' : '判定＋AI補足'}</button>
      </PageHeader>

      <GuardBox guard={guard} />

      <Card title="判定結果" actions={
        <button type="button" className="btn btn-outline btn-sm" onClick={estimate} disabled={estimating || !list.length}>
          {estimating ? '計算中…' : '通勤時間を自動計算'}
        </button>
      }>
        <ErrorText error={judgeError} />
        {judging && <div className="muted" role="status">判定しています…（AI補足ありの場合は数十秒かかることがあります）</div>}
        {runResult ? (
          <div className="row" style={{ gap: 16 }}>
            <span>有効求人 <strong>{runResult.total}</strong>件 → 除外 <strong>{runResult.excluded}</strong>件</span>
            <span>候補 <strong>{runResult.candidates}</strong>件</span>
            <span>新着 <strong>{runResult.newCount}</strong>件</span>
            <Badge color={/エラー/.test(runResult.aiStatus) ? 'red' : /AI補足 \d/.test(runResult.aiStatus) ? 'green' : 'gray'}>{runResult.aiStatus}</Badge>
          </div>
        ) : (
          <div className="row" style={{ gap: 16 }}>
            <span>候補 <strong>{list.length}</strong>件</span>
            <span>新着 <strong>{newIds.size}</strong>件</span>
            {lastJudged && <span className="muted">最終判定 {lastJudged}</span>}
            {!list.length && !matches.loading && <span className="muted">まだ判定していないか、候補がありません。「判定＋AI補足」を実行してください。</span>}
          </div>
        )}
        <ErrorText error={estError} />
        {estMsg && <div className="muted" role="status">{estMsg}</div>}
        {!Number(s.ai_consent) && <div className="muted" style={{ marginTop: 6 }}>外部AI利用の同意がないため、AI補足は行われません。</div>}
      </Card>

      {list.length > 0 && (
        <ProposalPanel seekerId={id} seeker={s} selectedIds={selectedIds} guard={guard} onGuard={setProposalGuard}
          onCreated={marked => { if (marked) matches.reload(); }} />
      )}

      <Card title={`候補（${list.length}件）`} actions={
        list.length > 0 && (
          <div className="row">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(new Set(list.filter(m => m.intro_status === '未提案').slice(0, 10).map(m => m.id)))}>未提案の上位10件を選択</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(new Set())} disabled={!selected.size}>選択解除</button>
          </div>
        )
      }>
        <ErrorText error={matches.error} />
        {matches.loading && !matches.data ? <Loading /> : list.map(m => (
          <MatchCard key={m.id} m={m} seekerId={id} introOptions={introOptions} declineReasons={declineReasons}
            selected={selected.has(m.id)} onToggle={() => toggle(m.id)} isNew={newIds.has(m.id)}
            onChanged={() => { matches.reload(); seeker.reload(); }} />
        ))}
      </Card>

      <Card title="惜しい求人（条件が1つだけ合わない求人）">
        <ErrorText error={!runResult ? near.error : ''} />
        {near.loading && !near.data && !runResult ? <Loading /> : !nearList.length ? <div className="muted">該当はありません。</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr><th scope="col">事業所</th><th scope="col">職種</th><th scope="col">市区町村</th><th scope="col">点数</th><th scope="col">除外理由</th><th scope="col">こう変われば対象</th></tr>
              </thead>
              <tbody>
                {nearList.map(n => (
                  <tr key={n.posting_id}>
                    <td><Link to={`/postings/${n.posting_id}`}>{n.company_name}</Link></td>
                    <td>{n.job_title}</td>
                    <td>{n.city || '—'}</td>
                    <td>{n.score}</td>
                    <td>{n.reason}</td>
                    <td className="muted">{n.hint || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
