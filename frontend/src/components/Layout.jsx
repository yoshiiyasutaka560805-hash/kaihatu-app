import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_SECTIONS = [
  {
    section: '介護保険加算',
    items: [
      { to: '/',             label: 'ダッシュボード', icon: '🏠' },
      { to: '/alerts',       label: 'アラート一覧',  icon: '🔴' },
      { to: '/subsidies',    label: '加算一覧',       icon: '📋' },
      { to: '/monthly',      label: '月次記録',       icon: '📅' },
      { to: '/law-updates',  label: '法改正情報',     icon: '📰' },
      { to: '/export',       label: '監査提出資料',   icon: '🖨️' },
    ],
  },
  {
    section: '特定技能外国人管理',
    items: [
      { to: '/workers', label: '従業員一覧', icon: '🌐' },
      { to: '/residence-alerts', label: '在留期限アラート', icon: '⏰' },
      { to: '/residence-cases', label: '案件管理', icon: '📁' },
      { to: '/tasks', label: 'タスク管理', icon: '✅' },
      { to: '/periodic-reports', label: '定期報告', icon: '📝' },
    ],
  },
];

const ADMIN_ITEMS = [
  { to: '/users', label: 'ユーザー管理', icon: '👤' },
];

const ROLE_LABEL = { admin: '管理者', staff: '担当者', viewer: '閲覧のみ' };

export default function Layout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar no-print">
        <div className="sidebar-header">
          介護保険加算<br />監査対応ツール
        </div>
        <nav>
          {NAV_SECTIONS.map(sec => (
            <div key={sec.section}>
              <div className="sidebar-section-label">{sec.section}</div>
              {sec.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => isActive ? 'active' : ''}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}

          {user?.role === 'admin' && (
            <div>
              <div className="sidebar-section-label">管理</div>
              {ADMIN_ITEMS.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => isActive ? 'active' : ''}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        {user && (
          <div className="sidebar-user no-print">
            <div style={{ fontSize: 12, fontWeight: 600 }}>{user.displayName}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{ROLE_LABEL[user.role] || user.role}</div>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }} onClick={logout}>
              ログアウト
            </button>
          </div>
        )}
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
