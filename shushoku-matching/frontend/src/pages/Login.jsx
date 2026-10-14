import React, { useState } from 'react';
import { post } from '../api/client';
import { ErrorText } from '../components/ui';

// 職員ログイン（初回はパスワード設定）
export default function Login({ setup, onDone }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (setup && pw !== pw2) return setError('確認用のパスワードが一致しません');
    setBusy(true);
    try {
      await post(setup ? '/auth/setup' : '/auth/login', { password: pw });
      onDone();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <h1 className="page-title">求職者マッチング</h1>
        <p className="muted">株式会社Lienet（リアネット） 職員用</p>
        {setup && <div className="warn-box">初回起動です。職員用パスワード（8文字以上）を設定してください。受付フォームを開くと職員画面はロックされ、このパスワードで解除します。</div>}
        <div className="form-group">
          <label className="form-label" htmlFor="pw">パスワード</label>
          <input id="pw" className="form-input" type="password" autoComplete={setup ? 'new-password' : 'current-password'} autoFocus value={pw} onChange={e => setPw(e.target.value)} />
        </div>
        {setup && (
          <div className="form-group">
            <label className="form-label" htmlFor="pw2">パスワード（確認）</label>
            <input id="pw2" className="form-input" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} />
          </div>
        )}
        <ErrorText error={error} />
        <button className="btn btn-primary" type="submit" disabled={busy || !pw}>{setup ? '設定してはじめる' : 'ログイン'}</button>
        <p className="muted" style={{ marginTop: 12 }}><a href="/intake">求職者の方はこちら（受付フォーム）</a></p>
      </form>
    </div>
  );
}
