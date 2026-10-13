import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Settings() {
  const [s, setS] = useState(null);
  const [log, setLog] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSettings().then(setS).catch(e => setError(e.message));
    api.getAuditLog().then(setLog);
  }, []);

  if (!s) return <div className="loading">{error || '読み込み中…'}</div>;
  const set = (k, v) => setS(x => ({ ...x, [k]: v }));
  const flag = k => (
    <input type="checkbox" checked={s[k] === '1'} onChange={e => set(k, e.target.checked ? '1' : '0')} />
  );

  async function save() {
    setMsg(''); setError('');
    try {
      const { ai_available, ai_model, ...data } = s;
      await api.saveSettings(data);
      setMsg('保存しました');
      api.getAuditLog().then(setLog);
    } catch (e) { setError(e.message); }
  }

  return (
    <>
      <div className="page-header"><h1 className="page-title">設定・ログ</h1></div>

      <div className="card">
        <div className="card-title">マッチング判定</div>
        <div className="grid2">
          <div className="form-group">
            <label className="form-label">候補として残す最低点</label>
            <input className="form-input" type="number" value={s.match_min_score} onChange={e => set('match_min_score', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">AI補足の対象件数（上位N件）</label>
            <input className="form-input" type="number" value={s.ai_top_n} onChange={e => set('ai_top_n', e.target.value)} />
          </div>
        </div>
        <label className="checkbox">{flag('ai_enabled')}AI補足を使用する</label>
        <p className="muted">
          APIキー：{s.ai_available ? '設定済み' : '未設定（環境変数 ANTHROPIC_API_KEY）'}／モデル：{s.ai_model}
          ／求職者ごとのAI利用同意がある場合のみ送信します
        </p>
      </div>

      <div className="card">
        <div className="card-title">ハローワーク求人・求職情報提供サービス（利用承認後）</div>
        <label className="checkbox">{flag('provision_enabled')}提供データの定期取込を有効にする</label>
        <div className="form-group">
          <label className="form-label">提供CSVの配置フォルダ（取込後は imported/ へ移動）</label>
          <input className="form-input" value={s.provision_dir} onChange={e => set('provision_dir', e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">自動巡回（既定：無効）</div>
        <div className="alert-banner yellow">
          ハローワークインターネットサービスの利用規約上、機械的な取得が認められるか未確認です。
          運営元への確認が取れるまで有効化しないでください。巡回処理（画面解析部）は確認後に実装します。
        </div>
        <label className="checkbox">{flag('crawler_terms_confirmed')}利用規約・運営元への確認済み（確認日・確認先を監査ログに残すこと）</label>
        <label className="checkbox">{flag('crawler_enabled')}自動巡回を有効にする</label>
        <div className="grid2">
          <div className="form-group">
            <label className="form-label">巡回先URL</label>
            <input className="form-input" value={s.crawler_base_url} onChange={e => set('crawler_base_url', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">実行スケジュール（cron式・既定 毎日2:30）</label>
            <input className="form-input" value={s.crawler_cron} onChange={e => set('crawler_cron', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">リクエスト間隔（ms、最低3000）</label>
            <input className="form-input" type="number" value={s.crawler_interval_ms} onChange={e => set('crawler_interval_ms', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">巡回条件（JSON配列。例：[{'{'}"prefecture":"大阪府","city":"堺市","category":"介護"{'}'}]）</label>
          <textarea className="form-textarea" value={s.crawler_conditions} onChange={e => set('crawler_conditions', e.target.value)} />
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {msg && <div className="alert-banner blue">{msg}</div>}
      <button className="btn btn-primary" onClick={save}>設定を保存</button>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">操作ログ（直近200件・個人情報の取扱い記録）</div>
        <table className="table">
          <thead><tr><th>日時</th><th>操作</th><th>対象</th><th>詳細</th></tr></thead>
          <tbody>
            {log.map(l => <tr key={l.id}><td>{l.at}</td><td>{l.action}</td><td>{l.target}</td><td className="muted">{l.detail}</td></tr>)}
          </tbody>
        </table>
      </div>
    </>
  );
}
