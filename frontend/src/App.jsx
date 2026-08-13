import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import RoleGate from './components/RoleGate';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import AlertList from './pages/AlertList';
import SubsidyList from './pages/SubsidyList';
import SubsidyDetail from './pages/SubsidyDetail';
import MonthlyRecord from './pages/MonthlyRecord';
import LawUpdates from './pages/LawUpdates';
import ExportPage from './pages/ExportPage';
import UserManagement from './pages/UserManagement';
import WorkerList from './pages/WorkerList';
import WorkerNew from './pages/WorkerNew';
import WorkerDetail from './pages/WorkerDetail';
import ResidenceAlertList from './pages/ResidenceAlertList';
import ResidenceCaseList from './pages/ResidenceCaseList';
import ResidenceCaseDetail from './pages/ResidenceCaseDetail';
import TaskBoard from './pages/TaskBoard';

function AppLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/alerts" element={<AlertList />} />
          <Route path="/subsidies" element={<SubsidyList />} />
          <Route path="/subsidies/:subsidyId/:serviceTypeId" element={<SubsidyDetail />} />
          <Route path="/monthly" element={<MonthlyRecord />} />
          <Route path="/law-updates" element={<LawUpdates />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/workers" element={<WorkerList />} />
          <Route path="/workers/new" element={<WorkerNew />} />
          <Route path="/workers/:id" element={<WorkerDetail />} />
          <Route path="/residence-alerts" element={<ResidenceAlertList />} />
          <Route path="/residence-cases" element={<ResidenceCaseList />} />
          <Route path="/residence-cases/:id" element={<ResidenceCaseDetail />} />
          <Route path="/tasks" element={<TaskBoard />} />
          <Route
            path="/users"
            element={<RoleGate role="admin"><UserManagement /></RoleGate>}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
