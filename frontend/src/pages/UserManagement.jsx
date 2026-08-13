import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

const ROLE_LABEL = { admin: '管理者', staff: '担当者', viewer: '閲覧のみ' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  function reload() {
    return api.getUsers().then(setUsers);
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  async function handleCreate(form) {
    setError('');
    try {
      await api.createUser(form);
      setShowForm(false);
      await reload();
    } catch (err) {
      setError(err.message || '作成に失敗しました');
    }
  }

  async function handleResetPassword(userId) {
    const newPassword = window.prompt('新しい初期パスワードを入力してください（8文字以上）');
    if (!newPassword) return;
    try {
      await api.resetUserPassword(userId, newPassword);
      window.alert('パスワードをリセットしました。次回ログイン時に変更が必要になります。');
    } catch (err) {
      window.alert('リセットに失敗しました: ' + err.message);
    }
  }

  async function handleToggleActive(user) {
    try {
      if (user.is_active) {
        await api.deactivateUser(user.id);
      } else {
        await api.activateUser(user.id);
      }
      await reload();
    } catch (err) {
      window.alert('更新に失敗しました: ' + err.message);
    }
  }

  if (loading) return <div className="loading">読み込み中...</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">ユーザー管理</div>
        <div className="page-subtitle">システムを利用するユーザーとロールの管理</div>
      </div>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>ユーザー一覧</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? '閉じる' : '＋ 新規ユーザー'}
          </button>
        </div>

        {showForm && <NewUserForm onSubmit={handleCreate} error={error} />}

        <table className="table">
          <thead>
            <tr>
              <th>ユーザー名</th>
              <th>表示名</th>
              <th>ロール</th>
              <th>状態</th>
              <th>最終ログイン</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.display_name}</td>
                <td>{ROLE_LABEL[u.role] || u.role}</td>
                <td>{u.is_active ? '有効' : '無効'}</td>
                <td>{u.last_login_at || '-'}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => handleResetPassword(u.id)}>
                    パスワードリセット
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => handleToggleActive(u)}>
                    {u.is_active ? '無効化' : '有効化'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewUserForm({ onSubmit, error }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [initialPassword, setInitialPassword] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      username,
      display_name: displayName,
      email,
      role,
      initial_password: initialPassword,
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '16px 0', marginBottom: 12 }}>
      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', fontSize: 13, padding: 8, borderRadius: 6, marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">ユーザー名</label>
          <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">表示名</label>
          <input className="form-input" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">メールアドレス</label>
          <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">ロール</label>
          <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
            <option value="admin">管理者</option>
            <option value="staff">担当者</option>
            <option value="viewer">閲覧のみ</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">初期パスワード（8文字以上）</label>
          <input
            type="text"
            className="form-input"
            value={initialPassword}
            onChange={e => setInitialPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
      </div>
      <button type="submit" className="btn btn-primary btn-sm">作成</button>
    </form>
  );
}
