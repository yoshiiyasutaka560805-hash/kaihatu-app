import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getOperator, setOperator, post } from '../api/client';
import { useMeta } from '../hooks/useApi';

const NAV_ITEMS = [
  { to: '/',            label: '今日のタスク', icon: '✅' },
  { to: '/seekers',     label: '求職者',       icon: '👤' },
  { to: '/postings',    label: '求人',         icon: '📋' },
  { to: '/employers',   label: '事業所',       icon: '🏢' },
  { to: '/placements',  label: '成約・請求',   icon: '🤝' },
  { to: '/drafts',      label: '承認待ち',     icon: '📝' },
  { to: '/reports',     label: '帳簿・報告',   icon: '📚' },
  { to: '/complaints',  label: '苦情受付簿',   icon: '📮' },
  { to: '/settings',    label: '設定・ログ',   icon: '⚙️' },
];

export default function Layout({ children }) {
  const meta = useMeta();
  const [op, setOp] = useState(getOperator());
  useEffect(() => {
    if (!op && meta?.operators?.length) { setOperator(meta.operators[0]); setOp(meta.operators[0]); }
  }, [meta, op]);

  return (
    <div className="app-shell">
      <aside className="sidebar no-print">
        <div className="sidebar-header">株式会社リアネット<br />求職者マッチング</div>
        <nav>
          {NAV_ITEMS.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span>{item.icon}</span>{item.label}
            </NavLink>
          ))}
          <a href="/intake" onClick={async e => {
            e.preventDefault();
            if (!window.confirm('職員画面をロックして受付フォームを開きます（戻るにはパスワードが必要です）。よろしいですか？')) return;
            await post('/auth/logout').catch(() => {});
            window.location.href = '/intake';
          }}><span>🖊️</span>受付フォーム（ロックして開く）</a>
        </nav>
        <div className="sidebar-foot">
          <label>操作者
            <select value={op} onChange={e => { setOperator(e.target.value); setOp(e.target.value); }}>
              {(meta?.operators || [op]).filter(Boolean).map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
          <button type="button" className="btn btn-sm btn-outline lock-btn" onClick={async () => { await post('/auth/logout').catch(() => {}); window.location.href = '/'; }}>🔒 ロック</button>
          <div>判定・AIの結果は補助情報です。紹介の可否は担当者が最終確認してください。</div>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
