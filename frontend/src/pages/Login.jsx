import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    const from = location.state?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'ログインに失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f3f4f6' }}>
      <form className="card" onSubmit={handleSubmit} style={{ width: 340 }}>
        <div className="card-title">kaihatu-app ログイン</div>
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: -4, marginBottom: 16 }}>
          社内管理システムへのログインが必要です
        </p>

        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', fontSize: 13, padding: 8, borderRadius: 6, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">ユーザー名</label>
          <input
            className="form-input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">パスワード</label>
          <input
            type="password"
            className="form-input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>
          {submitting ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
    </div>
  );
}
