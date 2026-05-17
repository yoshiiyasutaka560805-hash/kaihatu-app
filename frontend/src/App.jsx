import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AlertList from './pages/AlertList';
import SubsidyList from './pages/SubsidyList';
import SubsidyDetail from './pages/SubsidyDetail';
import MonthlyRecord from './pages/MonthlyRecord';
import LawUpdates from './pages/LawUpdates';
import ExportPage from './pages/ExportPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/alerts" element={<AlertList />} />
        <Route path="/subsidies" element={<SubsidyList />} />
        <Route path="/subsidies/:subsidyId/:serviceTypeId" element={<SubsidyDetail />} />
        <Route path="/monthly" element={<MonthlyRecord />} />
        <Route path="/law-updates" element={<LawUpdates />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
