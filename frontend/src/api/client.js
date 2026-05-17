const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
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
};
