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
  getSeekers:   ()         => request('/seekers'),
  getSeeker:    (id)       => request(`/seekers/${id}`),
  createSeeker: (data)     => request('/seekers', { method: 'POST', body: data }),
  updateSeeker: (id, data) => request(`/seekers/${id}`, { method: 'PUT', body: data }),
  deleteSeeker: (id)       => request(`/seekers/${id}`, { method: 'DELETE' }),

  runMatching:  (seekerId, withAi = true) => request('/matches/run', { method: 'POST', body: { seekerId, withAi } }),
  getMatches:   (seekerId) => request(`/matches?seekerId=${seekerId}`),
  setIntroStatus: (id, intro_status) => request(`/matches/${id}/status`, { method: 'PUT', body: { intro_status } }),

  getPostings: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/postings${qs ? `?${qs}` : ''}`);
  },
  addPosting:   (data)  => request('/postings', { method: 'POST', body: data }),
  setPostingActive: (id, active) => request(`/postings/${id}/active`, { method: 'PUT', body: { active } }),
  getFetchRuns: ()      => request('/postings/runs'),
  fetchNow:     ()      => request('/postings/fetch-now', { method: 'POST' }),
  importCsv: (file) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE}/postings/import-csv`, { method: 'POST', body: form }).then(async r => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      return j;
    });
  },

  getSettings:  ()     => request('/settings'),
  saveSettings: (data) => request('/settings', { method: 'PUT', body: data }),
  getAuditLog:  ()     => request('/settings/audit-log'),
};
