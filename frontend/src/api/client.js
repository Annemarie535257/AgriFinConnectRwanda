/**
 * API client for AgriFinConnect Rwanda backend.
 * Default: same-origin /api (frontend + backend on one server).
 * Override with VITE_API_URL when deploying frontend/backend on different hosts.
 */
const DEFAULT_API_BASE = '/api';
const OFFLINE_QUEUE_KEY = 'agrifinconnect-offline-queue-v1';

function normalizeApiBase(raw) {
  const value = String(raw || '').trim().replace(/^['\"]|['\"]$/g, '').replace(/\/+$/, '');
  if (!value) return '';
  if (!/^https?:\/\//i.test(value) && !value.startsWith('/')) return '';
  if (value.startsWith('/')) return value;
  return /\/api$/i.test(value) ? value : `${value}/api`;
}

function getApiBase() {
  const envApiBase = normalizeApiBase(import.meta.env.VITE_API_URL);
  if (envApiBase) return envApiBase;
  return DEFAULT_API_BASE;
}
const API_BASE = getApiBase();

function canQueueRequest(method, endpoint, body) {
  const m = (method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) return false;
  if (body instanceof FormData) return false;
  if (endpoint.startsWith('/auth/')) return false;
  return true;
}

function readOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOfflineQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage write failures.
  }
}

function enqueueOfflineRequest(endpoint, method, body) {
  const queue = readOfflineQueue();
  queue.push({
    endpoint,
    method,
    body,
    queuedAt: new Date().toISOString(),
  });
  writeOfflineQueue(queue);
}

async function performRequest(url, config) {
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

export async function flushOfflineQueue() {
  const queue = readOfflineQueue();
  if (!queue.length || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { processed: 0, remaining: queue.length };
  }

  const remaining = [];
  let processed = 0;
  for (const item of queue) {
    try {
      await request(
        item.endpoint,
        { method: item.method, body: item.body },
        { queueOnOffline: false }
      );
      processed += 1;
    } catch {
      remaining.push(item);
    }
  }

  writeOfflineQueue(remaining);
  return { processed, remaining: remaining.length };
}

async function request(endpoint, options = {}, requestOptions = {}) {
  const url = `${API_BASE}${endpoint}`;
  const isFormDataBody = options.body instanceof FormData;
  const method = (options.method || 'GET').toUpperCase();
  const config = {
    ...options,
    headers: {
      ...options.headers,
    },
  };
  if (!isFormDataBody && !config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  if (options.body && typeof options.body === 'object' && !isFormDataBody) {
    config.body = JSON.stringify(options.body);
  }

  try {
    return await performRequest(url, config);
  } catch (err) {
    const allowQueue = requestOptions.queueOnOffline !== false;
    const networkFailure = err && (err.name === 'TypeError' || err.status === undefined);
    if (allowQueue && networkFailure && canQueueRequest(method, endpoint, options.body)) {
      enqueueOfflineRequest(endpoint, method, options.body || null);
      const queueErr = new Error('No internet connection. Action saved and will sync when connection is restored.');
      queueErr.offlineQueued = true;
      throw queueErr;
    }
    throw err;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOfflineQueue().catch(() => {});
  });
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

/**
 * POST /api/fraud-detect/ — analyse a microfinance transaction for fraud risk (Model 4).
 * Required fields: TransactionAmount, AccountBalance, LoginAttempts, TransactionDuration,
 *   CustomerAge, TransactionType ('Credit'|'Debit'), Channel ('Online'|'ATM'|'Branch'),
 *   CustomerOccupation, TransactionDate (ISO string), PreviousTransactionDate (ISO string).
 * Returns: { is_fraud, fraud_probability, anomaly_score, risk_score, risk_level }
 */
export async function detectFraud(payload) {
  return request('/fraud-detect/', { method: 'POST', body: payload });
}

/**
 * POST /api/fraud-detect/statement/ — upload a PDF bank statement and get
 * fraud analysis for every extracted transaction.
 * @param {File} pdfFile
 * @param {{ customer_age?: number, occupation?: string }} opts
 */
export async function analyzeBankStatement(pdfFile, opts = {}) {
  const formData = new FormData();
  formData.append('file', pdfFile);
  if (opts.customer_age) formData.append('customer_age', String(opts.customer_age));
  if (opts.occupation)   formData.append('occupation', opts.occupation);
  return request('/fraud-detect/statement/', { method: 'POST', body: formData });
}

/**
 * POST /api/mfi/applications/<pk>/analyze-statement/
 * Run fraud analysis on the proof_of_income PDF already submitted by the farmer.
 * @param {number} appId
 */
export async function analyzeApplicationStatement(appId) {
  const token = localStorage.getItem('agrifinconnect-token');
  return request(`/mfi/applications/${appId}/analyze-statement/`, {
    method: 'POST',
    body: {},
    headers: token ? { Authorization: `Token ${token}` } : {},
  });
}

/** POST /.netlify/functions/chat (prod) or /api/chat/ (dev) */
export async function chat(message, language = 'en') {
  // In production (Netlify), use the serverless function to avoid Render's 30 s timeout.
  // In local dev, call the Django backend directly via Vite's /api proxy.
  const url = import.meta.env.PROD
    ? '/.netlify/functions/chat'
    : '/api/chat/';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, language }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Chat function error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/** POST /api/auth/register — register farmer or microfinance */
export async function register({ email, password, role, name }) {
  return request('/auth/register/', {
    method: 'POST',
    body: { email, password, role, name: name || '' },
  }, { queueOnOffline: false });
}

/** POST /api/auth/login — login (all roles) */
export async function login({ email, password }) {
  return request('/auth/login/', {
    method: 'POST',
    body: {
      email: (email || '').trim().toLowerCase(),
      password: password || '',
    },
  }, { queueOnOffline: false });
}

/** POST /api/auth/forgot-password — request password reset email */
export async function forgotPassword({ email }) {
  return request('/auth/forgot-password/', {
    method: 'POST',
    body: { email: (email || '').trim().toLowerCase() },
  }, { queueOnOffline: false });
}

/** POST /api/auth/reset-password — set new password with token */
export async function resetPassword({ token, newPassword }) {
  return request('/auth/reset-password/', {
    method: 'POST',
    body: { token: (token || '').trim(), new_password: newPassword },
  }, { queueOnOffline: false });
}

/** POST /api/fallback/sms — trigger SMS fallback notification. */
export async function sendSmsFallback({ toPhone, message, context = 'general' }) {
  return authRequest('/fallback/sms/', {
    method: 'POST',
    body: {
      to_phone: (toPhone || '').trim(),
      message: (message || '').trim(),
      context: (context || 'general').trim(),
    },
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
  const t = token || localStorage.getItem('agrifinconnect-token') || '';
  return request(`/admin/activity/?limit=${limit}`, {
    method: 'GET',
    headers: { Authorization: `Token ${t}` },
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
  const t = token || localStorage.getItem('agrifinconnect-token') || '';
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  params.set('limit', limit);
  return request(`/admin/users/?${params}`, {
    headers: { Authorization: `Token ${t}` },
  });
}

/** GET /api/admin/stats — dashboard stats (admin token) */
export async function getAdminStats(token) {
  const t = token || localStorage.getItem('agrifinconnect-token') || '';
  return request('/admin/stats/', {
    headers: { Authorization: `Token ${t}` },
  });
}

/** GET /api/admin/applications — all loan applications (admin token) */
export async function getAdminApplications(token, status = '', limit = 100) {
  const t = token || localStorage.getItem('agrifinconnect-token') || '';
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('limit', limit);
  return request(`/admin/applications/?${params}`, {
    headers: { Authorization: `Token ${t}` },
  });
}

/** GET /api/admin/applications/<id>/ — full application detail including documents */
export async function getAdminApplicationDetail(id) {
  const t = localStorage.getItem('agrifinconnect-token') || '';
  return request(`/admin/applications/${id}/`, {
    headers: { Authorization: `Token ${t}` },
  });
}

/** PATCH /api/admin/applications/<id>/status/ — update application status */
export async function updateAdminApplicationStatus(id, newStatus, rejectionReason = '') {
  const t = localStorage.getItem('agrifinconnect-token') || '';
  return request(`/admin/applications/${id}/status/`, {
    method: 'PATCH',
    headers: { Authorization: `Token ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus, rejection_reason: rejectionReason }),
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

/** PATCH /api/farmer/repayments/<id>/mark-paid/ */
export async function markRepaymentPaid(id) {
  return authRequest(`/farmer/repayments/${id}/mark-paid/`, { method: 'PATCH' });
}

// ----- MFI APIs -----

/** GET /api/mfi/applications */
export async function getMfiApplications(status = 'all') {
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

/** POST /api/mfi/applications/<id>/messages — send message to the farmer for this application */
export async function sendMfiApplicationMessage(id, message) {
  return authRequest(`/mfi/applications/${id}/messages/`, {
    method: 'POST',
    body: { message },
  });
}

/** GET /api/mfi/portfolio */
export async function getMfiPortfolio() {
  return authRequest('/mfi/portfolio/');
}

/** PATCH /api/mfi/repayments/<id>/mark-paid/ */
export async function mfiMarkRepaymentPaid(id) {
  return authRequest(`/mfi/repayments/${id}/mark-paid/`, { method: 'PATCH' });
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
