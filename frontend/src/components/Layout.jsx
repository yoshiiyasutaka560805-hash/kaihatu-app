import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/',             label: 'ダッシュボード', icon: '🏠' },
  { to: '/alerts',       label: 'アラート一覧',  icon: '🔴' },
  { to: '/subsidies',    label: '加算一覧',       icon: '📋' },
  { to: '/monthly',      label: '月次記録',       icon: '📅' },
  { to: '/law-updates',  label: '法改正情報',     icon: '📰' },
  { to: '/export',       label: '監査提出資料',   icon: '🖨️' },
];

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar no-print">
        <div className="sidebar-header">
          介護保険加算<br />監査対応ツール
        </div>
        <nav>
          {NAV_ITEMS.map(item => (
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
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
