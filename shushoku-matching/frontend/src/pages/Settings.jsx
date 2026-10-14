import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post, put } from '../api/client';
import { useApi, useAction } from '../hooks/useApi';
import { PageHeader, Card, ErrorText, Loading, Badge, Check } from '../components/ui';

// 設定・ログ：GET/PUT /settings、AI利用状況、バックアップ、保存期限、操作ログ

// backend の audit('...') 呼び出しを網羅（ai_send は現状 backend に無いが将来用に保持）
const AUDIT_LABEL = {
  seeker_view: '求職者閲覧', seeker_create: '求職者登録', seeker_update: '求職者更新', seeker_delete: '求職者削除',
  note_create: '面談記録作成', match_run: 'マッチング実行', match_update: '紹介状況更新', proposal_create: '提案書作成',
  commute_api: '通勤時間API照会', ai_send: 'AI送信',
  employer_create: '事業所登録', employer_update: '事業所更新', employer_delete: '事業所削除',
  posting_create: '求人登録', posting_update: '求人更新', posting_active: '求人の掲載切替', posting_convert: '自社求人へ変換',
  import: '求人CSV取込', draft_create: '下書き作成', draft_approve: '下書き承認', draft_reject: '下書き却下',
  placement_create: '成約登録', placement_update: '成約・請求更新', followup_update: '定着フォロー更新',
  complaint_create: '苦情受付', complaint_update: '苦情対応更新', ledger_export: '帳簿CSV出力',
  settings_update: '設定変更', backup: 'バックアップ', retention_purge: '保存期限到来による削除',
};
const LEDGER_LABEL = { job: '求人管理簿', seeker: '求職管理簿', fee: '手数料管理簿' };
const AI_PURPOSE = { match_advice: '求人提案の補足', memo_extract: '面談メモ抽出', posting_ocr: '求人票読取', translate: '翻訳' };

const TABS = [
  ['basic', '事業者・手数料'],
  ['match', 'マッチング・求職'],
  ['ai', 'AI'],
  ['provision', '求人取込'],
  ['backup', 'バックアップ・保存期限'],
  ['log', '操作ログ'],
];

function parsePolicy(v) {
  try {
    const a = JSON.parse(v || '[]');
    return Array.isArray(a) ? a.map(x => ({ withinDays: x.withinDays ?? '', rate: x.rate ?? '' })) : [];
  } catch { return []; }
}

// 1項目（ラベルと入力を id で対応付け）
function In({ id, label, form, set, name, type = 'text', hint, suffix, min, max, step, placeholder, width }) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input id={id} className="form-input" type={type} value={form[name] ?? ''} min={min} max={max} step={step}
          placeholder={placeholder} style={width ? { width } : undefined} onChange={e => set(name, e.target.value)} />
        {suffix && <span className="muted" style={{ whiteSpace: 'nowrap' }}>{suffix}</span>}
      </div>
      {hint && <div className="muted">{hint}</div>}
    </div>
  );
}

// セクション単位で保存（そのセクションのキーだけ PUT）
function Section({ title, keys, form, children, serialize, onSaved, note }) {
  const [run, busy, error] = useAction();
  const [ok, setOk] = useState('');
  const save = async () => {
    setOk('');
    const body = {};
    for (const k of keys) body[k] = form[k] ?? '';
    if (serialize) Object.assign(body, serialize());
    try {
      await run(() => put('/settings', body));
      setOk('保存しました');
      onSaved?.();
    } catch { /* useAction がエラーを保持 */ }
  };
  return (
    <Card title={title} actions={<button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button>}>
      {children}
      <ErrorText error={error} />
      {ok && <div className="ok-box">{ok}{note ? ` ${note}` : ''}</div>}
    </Card>
  );
}

function RefundEditor({ rows, setRows }) {
  const upd = (i, k, v) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="form-group wide">
      <div className="form-label">返戻金規定（入職後の離職時）</div>
      {rows.length === 0 && <div className="muted" style={{ marginBottom: 6 }}>未設定（返戻なし、または届出内容を入力してください）</div>}
      {rows.map((r, i) => (
        <div key={i} className="row" style={{ marginBottom: 6 }}>
          <label htmlFor={`rf-d-${i}`}>入職後</label>
          <input id={`rf-d-${i}`} className="form-input" type="number" min={1} style={{ width: 90 }} value={r.withinDays} onChange={e => upd(i, 'withinDays', e.target.value)} />
          <label htmlFor={`rf-r-${i}`}>日以内の離職 → 返戻率</label>
          <input id={`rf-r-${i}`} className="form-input" type="number" min={0} max={100} style={{ width: 90 }} value={r.rate} onChange={e => upd(i, 'rate', e.target.value)} />
          <span>%</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>削除</button>
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setRows(rs => [...rs, { withinDays: '', rate: '' }])}>＋ 行を追加</button>
      <div className="muted">日数の短い順に並べ替えて保存します。</div>
    </div>
  );
}

// 接続テストボタン（AI・ハローワークAPI）
function ConnTest({ path, label }) {
  const [msg, setMsg] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const test = async () => {
    setBusy(true); setMsg(null);
    try { const r = await post(path); setMsg({ ok: r.ok !== false, text: r.message || (r.reply ? `接続成功（応答：${r.reply}）` : '接続成功') }); }
    catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };
  return (
    <div className="row" style={{ margin: '8px 0' }}>
      <button type="button" className="btn btn-outline btn-sm" onClick={test} disabled={busy}>{busy ? 'テスト中…' : label}</button>
      {msg && <span className={msg.ok ? 'ok-box' : 'danger-box'} style={{ margin: 0 }}>{msg.text}</span>}
    </div>
  );
}

function AiUsage() {
  const { data, error, loading, reload } = useApi(() => get('/settings/ai-usage'), []);
  const pct = data && data.budgetUsd > 0 ? Math.min(100, Math.round((data.monthSpentUsd / data.budgetUsd) * 100)) : 0;
  return (
    <Card title="AI利用状況" actions={<button type="button" className="btn btn-outline btn-sm" onClick={reload} disabled={loading}>再読込</button>}>
      <ErrorText error={error} />
      {loading && !data && <Loading />}
      {data && (
        <>
          <ConnTest path="/settings/ai-test" label="AI接続テスト（APIキーの確認）" />
          <dl className="kv" style={{ marginBottom: 12 }}>
            <dt>モデル</dt><dd>{data.model || '—'}</dd>
            <dt>利用可否</dt><dd>{data.available ? <Badge color="green">利用可</Badge> : <Badge color="gray">利用不可（APIキー未設定またはAI無効）</Badge>}</dd>
            <dt>今月の利用額</dt>
            <dd>
              ${Number(data.monthSpentUsd || 0).toFixed(2)} / 上限 ${Number(data.budgetUsd || 0).toFixed(2)}
              {data.budgetUsd > 0 && <span className="bar" style={{ marginLeft: 8, width: 120 }}><i style={{ width: `${pct}%`, background: pct >= 90 ? 'var(--red)' : undefined }} /></span>}
            </dd>
          </dl>
          {pct >= 90 && <div className="warn-box">今月の利用額が上限の{pct}%に達しています。</div>}
          {(data.recent || []).length === 0 ? <div className="muted">利用履歴はありません</div> : (
            <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
              <table className="table">
                <thead><tr><th>日時</th><th>用途</th><th>状態</th><th style={{ textAlign: 'right' }}>トークン（入/出）</th><th style={{ textAlign: 'right' }}>費用</th><th>操作者</th></tr></thead>
                <tbody>
                  {data.recent.map(r => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{r.at}</td>
                      <td>{AI_PURPOSE[r.purpose] || r.purpose}</td>
                      <td><Badge>{r.status || '—'}</Badge>{r.error && <div className="muted">{r.error}</div>}</td>
                      <td style={{ textAlign: 'right' }}>{r.input_tokens ?? '—'} / {r.output_tokens ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>{r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(4)}` : '—'}</td>
                      <td>{r.operator || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function Backups({ encrypted, backupDir }) {
  const list = useApi(() => get('/settings/backups'), []);
  const [run, busy, error] = useAction();
  const [result, setResult] = useState(null);
  const now = async () => {
    setResult(null);
    try {
      const r = await run(() => post('/settings/backup-now'));
      setResult(r);
      list.reload();
    } catch { /* useAction がエラーを保持 */ }
  };
  return (
    <Card title="バックアップの実行と一覧">
      {encrypted
        ? <div className="ok-box">暗号化：有効（環境変数 BACKUP_PASSWORD 設定済み。AES-256-GCMで暗号化して保存）</div>
        : <div className="warn-box">環境変数 BACKUP_PASSWORD 未設定：外部フォルダへの保存は不可・ローカルは平文</div>}
      {!encrypted && backupDir && <div className="danger-box">保存先（外部媒体）が設定されていますが暗号化キーが無いため、バックアップは失敗します。</div>}
      <div className="row" style={{ margin: '8px 0' }}>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={now}>{busy ? '実行中…' : '今すぐバックアップ'}</button>
      </div>
      <ErrorText error={error} />
      {result && <div className="ok-box">保存しました：{result.file}（{result.encrypted ? '暗号化' : '平文'}・保持 {result.kept} 世代）</div>}
      <ErrorText error={list.error} />
      {list.loading && !list.data && <Loading />}
      {list.data && (list.data.length === 0 ? <div className="muted">バックアップはありません</div> : (
        <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}>
          <table className="table">
            <thead><tr><th>ファイル</th><th>フォルダ</th><th style={{ textAlign: 'right' }}>サイズ</th><th>暗号化</th></tr></thead>
            <tbody>
              {list.data.map(b => (
                <tr key={`${b.dir}/${b.file}`}>
                  <td>{b.file}</td><td className="muted">{b.dir}</td>
                  <td style={{ textAlign: 'right' }}>{(b.size / 1024 / 1024).toFixed(2)} MB</td>
                  <td>{b.file.endsWith('.enc') ? <Badge color="green">暗号化</Badge> : <Badge color="orange">平文</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <div className="alert-banner blue" style={{ marginTop: 12, display: 'block' }}>
        <b>復元手順</b>
        <ol style={{ margin: '4px 0 0 20px' }}>
          <li>アプリ（サーバ）を停止する</li>
          <li>backend フォルダで <code>node scripts/restore.js &lt;バックアップファイル&gt;</code> を実行（暗号化ファイルは BACKUP_PASSWORD が必要）</li>
          <li>アプリを起動し、データを確認する</li>
        </ol>
      </div>
    </Card>
  );
}

function PurgeCandidates() {
  const { data, error, loading } = useApi(() => get('/settings/purge-candidates'), []);
  return (
    <Card title="保存期限による削除予定（30日以内）">
      <ErrorText error={error} />
      {loading && !data && <Loading />}
      {data && (data.length === 0 ? <div className="muted">30日以内に保存期限が到来する求職者はいません</div> : (
        <table className="table">
          <thead><tr><th>氏名</th><th>状態</th><th>紹介終了日</th><th>保存期限</th></tr></thead>
          <tbody>
            {data.map(s => (
              <tr key={s.id}>
                <td>{s.deleted_at ? s.name : <Link to={`/seekers/${s.id}`}>{s.name}</Link>}</td>
                <td><Badge>{s.deleted_at ? '終了' : s.status}</Badge>{s.deleted_at && <span className="muted">（削除済み）</span>}</td>
                <td>{s.closed_date || '—'}</td>
                <td>{s.retention_until}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      <div className="muted" style={{ marginTop: 8 }}>
        保存期限（紹介終了日から設定の保存年数）を過ぎた求職者の個人データは、日次処理で関連記録とともに削除されます（操作ログには件数のみ記録）。
        帳簿の保存期間は業務運営要領で要確認。必要な帳簿は削除前にCSVで出力・保管してください。
      </div>
    </Card>
  );
}

function AuditLog() {
  const { data, error, loading, reload } = useApi(() => get('/settings/audit-log'), []);
  const [q, setQ] = useState('');
  const rows = (data || []).filter(r => {
    if (!q) return true;
    const s = `${r.operator || ''} ${AUDIT_LABEL[r.action] || r.action} ${r.target || ''} ${r.detail || ''}`;
    return s.includes(q);
  });
  const fmtDetail = r => {
    if (!r.detail) return '';
    try {
      const d = JSON.parse(r.detail);
      return Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(',') : typeof v === 'object' && v ? JSON.stringify(v) : v}`).join(' / ');
    } catch { return r.detail; }
  };
  const fmtTarget = r => (r.action === 'ledger_export' ? LEDGER_LABEL[r.target] || r.target : r.target || '—');
  return (
    <Card title="操作ログ（最新300件）" actions={<button type="button" className="btn btn-outline btn-sm" onClick={reload} disabled={loading}>再読込</button>}>
      <div className="form-group" style={{ maxWidth: 320 }}>
        <label className="form-label" htmlFor="log-q">絞り込み（操作者・操作・対象・詳細）</label>
        <input id="log-q" className="form-input" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <ErrorText error={error} />
      {loading && !data && <Loading />}
      {data && (rows.length === 0 ? <div className="muted">該当するログはありません</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>日時</th><th>操作者</th><th>操作</th><th>対象</th><th>詳細</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.at}</td>
                  <td>{r.operator || '—'}</td>
                  <td>{AUDIT_LABEL[r.action] || r.action}</td>
                  <td>{fmtTarget(r)}</td>
                  <td className="muted" style={{ wordBreak: 'break-all' }}>{fmtDetail(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Card>
  );
}

export default function Settings() {
  const { data, error, loading, reload } = useApi(() => get('/settings'), []);
  const [form, setForm] = useState({});
  const [refund, setRefund] = useState([]);
  const [tab, setTab] = useState('basic');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!data?.settings) return;
    setForm(data.settings);
    setRefund(parsePolicy(data.settings.refund_policy));
  }, [data]);

  const serializeRefund = () => {
    const rows = refund
      .filter(r => String(r.withinDays).trim() !== '' || String(r.rate).trim() !== '')
      .map(r => ({ withinDays: Number(r.withinDays), rate: Number(r.rate) }))
      .sort((a, b) => a.withinDays - b.withinDays);
    return { refund_policy: JSON.stringify(rows) };
  };

  if (loading && !data) return <div><PageHeader title="設定・ログ" /><Loading /></div>;
  if (error && !data) return <div><PageHeader title="設定・ログ" /><ErrorText error={error} /></div>;

  const common = { form, onSaved: reload };

  return (
    <div>
      <PageHeader title="設定・ログ" subtitle="事業者情報・手数料・判定・AI・取込・バックアップの設定と操作ログ" />
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'basic' && (
        <>
          <Section title="事業者情報" keys={['company_name', 'license_no', 'handling_scope', 'contact_person', 'contact_email', 'contact_tel', 'operators']} {...common}
            note="事業者名・許可番号・取扱職種・問い合わせ先は、受付フォームの「事業者情報」と提案書に表示されます。操作者の変更は、画面を再読込すると左下の操作者一覧に反映されます。">
            <div className="grid2">
              <In id="s-company" label="事業者名" name="company_name" form={form} set={set} />
              <In id="s-license" label="有料職業紹介事業 許可番号" name="license_no" form={form} set={set} placeholder="例：13-ユ-000000" />
              <In id="s-scope" label="取扱職種の範囲" name="handling_scope" form={form} set={set} placeholder="例：国内・全職種" />
              <In id="s-contact" label="苦情・開示請求の担当者" name="contact_person" form={form} set={set} placeholder="例：職業紹介責任者 氏名" />
              <In id="s-cmail" label="問い合わせ先メール" name="contact_email" form={form} set={set} />
              <In id="s-ctel" label="問い合わせ先電話" name="contact_tel" form={form} set={set} />
              <div className="form-group wide">
                <In id="s-ops" label="操作者（カンマ区切り）" name="operators" form={form} set={set} placeholder="例：吉井,山田"
                  hint="操作者名は操作ログ・履歴に記録されます。保存後、画面を再読込すると反映されます。" />
              </div>
            </div>
          </Section>

          <Section title="手数料・返戻金" keys={['fee_mode', 'fee_rate_percent', 'fee_cap_percent', 'fee_basis_months', 'invoice_due_days']} serialize={serializeRefund} {...common}>
            <div className="warn-box" style={{ marginTop: 0, marginBottom: 12 }}>届出した手数料表の内容を入力してください。手数料率・返戻金の既定値は設定していません。</div>
            <div className="grid2">
              <div className="form-group">
                <label className="form-label" htmlFor="s-feemode">手数料の方式</label>
                <select id="s-feemode" className="form-select" value={form.fee_mode ?? ''} onChange={e => set('fee_mode', e.target.value)}>
                  <option value="届出制">届出制</option>
                  <option value="上限制">上限制</option>
                </select>
              </div>
              <In id="s-feerate" label="紹介手数料率" name="fee_rate_percent" type="number" min={0} max={100} step="0.1" suffix="%" form={form} set={set} hint="算定基礎（賃金）に対する割合" />
              <In id="s-feecap" label="手数料の上限率" name="fee_cap_percent" type="number" min={0} max={100} step="0.1" suffix="%" form={form} set={set} hint="この率を超える請求額を警告します" />
              <In id="s-feebasis" label="算定基礎の月数" name="fee_basis_months" type="number" min={0} max={24} step="0.5" suffix="か月分" form={form} set={set} />
              <In id="s-due" label="請求書の支払期限" name="invoice_due_days" type="number" min={0} max={365} suffix="日後" form={form} set={set} />
              <RefundEditor rows={refund} setRows={setRefund} />
            </div>
          </Section>
        </>
      )}

      {tab === 'match' && (
        <>
          <Section title="マッチング" keys={['match_min_score', 'verdict_high_score', 'wage_tolerance_percent', 'tokutei_visiting_allowed']} {...common}>
            <div className="grid2">
              <In id="s-minscore" label="候補表示の最低スコア" name="match_min_score" type="number" min={0} max={100} suffix="点" form={form} set={set} />
              <In id="s-highscore" label="「案内可（マッチ度高）」とするスコア" name="verdict_high_score" type="number" min={0} max={100} suffix="点以上" form={form} set={set} />
              <In id="s-wagetol" label="賃金の許容差" name="wage_tolerance_percent" type="number" min={0} max={30} suffix="%" form={form} set={set} hint="希望賃金に対する不足がこの割合以内なら除外せず注意表示" />
            </div>
            <Check label="特定技能の在留資格で訪問系業務を「可」と判定する" name="tokutei_visiting_allowed" form={form} set={set} />
            <div className="muted">特定技能の訪問系業務の可否は、最新の運用要領で要確認。</div>
          </Section>

          <Section title="求職の受付・保存" keys={['seeker_validity_months', 'retention_years']} {...common}>
            <div className="grid2">
              <In id="s-valid" label="求職の有効期間（受付日から）" name="seeker_validity_months" type="number" min={1} max={24} suffix="か月" form={form} set={set} />
              <In id="s-ret" label="個人データの保存年数（紹介終了から）" name="retention_years" type="number" min={2} max={20} suffix="年" form={form} set={set} hint="2年以上。帳簿の保存期間は業務運営要領で要確認" />
            </div>
          </Section>

          <Card title="通勤時間API">
            {data.mapsApi
              ? <div className="ok-box">Google Maps API キー（GOOGLE_MAPS_API_KEY）設定済み：通勤時間を経路検索で算出します。照会は操作ログに記録されます。</div>
              : <div className="warn-box">GOOGLE_MAPS_API_KEY 未設定：通勤時間は算出されず、市区町村・都道府県の一致で判定します。</div>}
          </Card>
        </>
      )}

      {tab === 'ai' && (
        <>
          <Section title="AI設定" keys={['ai_enabled', 'ai_top_n', 'ai_monthly_budget_usd']} {...common}>
            <Check label="AI機能を有効にする（求人提案の補足・面談メモ抽出・求人票読取・翻訳）" name="ai_enabled" form={form} set={set} />
            <div className="grid2">
              <In id="s-topn" label="AIで補足する上位候補数" name="ai_top_n" type="number" min={0} max={10} suffix="件（0〜10）" form={form} set={set} />
              <In id="s-budget" label="月間予算" name="ai_monthly_budget_usd" type="number" min={0} max={10000} step="1" suffix="USD" form={form} set={set} hint="上限に達すると当月はAIを利用しません" />
            </div>
            <div className="muted">AIへは本人の同意（AI利用同意）がある求職者について、氏名・連絡先を除いた情報のみ送信します。AIの結果は補助情報です。</div>
          </Section>
          <AiUsage />
        </>
      )}

      {tab === 'provision' && (
        <Section title="求人取込（ハローワーク求人情報オンライン提供）" keys={['provision_enabled', 'provision_dir', 'fetch_cron', 'provision_terms', 'provision_column_map']} {...common}>
          <Check label="受領フォルダからの自動取込を有効にする" name="provision_enabled" form={form} set={set} />
          <div className="grid2">
            <In id="s-pdir" label="受領CSVのフォルダ" name="provision_dir" form={form} set={set} placeholder={"例：D:\\hw_provision"} />
            <In id="s-cron" label="取込スケジュール（cron式）" name="fetch_cron" form={form} set={set} hint="例：毎日2:30は「30 2 * * *」（分 時 日 月 曜日）" />
            <div className="form-group wide">
              <label className="form-label" htmlFor="s-terms">利用条件（取込画面に表示）</label>
              <textarea id="s-terms" className="form-textarea" rows={3} value={form.provision_terms ?? ''} onChange={e => set('provision_terms', e.target.value)} />
            </div>
            <div className="form-group wide">
              <label className="form-label" htmlFor="s-colmap">列名の対応付け（JSON）</label>
              <textarea id="s-colmap" className="form-textarea" rows={4} style={{ fontFamily: 'monospace' }} value={form.provision_column_map ?? ''} onChange={e => set('provision_column_map', e.target.value)} />
              <div className="muted">受領CSVの列名が既定と異なる場合 {'{"CSV列名":"posting_no"}'} の形で対応付け。不要なら {'{}'}。</div>
            </div>
          </div>
        </Section>
      )}

      {tab === 'provision' && (
        <Section title="ハローワーク求人情報提供 Web API（自動取得）" keys={['hwapi_enabled', 'hwapi_token_url', 'hwapi_data_url', 'hwapi_logout_url', 'hwapi_data_ids', 'hwapi_token_tag', 'hwapi_record_tag', 'hwapi_field_map', 'hwapi_id_param', 'hwapi_pass_param', 'hwapi_prefectures', 'hwapi_interval_ms']} {...common}>
          <div className="warn-box">
            管轄労働局へ利用申請し、承認後に受け取る「API インタフェース仕様書」の内容に合わせて入力してください。
            ID・パスワードは画面では保存せず、環境変数 HW_API_ID / HW_API_PASSWORD に設定します
            （現在：{data.hwApiCredentials ? '設定済み' : '未設定'}）。取得は「取込スケジュール」の時刻に1日1回実行されます。
          </div>
          <Check label="Web APIによる自動取得を有効にする" name="hwapi_enabled" form={form} set={set} />
          <ConnTest path="/settings/hwapi-test" label="API接続テスト（保存後に実行）" />
          <div className="grid2">
            <In id="s-hw-token" label="トークン取得URL" name="hwapi_token_url" form={form} set={set} placeholder="https://…" />
            <In id="s-hw-data" label="データ取得URL" name="hwapi_data_url" form={form} set={set} hint="{dataId} {page} {token} が置き換わります" />
            <In id="s-hw-logout" label="トークン破棄URL（任意）" name="hwapi_logout_url" form={form} set={set} />
            <In id="s-hw-ids" label="データID（カンマ区切り）" name="hwapi_data_ids" form={form} set={set} hint="民間職業紹介事業者用のID（公共機関用と取り違えない）" />
            <In id="s-hw-idp" label="ID のパラメータ名" name="hwapi_id_param" form={form} set={set} />
            <In id="s-hw-pwp" label="パスワードのパラメータ名" name="hwapi_pass_param" form={form} set={set} />
            <In id="s-hw-ttag" label="トークンのXMLタグ名" name="hwapi_token_tag" form={form} set={set} />
            <In id="s-hw-rtag" label="求人1件のXMLタグ名" name="hwapi_record_tag" form={form} set={set} />
            <In id="s-hw-pref" label="取り込む都道府県（カンマ区切り）" name="hwapi_prefectures" form={form} set={set} hint="空欄＝すべて。例：大阪府,兵庫県" />
            <In id="s-hw-int" label="リクエスト間隔（ミリ秒）" name="hwapi_interval_ms" type="number" min={1000} form={form} set={set} />
            <div className="form-group wide">
              <label className="form-label" htmlFor="s-hw-map">項目の対応付け（JSON）</label>
              <textarea id="s-hw-map" className="form-textarea" rows={6} style={{ fontFamily: 'monospace' }} value={form.hwapi_field_map ?? ''} onChange={e => set('hwapi_field_map', e.target.value)} />
              <div className="muted">{'{"仕様書のXMLタグ名":"posting_no", …}'} の形。項目名は求人CSVと同じ（posting_no, company_name, prefecture, city, job_title, wage_min, expiry_date など）。複数タグの連結は "タグA+タグB"。</div>
            </div>
          </div>
        </Section>
      )}

      {tab === 'backup' && (
        <>
          <Section title="バックアップ設定" keys={['backup_dir', 'backup_keep']} {...common}>
            <div className="grid2">
              <In id="s-bdir" label="保存先フォルダ（外部媒体）" name="backup_dir" form={form} set={set} hint="空欄の場合はアプリ内の data/backups に保存" />
              <In id="s-bkeep" label="保持する世代数" name="backup_keep" type="number" min={1} max={365} suffix="世代" form={form} set={set} />
            </div>
          </Section>
          <Backups encrypted={data.backupEncrypted} backupDir={data.settings?.backup_dir} />
          <PurgeCandidates />
        </>
      )}

      {tab === 'log' && <AuditLog />}
    </div>
  );
}
