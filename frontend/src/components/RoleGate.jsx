import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function RoleGate({ role, roles, children }) {
  const { user } = useAuth();
  const allowed = roles || (role ? [role] : []);

  if (!user || !allowed.includes(user.role)) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <div style={{ marginTop: 12, fontWeight: 600 }}>この画面を表示する権限がありません</div>
      </div>
    );
  }

  return children;
}
