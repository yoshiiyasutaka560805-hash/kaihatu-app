import React, { useCallback, useEffect, useState } from 'react';
import { get, onUnauthorized } from './api/client';
import Login from './pages/Login';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import SeekerList from './pages/SeekerList';
import SeekerEdit from './pages/SeekerEdit';
import MatchResults from './pages/MatchResults';
import ProposalPrint from './pages/ProposalPrint';
import Postings from './pages/Postings';
import PostingDetail from './pages/PostingDetail';
import Employers from './pages/Employers';
import EmployerEdit from './pages/EmployerEdit';
import Placements from './pages/Placements';
import PlacementDetail from './pages/PlacementDetail';
import Drafts from './pages/Drafts';
import Reports from './pages/Reports';
import Complaints from './pages/Complaints';
import Settings from './pages/Settings';
import Intake from './pages/Intake';

export default function App() {
  const { pathname } = useLocation();
  const [auth, setAuth] = useState(null);
  const check = useCallback(() => get('/auth/status').then(setAuth).catch(() => setAuth({ setup: true, loggedIn: false })), []);
  useEffect(() => { check(); return onUnauthorized(() => setAuth(a => ({ ...(a || { setup: true }), loggedIn: false }))); }, [check]);

  // 本人入力の受付フォームはログイン不要・サイドメニューなし
  if (pathname.startsWith('/intake')) return <Intake />;
  if (!auth) return <div className="loading">読み込み中…</div>;
  if (!auth.loggedIn) return <Login setup={!auth.setup} onDone={check} />;
  if (/^\/proposals\/\d+/.test(pathname)) return <Routes><Route path="/proposals/:id" element={<ProposalPrint />} /></Routes>;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/seekers" element={<SeekerList />} />
        <Route path="/seekers/new" element={<SeekerEdit />} />
        <Route path="/seekers/:id" element={<SeekerEdit />} />
        <Route path="/seekers/:id/matches" element={<MatchResults />} />
        <Route path="/postings" element={<Postings />} />
        <Route path="/postings/new" element={<PostingDetail />} />
        <Route path="/postings/:id" element={<PostingDetail />} />
        <Route path="/employers" element={<Employers />} />
        <Route path="/employers/new" element={<EmployerEdit />} />
        <Route path="/employers/:id" element={<EmployerEdit />} />
        <Route path="/placements" element={<Placements />} />
        <Route path="/placements/:id" element={<PlacementDetail />} />
        <Route path="/drafts" element={<Drafts />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/complaints" element={<Complaints />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
