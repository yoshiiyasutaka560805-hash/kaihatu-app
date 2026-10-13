import React from 'react';
import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/',          label: '求職者',   icon: '👤' },
  { to: '/postings',  label: '求人DB',   icon: '📋' },
  { to: '/settings',  label: '設定・ログ', icon: '⚙️' },
];

export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          株式会社リアネット<br />求職者マッチング
        </div>
        <nav>
          {NAV_ITEMS.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}
              className={({ isActive }) => isActive ? 'active' : ''}>
              <span>{item.icon}</span>{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">判定は補助情報です。紹介の可否は担当者が最終確認してください。</div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
