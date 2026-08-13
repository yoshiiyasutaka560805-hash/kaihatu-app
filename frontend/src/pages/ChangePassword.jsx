import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function ChangePassword() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('新しいパスワードは8文字以上で入力してください');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('新しいパスワードが一致しません');
      return;
    }

    setSubmitting(true);
    try {
      await api.changeMyPassword(currentPassword, newPassword);
      setUser({ ...user, mustChangePassword: false });
      navigate('/');
    } catch (err) {
      setError(err.message || 'パスワード変更に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">パスワード変更</div>
        <div className="page-subtitle">
          {user?.mustChangePassword
            ? '初回ログインのため、パスワードの変更が必要です'
            : 'パスワードを変更します'}
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', fontSize: 13, padding: 8, borderRadius: 6, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {!user?.mustChangePassword && (
          <div className="form-group">
            <label className="form-label">現在のパスワード</label>
            <input
              type="password"
              className="form-input"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">新しいパスワード（8文字以上）</label>
          <input
            type="password"
            className="form-input"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">新しいパスワード（確認）</label>
          <input
            type="password"
            className="form-input"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? '変更中...' : 'パスワードを変更'}
        </button>
      </form>
    </div>
  );
}
