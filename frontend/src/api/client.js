/**
 * API client for AgriFinConnect Rwanda backend.
 * Dev: Vite proxy /api. Production: VITE_API_URL or live Render API.
 */
const LIVE_API_BASE = 'https://agrifinconnectrwanda.onrender.com/api';
const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? LIVE_API_BASE : '/api');

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, config);
  if (!res.ok) {
    const err = new Error(res.statusText || 'API error');
    err.status = res.status;
    try {
      err.body = await res.json();
    } catch {
      err.body = await res.text();
    }
    if (res.status === 400 && import.meta.env.DEV) {
      console.warn('[API 400]', url, err.body);
    }
    throw err;
  }
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

/** POST /api/eligibility — loan eligibility prediction (Model 1). Optional language: en | fr | rw */
export async function predictEligibility(payload, language = 'en') {
  const body = { ...payload, language: language || 'en' };
  return request('/eligibility/', { method: 'POST', body });
}

/** POST /api/risk — default risk score (Model 2). Optional language: en | fr | rw */
export async function predictRisk(payload, language = 'en') {
  const body = { ...payload, language: language || 'en' };
  return request('/risk/', { method: 'POST', body });
}

/** POST /api/recommend-amount — recommended loan amount (Model 3). Optional language: en | fr | rw */
export async function recommendLoanAmount(payload, language = 'en') {
  const body = { ...payload, language: language || 'en' };
  return request('/recommend-amount/', { method: 'POST', body });
}

/** POST /api/chat — chatbot (multilingual) */
export async function chat(message, language = 'en') {
  return request('/chat/', { method: 'POST', body: { message, language } });
}

/** POST /api/auth/register — register farmer or microfinance */
export async function register({ email, password, role, name }) {
  return request('/auth/register/', {
    method: 'POST',
    body: { email, password, role, name: name || '' },
  });
}

/** POST /api/auth/login — login (all roles) */
export async function login({ email, password }) {
  return request('/auth/login/', {
    method: 'POST',
    body: {
      email: (email || '').trim().toLowerCase(),
      password: password || '',
    },
  });
}

/** POST /api/auth/forgot-password — request password reset email */
export async function forgotPassword({ email }) {
  return request('/auth/forgot-password/', {
    method: 'POST',
    body: { email: (email || '').trim().toLowerCase() },
  });
}

/** POST /api/auth/reset-password — set new password with token */
export async function resetPassword({ token, newPassword }) {
  return request('/auth/reset-password/', {
    method: 'POST',
    body: { token: (token || '').trim(), new_password: newPassword },
  });
}

/** POST /api/activity/log — log Get Started activity (no auth). Fire-and-forget. */
export async function logGetStartedActivity(eventType, role = '') {
  try {
    await fetch(`${API_BASE}/activity/log/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, role }),
    });
  } catch {
    // Silently ignore; analytics should not block UX
  }
}

/** GET /api/admin/activity — list Get Started events (admin token required) */
export async function getAdminActivity(token, limit = 100) {
  return request(`/admin/activity/?limit=${limit}`, {
    method: 'GET',
    headers: { Authorization: `Token ${token}` },
  });
}

/** Authenticated request helper */
function authRequest(endpoint, options = {}) {
  const token = localStorage.getItem('agrifinconnect-token');
  const headers = {
    ...options.headers,
    Authorization: token ? `Token ${token}` : '',
  };
  return request(endpoint, { ...options, headers });
}

/** GET /api/admin/users — list users (admin token) */
export async function getAdminUsers(token, role = '', limit = 50) {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  params.set('limit', limit);
  return request(`/admin/users/?${params}`, {
    headers: { Authorization: `Token ${token}` },
  });
}

/** GET /api/admin/stats — dashboard stats (admin token) */
export async function getAdminStats(token) {
  return request('/admin/stats/', {
    headers: { Authorization: `Token ${token}` },
  });
}

// ----- Farmer APIs -----

/** GET /api/farmer/profile */
export async function getFarmerProfile() {
  return authRequest('/farmer/profile/');
}

/** PATCH /api/farmer/profile */
export async function updateFarmerProfile(data) {
  return authRequest('/farmer/profile/', { method: 'PATCH', body: data });
}

/** GET /api/farmer/required-documents — required documents for Rwanda loan applications */
export async function getRequiredDocuments(language = 'en') {
  const lang = (language || 'en').toLowerCase();
  const param = ['en', 'fr', 'rw'].includes(lang) ? lang : 'en';
  return request(`/farmer/required-documents/?language=${param}`);
}

/** GET /api/farmer/applications */
export async function getFarmerApplications() {
  return authRequest('/farmer/applications/');
}

/** POST /api/farmer/applications — submit new loan application */
export async function submitFarmerApplication(data) {
  return authRequest('/farmer/applications/', { method: 'POST', body: data });
}

/** GET /api/farmer/applications/<id>/documents/ */
export async function getApplicationDocuments(applicationId) {
  return authRequest(`/farmer/applications/${applicationId}/documents/`);
}

/** POST /api/farmer/applications/<id>/documents/ — multipart: document_type, file */
export async function uploadApplicationDocument(applicationId, documentType, file) {
  const token = localStorage.getItem('agrifinconnect-token');
  const form = new FormData();
  form.append('document_type', documentType);
  form.append('file', file);
  const url = `${API_BASE}/farmer/applications/${applicationId}/documents/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: token ? `Token ${token}` : '' },
    body: form,
  });
  if (!res.ok) {
    const err = new Error(res.statusText || 'Upload failed');
    err.status = res.status;
    try {
      err.body = await res.json();
    } catch {
      err.body = await res.text();
    }
    throw err;
  }
  return res.json();
}

/** GET /api/farmer/applications/<id>/package — download ZIP (summary PDF + uploaded docs) */
export async function downloadFarmerApplicationPackage(id) {
  const token = localStorage.getItem('agrifinconnect-token');
  const url = `${API_BASE}/farmer/applications/${id}/package/`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: token ? `Token ${token}` : '' },
  });
  if (!res.ok) {
    const err = new Error(res.statusText || 'Download failed');
    err.status = res.status;
    try {
      err.body = await res.json();
    } catch {
      err.body = await res.text();
    }
    throw err;
  }
  return {
    blob: await res.blob(),
    contentDisposition: res.headers.get('content-disposition') || '',
  };
}

/** GET /api/farmer/loans */
export async function getFarmerLoans() {
  return authRequest('/farmer/loans/');
}

/** GET /api/farmer/repayments */
export async function getFarmerRepayments() {
  return authRequest('/farmer/repayments/');
}

// ----- MFI APIs -----

/** GET /api/mfi/applications */
export async function getMfiApplications(status = 'pending') {
  return authRequest(`/mfi/applications/?status=${status}`);
}

/** POST /api/mfi/applications/<id>/review — approve or reject */
export async function reviewMfiApplication(id, action, data = {}) {
  return authRequest(`/mfi/applications/${id}/review/`, {
    method: 'POST',
    body: { action, ...data },
  });
}

/** POST /api/mfi/applications/<id>/update-status — set status (under_review, documents_requested, approved, rejected) + optional note */
export async function updateMfiApplicationStatus(id, { status, note, amount, interest_rate, duration_months } = {}) {
  return authRequest(`/mfi/applications/${id}/update-status/`, {
    method: 'POST',
    body: { status, note, amount, interest_rate, duration_months },
  });
}

/** GET /api/mfi/portfolio */
export async function getMfiPortfolio() {
  return authRequest('/mfi/portfolio/');
}

/** GET /api/mfi/applications/<id>/package — download ZIP (summary PDF + uploaded docs) */
export async function downloadMfiApplicationPackage(id) {
  const token = localStorage.getItem('agrifinconnect-token');
  const url = `${API_BASE}/mfi/applications/${id}/package/`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: token ? `Token ${token}` : '' },
  });
  if (!res.ok) {
    const err = new Error(res.statusText || 'Download failed');
    err.status = res.status;
    try {
      err.body = await res.json();
    } catch {
      err.body = await res.text();
    }
    throw err;
  }
  return {
    blob: await res.blob(),
    contentDisposition: res.headers.get('content-disposition') || '',
  };
}
