import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import SeekerList from './pages/SeekerList';
import SeekerEdit from './pages/SeekerEdit';
import MatchResults from './pages/MatchResults';
import Postings from './pages/Postings';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<SeekerList />} />
        <Route path="/seekers/new" element={<SeekerEdit />} />
        <Route path="/seekers/:id" element={<SeekerEdit />} />
        <Route path="/seekers/:id/matches" element={<MatchResults />} />
        <Route path="/postings" element={<Postings />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
