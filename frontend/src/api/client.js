const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('未ログインです');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  login:  (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  logout: ()                   => request('/auth/logout', { method: 'POST' }),
  getMe:  ()                   => request('/auth/me'),
  changeMyPassword: (currentPassword, newPassword) =>
    request('/auth/me/password', { method: 'PUT', body: { currentPassword, newPassword } }),

  getUsers:            ()             => request('/users'),
  createUser:          (data)         => request('/users', { method: 'POST', body: data }),
  updateUser:          (id, data)     => request(`/users/${id}`, { method: 'PUT', body: data }),
  resetUserPassword:   (id, newPassword) => request(`/users/${id}/reset-password`, { method: 'PUT', body: { new_password: newPassword } }),
  deactivateUser:      (id)           => request(`/users/${id}/deactivate`, { method: 'PUT' }),
  activateUser:        (id)           => request(`/users/${id}/activate`, { method: 'PUT' }),

  getDashboard:    ()          => request('/dashboard'),
  getAlerts:       ()          => request('/dashboard/alerts'),
  getServiceTypes: ()          => request('/service-types'),
  getSettings:     ()          => request('/settings'),
  saveSettings:    (data)      => request('/settings', { method: 'PUT', body: data }),

  getSubsidies: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/subsidies${qs ? `?${qs}` : ''}`);
  },
  getSubsidyDetail: (subsidyId, serviceTypeId) =>
    request(`/subsidies/${subsidyId}/service-types/${serviceTypeId}`),

  updateAssessment: (id, data)  => request(`/assessments/${id}`, { method: 'PUT', body: data }),
  createAssessment: (data)      => request('/assessments', { method: 'POST', body: data }),
  saveReqChecks:   (id, checks) => request(`/assessments/${id}/requirement-checks`, { method: 'POST', body: { checks } }),
  saveEvidChecks:  (id, checks) => request(`/assessments/${id}/evidence-checks`, { method: 'POST', body: { checks } }),

  uploadFile: (assessmentId, evidenceDefId, file, note = '') => {
    const form = new FormData();
    form.append('file', file);
    if (note) form.append('note', note);
    return fetch(`/api/assessments/${assessmentId}/evidence/${evidenceDefId}/files`, {
      method: 'POST', body: form,
    }).then(r => r.json());
  },
  deleteFile:  (fileId)  => request(`/files/${fileId}`, { method: 'DELETE' }),

  getMonthly:  (year_month) => request(`/monthly?year_month=${year_month}`),
  saveMonthly: (records)   => request('/monthly', { method: 'PUT', body: { records } }),

  getLawAlerts: (all = false) => request(`/law-alerts${all ? '?acknowledged=all' : ''}`),
  acknowledgeLawAlert: (id)   => request(`/law-alerts/${id}/acknowledge`, { method: 'PUT' }),
  checkLawUpdatesNow:  ()     => request('/law-alerts/check-now', { method: 'POST' }),

  getNotifications: (subsidyId, serviceTypeId) =>
    request(`/notifications?subsidy_id=${subsidyId}&service_type_id=${serviceTypeId}`),
  addNotification: (data) => request('/notifications', { method: 'POST', body: data }),
  deleteNotification: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),

  getDeductions: (activeOnly = true) =>
    request(`/deductions${activeOnly ? '?active=1' : ''}`),
  addDeduction:    (data) => request('/deductions', { method: 'POST', body: data }),
  resolveDeduction: (id, data) => request(`/deductions/${id}/resolve`, { method: 'PUT', body: data }),

  getWorkers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/workers${qs ? `?${qs}` : ''}`);
  },
  getWorker:       (id)       => request(`/workers/${id}`),
  createWorker:    (data)     => request('/workers', { method: 'POST', body: data }),
  updateWorker:    (id, data) => request(`/workers/${id}`, { method: 'PUT', body: data }),
  deactivateWorker: (id)      => request(`/workers/${id}/deactivate`, { method: 'PUT' }),

  getWorkerNotes:  (workerId)       => request(`/workers/${workerId}/notes`),
  addWorkerNote:   (workerId, data) => request(`/workers/${workerId}/notes`, { method: 'POST', body: data }),
  updateWorkerNote: (workerId, noteId, data) => request(`/workers/${workerId}/notes/${noteId}`, { method: 'PUT', body: data }),
  deleteWorkerNote: (workerId, noteId) => request(`/workers/${workerId}/notes/${noteId}`, { method: 'DELETE' }),

  uploadWorkerFile: (workerId, category, file, note = '') => {
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    if (note) form.append('note', note);
    return fetch(`/api/workers/${workerId}/files`, { method: 'POST', body: form })
      .then(r => r.json());
  },
  deleteWorkerFile: (workerId, fileId) => request(`/workers/${workerId}/files/${fileId}`, { method: 'DELETE' }),
  workerFileDownloadUrl: (workerId, fileId) => `/api/workers/${workerId}/files/${fileId}/download`,

  getResidenceAlerts: (all = false) => request(`/residence-alerts${all ? '?acknowledged=all' : ''}`),
  acknowledgeResidenceAlert: (id) => request(`/residence-alerts/${id}/acknowledge`, { method: 'PUT' }),
  checkResidenceAlertsNow: () => request('/residence-alerts/check-now', { method: 'POST' }),

  getSpecificSkillDashboard: () => request('/dashboard/specific-skill'),

  getResidenceCases: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/residence-cases${qs ? `?${qs}` : ''}`);
  },
  getResidenceCase:    (id)       => request(`/residence-cases/${id}`),
  createResidenceCase: (data)     => request('/residence-cases', { method: 'POST', body: data }),
  updateResidenceCase: (id, data) => request(`/residence-cases/${id}`, { method: 'PUT', body: data }),
  updateResidenceCaseStage: (id, stage, comment) =>
    request(`/residence-cases/${id}/stage`, { method: 'PUT', body: { stage, comment } }),
  getCaseDocumentItems: (caseType) => request(`/residence-cases/case-document-items/${caseType}`),
  saveCaseDocumentChecks: (id, checks) =>
    request(`/residence-cases/${id}/document-checks`, { method: 'POST', body: { checks } }),

  getTasks:   (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tasks${qs ? `?${qs}` : ''}`);
  },
  getTask:        (id)       => request(`/tasks/${id}`),
  createTask:     (data)     => request('/tasks', { method: 'POST', body: data }),
  updateTask:     (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: data }),
  updateTaskStatus: (id, status) => request(`/tasks/${id}/status`, { method: 'PUT', body: { status } }),
  deleteTask:     (id)       => request(`/tasks/${id}`, { method: 'DELETE' }),
  addTaskComment: (id, comment) => request(`/tasks/${id}/comments`, { method: 'POST', body: { comment } }),

  getSupportPlanItems: () => request('/support-plans/items'),
  getWorkerSupportPlan: (workerId) => request(`/workers/${workerId}/support-plan`),
  saveSupportPlanChecks: (workerId, checks) =>
    request(`/workers/${workerId}/support-plan/checks`, { method: 'POST', body: { checks } }),
  saveSupportEvidenceChecks: (workerId, checkId, checks) =>
    request(`/workers/${workerId}/support-plan/checks/${checkId}/evidence-checks`, { method: 'POST', body: { checks } }),
  uploadSupportEvidenceFile: (workerId, checkId, file, note = '') => {
    const form = new FormData();
    form.append('file', file);
    form.append('category', 'support_evidence');
    form.append('related_check_id', checkId);
    if (note) form.append('note', note);
    return fetch(`/api/workers/${workerId}/files`, { method: 'POST', body: form }).then(r => r.json());
  },

  getPeriodicReports: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/periodic-reports${qs ? `?${qs}` : ''}`);
  },
  getPeriodicReport:    (id)       => request(`/periodic-reports/${id}`),
  createPeriodicReport: (data)     => request('/periodic-reports', { method: 'POST', body: data }),
  updatePeriodicReport: (id, data) => request(`/periodic-reports/${id}`, { method: 'PUT', body: data }),
  exportPeriodicReport: (id)       => request(`/periodic-reports/${id}/export`),
};
