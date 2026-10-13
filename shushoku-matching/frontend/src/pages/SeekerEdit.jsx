import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { get, post, put, del } from '../api/client';
import { useApi, useAction, useMeta } from '../hooks/useApi';
import { PageHeader, Card, Check, Badge, ErrorText, Loading, Warnings, toForm, yen, WAGE_LABEL, LANG_LABEL } from '../components/ui';

// ── 項目定義（backend/models/specs.js の seeker と対応） ──
const LABELS = {
  name: '氏名', name_kana: 'フリガナ', birth_date: '生年月日', phone: '電話', email: 'メール', address: '住所',
  accepted_date: '求職受付日', validity_end: '求職の有効期間', consent_date: '個人情報取扱い同意日', ai_consent: '外部AI利用同意',
  preferred_language: '提案書の言語', status: 'ステータス', notes: 'メモ',
  prefecture: '都道府県', city: '居住市区町村', nearest_station: '最寄り駅', acceptable_cities: '通勤可能な市区町村',
  transport: '通勤手段', max_commute_minutes: '通勤上限（分）', desired_categories: '希望職種', desired_job_kinds: '希望職務',
  desired_facility_types: '希望施設種別', excluded_facility_types: '不可施設種別', desired_employment: '希望雇用形態',
  desired_wage_type: '賃金形態', desired_wage_min: '希望賃金', available_start: '勤務可能時間（開始）', available_end: '勤務可能時間（終了）',
  shift_ok: '夜勤・交替制可', night_max_per_month: '夜勤上限（回/月）', night_only: '夜勤専従希望', max_days_per_week: '週勤務日数上限',
  min_annual_holidays: '希望年間休日', available_from: '就業可能日', licenses: '保有資格', experience_years: '経験年数',
  experience_note: '経験概要', priorities: '希望の優先順位', weight_profile: '重み付け',
  is_foreign_national: '外国籍', visa_status: '在留資格', residence_expiry: '在留期限', work_restriction: '就労制限',
  extra_activity_permit: '資格外活動許可', residence_checked_date: '在留カード原本確認日', residence_checked_by: '在留カード確認者',
  jlpt_level: 'JLPT', care_japanese_test: '介護日本語評価試験合格', skill_test: '技能試験',
};
const FIELDS = Object.keys(LABELS);
const BOOL_FIELDS = ['ai_consent', 'shift_ok', 'night_only', 'is_foreign_national', 'extra_activity_permit', 'care_japanese_test'];
const WEIGHT_LABEL = { balanced: 'バランス', wage: '賃金重視', proximity: '近さ重視', holiday: '休日重視' };
const TRANSPORTS = ['徒歩', '自転車', '車', '公共交通'];
const JLPT = ['N1', 'N2', 'N3', 'N4', 'N5', 'なし'];
const NOTE_METHODS = ['来所', '電話', 'オンライン', '訪問', 'その他'];
// NOT NULL / 既定値のある選択項目（空にすると保存時にエラーになるため既定値で埋める）
const DEFAULTS = { status: '受付', preferred_language: 'ja', weight_profile: 'balanced', desired_wage_type: 'monthly', ai_consent: 0 };

function fmtVal(key, v) {
  if (v == null || v === '') return <span className="muted">（未設定）</span>;
  if (BOOL_FIELDS.includes(key)) return Number(v) || v === true ? 'はい' : 'いいえ';
  if (key === 'desired_wage_type') return WAGE_LABEL[v] || v;
  if (key === 'desired_wage_min') return /^\d+$/.test(String(v)) ? yen(v) : String(v);
  if (key === 'weight_profile') return WEIGHT_LABEL[v] || v;
  if (key === 'preferred_language') return LANG_LABEL[v] || v;
  if (key === 'night_max_per_month' && Number(v) === 0) return '0（夜勤不可）';
  return String(v);
}

function nowLocal() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── ローカル入力部品（ラベルと入力を id で対応付け） ──
function In({ label, name, form, set, type = 'text', hint, required, placeholder, wide, min, max }) {
  const id = useId();
  return (
    <div className={`form-group${wide ? ' wide' : ''}`}>
      <label className="form-label" htmlFor={id}>{label}{required && <span className="req"> *</span>}</label>
      <input id={id} className="form-input" type={type} value={form[name] ?? ''} placeholder={placeholder} min={min} max={max}
        required={required} aria-describedby={hint ? `${id}-h` : undefined} onChange={e => set(name, e.target.value)} />
      {hint && <div className="muted" id={`${id}-h`}>{hint}</div>}
    </div>
  );
}

function Sel({ label, name, form, set, options, empty = '（未選択）', hint, required }) {
  const id = useId();
  const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}{required && <span className="req"> *</span>}</label>
      <select id={id} className="form-select" value={form[name] ?? ''} onChange={e => set(name, e.target.value)}
        aria-describedby={hint ? `${id}-h` : undefined}>
        {empty !== null && <option value="">{empty}</option>}
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <div className="muted" id={`${id}-h`}>{hint}</div>}
    </div>
  );
}

function TA({ label, name, form, set, rows = 3, hint }) {
  const id = useId();
  return (
    <div className="form-group wide">
      <label className="form-label" htmlFor={id}>{label}</label>
      <textarea id={id} className="form-textarea" rows={rows} value={form[name] ?? ''} onChange={e => set(name, e.target.value)}
        aria-describedby={hint ? `${id}-h` : undefined} />
      {hint && <div className="muted" id={`${id}-h`}>{hint}</div>}
    </div>
  );
}

function Chips({ label, name, form, set, options, hint }) {
  const id = useId();
  const values = String(form[name] || '').split(',').map(s => s.trim()).filter(Boolean);
  const toggle = v => set(name, (values.includes(v) ? values.filter(x => x !== v) : [...values, v]).join(','));
  const extra = values.filter(v => !options.includes(v));
  return (
    <div className="form-group wide">
      <div className="form-label" id={id}>{label}</div>
      <div className="chips" role="group" aria-labelledby={id}>
        {options.map(o => (
          <button type="button" key={o} className={`chip${values.includes(o) ? ' on' : ''}`} aria-pressed={values.includes(o)} onClick={() => toggle(o)}>{o}</button>
        ))}
        {extra.map(o => (
          <button type="button" key={o} className="chip on" aria-pressed="true" title="選択肢にない値（クリックで外す）" onClick={() => toggle(o)}>{o}</button>
        ))}
      </div>
      {hint && <div className="muted">{hint}</div>}
    </div>
  );
}

// 在留資格：選択＋その他自由入力
function VisaField({ form, set, visaTypes }) {
  const id = useId();
  const v = form.visa_status ?? '';
  const inList = v === '' || visaTypes.includes(v);
  const [custom, setCustom] = useState(!inList);
  useEffect(() => { if (!inList) setCustom(true); }, [inList]);
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>在留資格</label>
      <select id={id} className="form-select" value={custom ? '__custom' : v}
        onChange={e => {
          if (e.target.value === '__custom') { setCustom(true); if (inList) set('visa_status', ''); }
          else { setCustom(false); set('visa_status', e.target.value); }
        }}>
        <option value="">（未選択）</option>
        {visaTypes.map(t => <option key={t} value={t}>{t}</option>)}
        <option value="__custom">自由入力…</option>
      </select>
      {custom && (
        <input className="form-input" style={{ marginTop: 6 }} aria-label="在留資格（自由入力）" placeholder="例：技術・人文知識・国際業務"
          value={v} maxLength={30} onChange={e => set('visa_status', e.target.value)} />
      )}
    </div>
  );
}

// ── 面談記録タブ ──
function NotesTab({ seekerId, seeker, onApplied }) {
  const notes = useApi(() => get(`/seekers/${seekerId}/notes`), [seekerId]);
  const [nf, setNf] = useState({ at: nowLocal(), method: '来所', memo: '' });
  const [addRun, adding, addError] = useAction();
  const [noteWarn, setNoteWarn] = useState([]);
  const [msg, setMsg] = useState('');

  const [aiRun, aiBusy, aiError, setAiError] = useAction();
  const [draft, setDraft] = useState(null); // { draftId, data }
  const [picked, setPicked] = useState({});
  const [applyWarn, setApplyWarn] = useState([]);
  const aiOk = !!Number(seeker?.ai_consent);
  const ids = { at: useId(), method: useId(), memo: useId() };

  const add = async () => {
    setMsg(''); setNoteWarn([]);
    if (!nf.memo.trim()) return;
    try {
      const r = await addRun(() => post(`/seekers/${seekerId}/notes`, { at: nf.at ? nf.at.replace('T', ' ') : '', method: nf.method, memo: nf.memo }));
      setNoteWarn(r?.prohibited || []);
      setMsg('面談記録を追加しました');
      notes.reload();
    } catch { /* ErrorText で表示 */ }
  };

  const extract = async memo => {
    setMsg(''); setApplyWarn([]);
    if (!String(memo || '').trim()) { setAiError('メモを入力してください'); return; }
    if (draft) { setAiError('先に表示中の抽出結果を「反映」または「破棄」してください'); return; }
    try {
      const r = await aiRun(() => post('/drafts/memo', { seeker_id: Number(seekerId), memo }));
      setDraft(r);
      const keys = Object.keys(r.data || {}).filter(k => k !== 'uncertain_points');
      setPicked(Object.fromEntries(keys.map(k => [k, true])));
    } catch { /* aiError */ }
  };

  const approve = async () => {
    const data = Object.fromEntries(Object.entries(draft.data).filter(([k]) => k !== 'uncertain_points' && picked[k]));
    if (!Object.keys(data).length) { setAiError('反映する項目を1つ以上選んでください（反映しない場合は「破棄」）'); return; }
    try {
      const r = await aiRun(() => post(`/drafts/${draft.draftId}/approve`, { data }));
      setApplyWarn(r?.prohibited || []);
      setDraft(null);
      setMsg(`${Object.keys(data).length}項目を希望条件に反映しました`);
      onApplied(data);
    } catch { /* aiError */ }
  };

  const reject = async () => {
    try {
      await aiRun(() => post(`/drafts/${draft.draftId}/reject`));
      setDraft(null);
      setMsg('抽出結果を破棄しました');
    } catch { /* aiError */ }
  };

  const rows = draft ? Object.entries(draft.data || {}).filter(([k]) => k !== 'uncertain_points') : [];
  const uncertain = draft?.data?.uncertain_points || [];

  return (
    <div>
      <Card title="面談記録を追加">
        <div className="grid2">
          <div className="form-group">
            <label className="form-label" htmlFor={ids.at}>日時</label>
            <input id={ids.at} className="form-input" type="datetime-local" value={nf.at} onChange={e => setNf({ ...nf, at: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={ids.method}>方法</label>
            <select id={ids.method} className="form-select" value={nf.method} onChange={e => setNf({ ...nf, method: e.target.value })}>
              {NOTE_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group wide">
            <label className="form-label" htmlFor={ids.memo}>メモ<span className="req"> *</span></label>
            <textarea id={ids.memo} className="form-textarea" rows={6} value={nf.memo} onChange={e => setNf({ ...nf, memo: e.target.value })}
              placeholder="面談の内容（文字起こしの貼り付けも可）。本籍・出生地・宗教・支持政党・家族の職業など、収集してはならない情報は記録しないでください。" />
          </div>
        </div>
        <ErrorText error={addError} />
        <Warnings items={noteWarn} />
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={add} disabled={adding || !nf.memo.trim()}>{adding ? '追加中…' : '記録を追加'}</button>
          <button type="button" className="btn btn-outline" onClick={() => extract(nf.memo)} disabled={!aiOk || aiBusy || !nf.memo.trim() || !!draft}>
            {aiBusy && !draft ? 'AI抽出中…' : 'AIで希望条件を抽出'}
          </button>
          {msg && <span className="muted" role="status">{msg}</span>}
        </div>
        {!aiOk && <div className="muted" style={{ marginTop: 6 }}>外部AI利用の同意がないため、AI抽出は使えません（「基本・同意」タブで同意を記録して保存してください）。</div>}
        {aiOk && <div className="muted" style={{ marginTop: 6 }}>AIには氏名・連絡先等を伏字にしたメモのみ送信します。抽出結果は確認のうえ、選んだ項目だけ反映されます。</div>}
      </Card>

      {(draft || aiError || applyWarn.length > 0) && (
        <Card title="AI抽出結果（要確認）">
          <ErrorText error={aiError} />
          <Warnings items={applyWarn} />
          {draft && (
            <>
              <div className="muted" style={{ marginBottom: 8 }}>AIによる参考情報です。誤りがないか確認し、反映する項目だけチェックしてください。</div>
              {rows.length === 0 ? <div className="muted">抽出できた項目はありません。</div> : (
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: 40 }}>
                        <input type="checkbox" aria-label="すべて選択"
                          checked={rows.every(([k]) => picked[k])}
                          onChange={e => setPicked(Object.fromEntries(rows.map(([k]) => [k, e.target.checked])))} />
                      </th>
                      <th scope="col">項目</th><th scope="col">現在値</th><th scope="col" aria-label="変更">→</th><th scope="col">抽出値</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(([k, v]) => {
                      const cid = `pick-${k}`;
                      return (
                        <tr key={k}>
                          <td><input id={cid} type="checkbox" checked={!!picked[k]} onChange={e => setPicked({ ...picked, [k]: e.target.checked })} /></td>
                          <td><label htmlFor={cid}>{LABELS[k] || k}</label></td>
                          <td className="muted">{fmtVal(k, seeker?.[k])}</td>
                          <td>→</td>
                          <td style={{ fontWeight: 600 }}>{fmtVal(k, v)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {uncertain.length > 0 && (
                <div className="warn-box">
                  <strong>要確認</strong>
                  <ul style={{ margin: '4px 0 0 18px' }}>{uncertain.map((u, i) => <li key={i}>{u}</li>)}</ul>
                </div>
              )}
              <div className="row" style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-primary" onClick={approve} disabled={aiBusy || rows.length === 0}>選んだ項目を反映</button>
                <button type="button" className="btn btn-outline" onClick={reject} disabled={aiBusy}>破棄</button>
                <span className="muted">反映すると保存済みの求職者情報が直接更新されます。</span>
              </div>
            </>
          )}
        </Card>
      )}

      <Card title="面談記録一覧" actions={<button type="button" className="btn btn-outline btn-sm" onClick={notes.reload} disabled={notes.loading}>再読込</button>}>
        <ErrorText error={notes.error} />
        {notes.loading && !notes.data ? <Loading /> : !notes.data?.length ? <div className="muted">記録はありません。</div> : (
          notes.data.map(n => (
            <div key={n.id} className="match-card">
              <div className="row">
                <strong>{n.at}</strong><Badge color="blue">{n.method || '—'}</Badge>
                <span className="muted">記録者：{n.operator || '—'}</span>
                <span className="spacer" />
                <button type="button" className="btn btn-outline btn-sm" disabled={!aiOk || aiBusy || !!draft} onClick={() => extract(n.memo)}>このメモでAI抽出</button>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{n.memo}</div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

// ── 本体 ──
export default function SeekerEdit() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const location = useLocation();
  const meta = useMeta();
  const seeker = useApi(() => (id ? get(`/seekers/${id}`) : Promise.resolve(null)), [id]);
  const [form, setForm] = useState({ ...DEFAULTS });
  const [tab, setTab] = useState('basic');
  const [warnings, setWarnings] = useState(null);
  const [savedMsg, setSavedMsg] = useState('');
  const [offerMatch, setOfferMatch] = useState(false);
  const [localError, setLocalError] = useState('');
  const [run, busy, error] = useAction();
  const initFor = useRef(undefined);

  const set = (name, value) => setForm(f => ({ ...f, [name]: value }));

  // 初回読込時（および id 変更時）のみフォームを初期化。再読込では未保存の入力を消さない
  useEffect(() => {
    if (isNew) {
      if (initFor.current !== 'new') { initFor.current = 'new'; setForm({ ...DEFAULTS }); setTab('basic'); }
      return;
    }
    const d = seeker.data;
    if (d && String(d.id) === String(id) && initFor.current !== String(id)) {
      initFor.current = String(id);
      const f = toForm(d);
      for (const [k, v] of Object.entries(DEFAULTS)) if (f[k] === '' || f[k] == null) f[k] = v;
      setForm(f);
    }
  }, [isNew, id, seeker.data]);

  // 新規登録直後の遷移で渡された警告
  useEffect(() => {
    if (location.state?.prohibited) setWarnings(location.state.prohibited);
    if (location.state?.saved) setSavedMsg('登録しました');
  }, [location.state]);

  const payload = () => {
    const body = {};
    for (const k of FIELDS) if (form[k] !== undefined) body[k] = form[k];
    if (!isNew) {
      // 更新時に空欄で送ると自動設定済みの日付が消えるため送らない
      for (const k of ['accepted_date', 'validity_end']) if (body[k] === '') delete body[k];
    }
    return body;
  };

  const save = async mode => {
    setLocalError(''); setSavedMsg(''); setOfferMatch(false);
    if (!String(form.name || '').trim()) { setTab('basic'); setLocalError('氏名を入力してください'); return; }
    if (!form.consent_date) { setTab('basic'); setLocalError('個人情報取扱い同意日を入力してください（同意を得てから登録します）'); return; }
    try {
      if (isNew) {
        const r = await run(() => post('/seekers', payload()));
        const pro = r?.prohibited || [];
        if (mode === 'match' && !pro.length) navigate(`/seekers/${r.id}/matches?run=1`);
        else navigate(`/seekers/${r.id}`, { replace: true, state: { prohibited: pro, saved: true } });
      } else {
        const r = await run(() => put(`/seekers/${id}`, payload()));
        const pro = r?.prohibited || [];
        setWarnings(pro);
        seeker.reload();
        if (mode === 'match' && !pro.length) navigate(`/seekers/${id}/matches?run=1`);
        else { setSavedMsg('保存しました'); if (mode === 'match') setOfferMatch(true); }
      }
    } catch { /* error 表示 */ }
  };

  const remove = async () => {
    if (!window.confirm(`${form.name || 'この求職者'} を削除しますか？\n論理削除し、保存期限（既定2年）経過後に自動で完全削除されます。`)) return;
    try {
      await run(() => del(`/seekers/${id}`));
      navigate('/seekers');
    } catch { /* error 表示 */ }
  };

  const onApplied = data => {
    setForm(f => ({ ...f, ...toForm(data) }));
    seeker.reload();
  };

  if (!isNew && seeker.loading && !seeker.data) return <Loading />;
  if (!isNew && !seeker.data && seeker.error) return <div><PageHeader title="求職者" /><ErrorText error={seeker.error} /><Link to="/seekers">一覧へ戻る</Link></div>;

  const guard = seeker.data?.guard;
  const shownWarnings = warnings ?? seeker.data?.prohibited ?? [];
  const tabs = [['basic', '基本・同意'], ['wish', '希望条件'], ['foreign', '外国籍・在留'], ...(isNew ? [] : [['notes', '面談記録']])];
  const languages = meta?.languages || Object.keys(LANG_LABEL);

  return (
    <div>
      <PageHeader title={isNew ? '求職者を登録' : `${seeker.data?.name || ''} さん`}
        subtitle={isNew ? '個人情報の取扱いについて同意を得てから登録してください。' : `ID ${id}　受付日 ${seeker.data?.accepted_date || '—'}　有効期間 ${seeker.data?.validity_end || '—'}`}>
        {!isNew && <Badge>{seeker.data?.status}</Badge>}
        {!isNew && <Link className="btn btn-outline btn-sm" to={`/seekers/${id}/matches`}>マッチング結果</Link>}
        <Link className="btn btn-outline btn-sm" to="/seekers">一覧へ</Link>
      </PageHeader>

      {guard && (
        <div className="danger-box" role="alert">
          <strong>転職勧奨禁止期間中</strong>：{guard.hire_date} に自社紹介で {guard.company} に無期雇用で就職しています。
          {guard.until} までは転職を勧奨してはいけません（本人から求職の申込みがあった場合のみ対応し、経緯を記録してください）。
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="入力項目の区分">
        {tabs.map(([k, label]) => (
          <button type="button" key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'basic' && (
        <Card>
          <div className="grid2">
            <In label="氏名" name="name" form={form} set={set} required />
            <In label="フリガナ" name="name_kana" form={form} set={set} />
            <In label="生年月日" name="birth_date" type="date" form={form} set={set} />
            <In label="電話" name="phone" type="tel" form={form} set={set} />
            <In label="メール" name="email" type="email" form={form} set={set} />
            <In label="住所" name="address" form={form} set={set} wide />
            <In label="求職受付日" name="accepted_date" type="date" form={form} set={set} hint={isNew ? '空欄なら本日' : undefined} />
            <In label="求職の有効期間（終了日）" name="validity_end" type="date" form={form} set={set} hint="空欄なら受付日から設定の月数で自動設定" />
            <In label="個人情報取扱い同意日" name="consent_date" type="date" form={form} set={set} required />
            <Sel label="提案書の言語" name="preferred_language" form={form} set={set} empty={null}
              options={languages.map(l => ({ value: l, label: LANG_LABEL[l] || l }))} />
            <Sel label="ステータス" name="status" form={form} set={set} empty={null} options={meta?.seekerStatuses || ['受付', '紹介中', '面接', '内定', '就職', '終了']}
              hint="就職・終了にすると保存期限が設定されます" />
          </div>
          <div className="form-group">
            <Check label="外部AIの利用に同意している" name="ai_consent" form={form} set={set} />
            <div className="muted" style={{ marginTop: -8 }}>同意がある場合のみ、氏名・連絡先等を除いた仮名化データを外部AIに送信し、マッチング補足・面談メモ抽出に使います。</div>
          </div>
          <div className="grid2">
            <TA label="メモ" name="notes" form={form} set={set} rows={4} hint="社内用メモ。AIへは送信しません。本籍・宗教・支持政党・家族の職業など収集してはならない情報は書かないでください。" />
          </div>
        </Card>
      )}

      {tab === 'wish' && (
        <Card>
          <div className="grid2">
            <In label="都道府県" name="prefecture" form={form} set={set} placeholder="例：大阪府" />
            <In label="居住市区町村" name="city" form={form} set={set} placeholder="例：大阪市北区" />
            <In label="最寄り駅" name="nearest_station" form={form} set={set} placeholder="例：梅田（「駅」は不要）" />
            <In label="通勤上限（分）" name="max_commute_minutes" type="number" min={0} form={form} set={set} />
            <In label="通勤可能な市区町村" name="acceptable_cities" form={form} set={set} wide
              hint="カンマ区切り。「大阪府堺市」のように都道府県付きでも可" placeholder="例：大阪市, 吹田市, 大阪府堺市" />
            <Chips label="通勤手段" name="transport" form={form} set={set} options={TRANSPORTS} hint="自動計算では先頭の手段を使います" />
            <In label="希望職種" name="desired_categories" form={form} set={set} wide hint="自由入力・カンマ区切り（例：介護職, 生活相談員）" />
            <Chips label="希望職務" name="desired_job_kinds" form={form} set={set} options={meta?.jobKinds || []} />
            <Chips label="希望施設種別" name="desired_facility_types" form={form} set={set} options={meta?.facilityTypes || []} />
            <Chips label="不可施設種別" name="excluded_facility_types" form={form} set={set} options={meta?.facilityTypes || []} hint="選んだ種別の求人は候補から除外します" />
            <In label="希望雇用形態" name="desired_employment" form={form} set={set} hint="カンマ区切り（例：正社員, パート）" />
            <Sel label="賃金形態" name="desired_wage_type" form={form} set={set} empty={null}
              options={Object.entries(WAGE_LABEL).map(([value, label]) => ({ value, label }))} />
            <In label="希望賃金（下限）" name="desired_wage_min" form={form} set={set} hint="円。「22万」「1,200」等も可" />
            <In label="勤務可能時間（開始）" name="available_start" type="time" form={form} set={set} />
            <In label="勤務可能時間（終了）" name="available_end" type="time" form={form} set={set} />
            <In label="夜勤上限（回/月）" name="night_max_per_month" type="number" min={0} form={form} set={set} hint="空欄＝制限なし、0＝夜勤不可" />
            <In label="週勤務日数上限" name="max_days_per_week" type="number" min={1} max={7} form={form} set={set} />
            <In label="希望年間休日（日以上）" name="min_annual_holidays" type="number" min={0} form={form} set={set} />
            <In label="就業可能日" name="available_from" type="date" form={form} set={set} />
            <In label="経験年数" name="experience_years" type="number" min={0} form={form} set={set} />
            <Sel label="重み付け" name="weight_profile" form={form} set={set} empty={null}
              options={(meta?.weightProfiles || Object.keys(WEIGHT_LABEL)).map(w => ({ value: w, label: WEIGHT_LABEL[w] || w }))}
              hint="マッチングの加点配分" />
          </div>
          <div className="row" style={{ gap: 20 }}>
            <Check label="夜勤・交替制可" name="shift_ok" form={form} set={set} />
            <Check label="夜勤専従希望" name="night_only" form={form} set={set} />
          </div>
          <div className="grid2">
            <In label="保有資格" name="licenses" form={form} set={set} wide hint="カンマ区切り（例：介護福祉士, 普通自動車免許）" />
            <TA label="経験概要" name="experience_note" form={form} set={set} rows={3} />
            <TA label="希望の優先順位" name="priorities" form={form} set={set} rows={2} hint="自由記述（例：通勤30分以内を最優先、次に賃金）" />
          </div>
        </Card>
      )}

      {tab === 'foreign' && (
        <Card>
          <Check label="外国籍" name="is_foreign_national" form={form} set={set} />
          <div className="grid2">
            <VisaField form={form} set={set} visaTypes={meta?.visaTypes || []} />
            <In label="在留期限" name="residence_expiry" type="date" form={form} set={set} />
            <In label="就労制限" name="work_restriction" form={form} set={set} placeholder="例：在留カード記載の就労制限の有無" />
          </div>
          <Check label="資格外活動許可あり" name="extra_activity_permit" form={form} set={set} />
          <div className="warn-box" style={{ marginBottom: 12 }}>紹介前に在留カードの原本を確認し、確認日と確認者を記録してください（不法就労助長の防止）。</div>
          <div className="grid2">
            <In label="在留カード原本確認日" name="residence_checked_date" type="date" form={form} set={set} />
            <In label="確認者" name="residence_checked_by" form={form} set={set} />
            <Sel label="JLPT" name="jlpt_level" form={form} set={set} options={JLPT} />
            <In label="技能試験" name="skill_test" form={form} set={set} placeholder="例：介護技能評価試験 合格" />
          </div>
          <Check label="介護日本語評価試験 合格" name="care_japanese_test" form={form} set={set} />
        </Card>
      )}

      {tab === 'notes' && !isNew && <NotesTab seekerId={id} seeker={seeker.data} onApplied={onApplied} />}

      {tab !== 'notes' && (
        <Card>
          <ErrorText error={localError || error} />
          <Warnings items={shownWarnings} />
          {offerMatch && (
            <div className="ok-box">保存しました。上記の警告を確認のうえ <Link to={`/seekers/${id}/matches?run=1`}>マッチング判定へ進む</Link></div>
          )}
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => save('match')} disabled={busy}>{busy ? '保存中…' : '保存してマッチング判定'}</button>
            <button type="button" className="btn btn-outline" onClick={() => save('only')} disabled={busy}>保存のみ</button>
            {savedMsg && !offerMatch && <span className="muted" role="status">{savedMsg}</span>}
            <span className="spacer" />
            {!isNew && <button type="button" className="btn btn-danger btn-sm" onClick={remove} disabled={busy}>削除</button>}
          </div>
        </Card>
      )}
    </div>
  );
}
