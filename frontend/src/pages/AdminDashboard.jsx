import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import {
  getAdminActivity, getAdminUsers, getAdminStats, getAdminApplications,
  getAdminApplicationDetail, updateAdminApplicationStatus,
} from '../api/client';
import DashboardTopBar from '../components/DashboardTopBar';
import './Dashboard.css';
import './AdminDashboard.css';

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.PROD ? 'https://agrifinconnectrwanda.onrender.com' : 'http://localhost:8080');

const STATUS_BADGE = {
  pending: 'badge--pending',
  under_review: 'badge--review',
  approved: 'badge--approved',
  rejected: 'badge--rejected',
  documents_requested: 'badge--docs',
};

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab = ['overview', 'applications', 'users', 'activity'].includes(rawTab) ? rawTab : 'overview';

  const [activity, setActivity] = useState(null);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [roleFilter, setRoleFilter] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('');

  // Detail panel state
  const [selectedApp, setSelectedApp] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [statusEdit, setStatusEdit] = useState('');
  const [rejectionEdit, setRejectionEdit] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusSaved, setStatusSaved] = useState(false);

  const handleErr = (err) => {
    if (err.status === 403) setError('Admin access required. Please log in as admin.');
    else if (err.status === 401) setError('Session expired. Please log in again.');
    else setError('Failed to load data. Check that the backend server is running.');
  };

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (err) {
      handleErr(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminApplications(null, appStatusFilter);
      setApplications(data.applications || []);
    } catch (err) {
      handleErr(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminUsers(null, roleFilter);
      setUsers(data.users || []);
    } catch (err) {
      handleErr(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminActivity();
      setActivity(data);
    } catch (err) {
      handleErr(err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (appId) => {
    setDetailError(null);
    setStatusSaved(false);
    setDetailLoading(true);
    try {
      const data = await getAdminApplicationDetail(appId);
      setSelectedApp(data);
      setStatusEdit(data.status || '');
      setRejectionEdit(data.rejection_reason || '');
    } catch (err) {
      setDetailError('Could not load application detail.');
      setSelectedApp(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedApp(null);
    setDetailError(null);
    setStatusSaved(false);
  };

  const saveStatus = async () => {
    if (!selectedApp) return;
    setStatusSaving(true);
    setStatusSaved(false);
    try {
      await updateAdminApplicationStatus(selectedApp.id, statusEdit, rejectionEdit);
      setStatusSaved(true);
      setSelectedApp((prev) => ({ ...prev, status: statusEdit, rejection_reason: rejectionEdit }));
      // Refresh the applications list row too
      setApplications((prev) =>
        prev.map((a) => (a.id === selectedApp.id ? { ...a, status: statusEdit } : a))
      );
    } catch {
      setDetailError('Failed to update status.');
    } finally {
      setStatusSaving(false);
    }
  };

  const fetchByTab = () => {
    if (activeTab === 'overview') fetchStats();
    else if (activeTab === 'applications') fetchApplications();
    else if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'activity') fetchActivity();
  };

  useEffect(() => {
    fetchByTab();
    // Always keep stats fresh for the top cards
    if (activeTab !== 'overview') getAdminStats().then(setStats).catch(() => {});
  }, [activeTab, roleFilter, appStatusFilter]);

  const farmerCount = stats?.users?.farmers ?? 0;
  const mfiCount = stats?.users?.microfinance ?? 0;
  const pendingApps = stats?.applications?.pending ?? 0;
  const approvedApps = stats?.applications?.approved ?? 0;
  const rejectedApps = stats?.applications?.rejected ?? 0;

  return (
    <div className="dashboard-page admin-dashboard">
      <DashboardTopBar title="Admin Dashboard" showSearch={false} />
      <div className="dashboard-content">

        {/* Top action bar */}
        <div className="admin-dashboard__action-bar">
          <a
            href={`${BACKEND_URL}/admin/`}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-dashboard__django-btn"
          >
            Open Django Admin ↗
          </a>
          <button
            type="button"
            className="admin-dashboard__refresh-btn"
            onClick={fetchByTab}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {error && <div className="admin-dashboard__error">{error}</div>}

        {/* Summary stat cards — always visible */}
        <div className="admin-dashboard__stat-row">
          <div className="admin-dashboard__stat-card admin-dashboard__stat-card--blue">
            <span className="admin-dashboard__stat-icon">🌾</span>
            <div>
              <div className="admin-dashboard__stat-value">{farmerCount}</div>
              <div className="admin-dashboard__stat-label">Farmers</div>
            </div>
          </div>
          <div className="admin-dashboard__stat-card admin-dashboard__stat-card--green">
            <span className="admin-dashboard__stat-icon">🏦</span>
            <div>
              <div className="admin-dashboard__stat-value">{mfiCount}</div>
              <div className="admin-dashboard__stat-label">Microfinance Institutions</div>
            </div>
          </div>
          <div className="admin-dashboard__stat-card admin-dashboard__stat-card--orange">
            <span className="admin-dashboard__stat-icon">⏳</span>
            <div>
              <div className="admin-dashboard__stat-value">{pendingApps}</div>
              <div className="admin-dashboard__stat-label">Pending Applications</div>
            </div>
          </div>
          <div className="admin-dashboard__stat-card admin-dashboard__stat-card--teal">
            <span className="admin-dashboard__stat-icon">✅</span>
            <div>
              <div className="admin-dashboard__stat-value">{approvedApps}</div>
              <div className="admin-dashboard__stat-label">Approved</div>
            </div>
          </div>
          <div className="admin-dashboard__stat-card admin-dashboard__stat-card--red">
            <span className="admin-dashboard__stat-icon">❌</span>
            <div>
              <div className="admin-dashboard__stat-value">{rejectedApps}</div>
              <div className="admin-dashboard__stat-label">Rejected</div>
            </div>
          </div>
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <section className="admin-dashboard__section" aria-labelledby="overview-heading">
            <h2 id="overview-heading" className="admin-dashboard__section-title">Platform Overview</h2>
            {stats ? (
              <div className="admin-dashboard__overview-grid">
                <div className="admin-dashboard__overview-card">
                  <h3 className="admin-dashboard__overview-card-title">Users</h3>
                  <ul className="admin-dashboard__overview-list">
                    <li><span>Farmers</span><strong>{stats.users?.farmers ?? 0}</strong></li>
                    <li><span>Microfinance</span><strong>{stats.users?.microfinance ?? 0}</strong></li>
                    <li className="admin-dashboard__overview-list-total"><span>Total</span><strong>{(stats.users?.farmers ?? 0) + (stats.users?.microfinance ?? 0)}</strong></li>
                  </ul>
                </div>
                <div className="admin-dashboard__overview-card">
                  <h3 className="admin-dashboard__overview-card-title">Loan Applications</h3>
                  <ul className="admin-dashboard__overview-list">
                    <li><span>Pending</span><strong className="text-orange">{stats.applications?.pending ?? 0}</strong></li>
                    <li><span>Approved</span><strong className="text-green">{stats.applications?.approved ?? 0}</strong></li>
                    <li><span>Rejected</span><strong className="text-red">{stats.applications?.rejected ?? 0}</strong></li>
                    <li className="admin-dashboard__overview-list-total"><span>Total</span><strong>{(stats.applications?.pending ?? 0) + (stats.applications?.approved ?? 0) + (stats.applications?.rejected ?? 0)}</strong></li>
                  </ul>
                </div>
                <div className="admin-dashboard__overview-card">
                  <h3 className="admin-dashboard__overview-card-title">Quick Links</h3>
                  <ul className="admin-dashboard__overview-list admin-dashboard__overview-links">
                    <li><a href={`${BACKEND_URL}/admin/`} target="_blank" rel="noopener noreferrer">Django Admin Panel ↗</a></li>
                    <li><a href={`${BACKEND_URL}/api/docs/`} target="_blank" rel="noopener noreferrer">API Documentation ↗</a></li>
                    <li><a href={`${BACKEND_URL}/admin/auth/user/`} target="_blank" rel="noopener noreferrer">Manage Users ↗</a></li>
                    <li><a href={`${BACKEND_URL}/admin/api/loanapplication/`} target="_blank" rel="noopener noreferrer">All Loan Applications ↗</a></li>
                  </ul>
                </div>
              </div>
            ) : (
              <p className="admin-dashboard__empty">{loading ? 'Loading overview…' : 'Could not load stats.'}</p>
            )}
          </section>
        )}

        {/* ── APPLICATIONS TAB ── */}
        {activeTab === 'applications' && (
          <section className="admin-dashboard__section" aria-labelledby="apps-heading">
            <h2 id="apps-heading" className="admin-dashboard__section-title">All Loan Applications</h2>
            <div className="admin-dashboard__filters">
              <label htmlFor="app-status-filter">Status:</label>
              <select
                id="app-status-filter"
                value={appStatusFilter}
                onChange={(e) => setAppStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="documents_requested">Documents Requested</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            {applications.length > 0 ? (
              <div className="admin-dashboard__table-wrap">
                <table className="admin-dashboard__table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Applicant</th>
                      <th>Amount (RWF)</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((a) => (
                      <tr key={a.id} className={selectedApp?.id === a.id ? 'admin-dashboard__tr--selected' : ''}>
                        <td>{a.id}</td>
                        <td>{a.user_email}</td>
                        <td>{Number(a.loan_amount_requested).toLocaleString()}</td>
                        <td>{a.loan_duration_months} mo</td>
                        <td>
                          <span className={`admin-dashboard__badge ${STATUS_BADGE[a.status] || ''}`}>
                            {a.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>{a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-dashboard__view-btn"
                            onClick={() => openDetail(a.id)}
                          >
                            View ↗
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="admin-dashboard__empty">{loading ? 'Loading…' : 'No applications found.'}</p>
            )}

            {/* ── Application Detail Drawer ── */}
            {(detailLoading || selectedApp) && (
              <div className="admin-dashboard__detail-overlay" onClick={closeDetail}>
                <aside
                  className="admin-dashboard__detail-panel"
                  onClick={(e) => e.stopPropagation()}
                  aria-labelledby="detail-heading"
                >
                  <button type="button" className="admin-dashboard__detail-close" onClick={closeDetail}>✕ Close</button>

                  {detailLoading && <p className="admin-dashboard__empty">Loading application…</p>}
                  {detailError && <p className="admin-dashboard__error">{detailError}</p>}

                  {selectedApp && !detailLoading && (
                    <>
                      <h2 id="detail-heading" className="admin-dashboard__detail-title">
                        Application #{selectedApp.id}
                      </h2>

                      {/* ── Applicant Info ── */}
                      <div className="admin-dashboard__detail-section">
                        <h3 className="admin-dashboard__detail-group-title">Applicant</h3>
                        <dl className="admin-dashboard__detail-grid">
                          <dt>Username</dt><dd>{selectedApp.user_email}</dd>
                          <dt>Full Name</dt><dd>{selectedApp.user_name || '—'}</dd>
                          <dt>Age</dt><dd>{selectedApp.age}</dd>
                          <dt>Marital Status</dt><dd>{selectedApp.marital_status}</dd>
                          <dt>Education</dt><dd>{selectedApp.education_level}</dd>
                          <dt>Employment</dt><dd>{selectedApp.employment_status}</dd>
                        </dl>
                      </div>

                      {/* ── Loan Details ── */}
                      <div className="admin-dashboard__detail-section">
                        <h3 className="admin-dashboard__detail-group-title">Loan Details</h3>
                        <dl className="admin-dashboard__detail-grid">
                          <dt>Amount Requested</dt><dd><strong>RWF {Number(selectedApp.loan_amount_requested).toLocaleString()}</strong></dd>
                          <dt>Duration</dt><dd>{selectedApp.loan_duration_months} months</dd>
                          <dt>Purpose</dt><dd>{selectedApp.loan_purpose}</dd>
                          <dt>Annual Income</dt><dd>RWF {Number(selectedApp.annual_income).toLocaleString()}</dd>
                          <dt>Credit Score</dt><dd>{selectedApp.credit_score}</dd>
                          <dt>Applied On</dt><dd>{selectedApp.created_at ? new Date(selectedApp.created_at).toLocaleString() : '—'}</dd>
                        </dl>
                      </div>

                      {/* ── Farming Context ── */}
                      <div className="admin-dashboard__detail-section">
                        <h3 className="admin-dashboard__detail-group-title">Farming Context</h3>
                        <dl className="admin-dashboard__detail-grid">
                          <dt>Crops / Activity</dt><dd>{selectedApp.farming_crops_or_activity || '—'}</dd>
                          <dt>Land Size</dt><dd>{selectedApp.farming_land_size_hectares != null ? `${selectedApp.farming_land_size_hectares} ha` : '—'}</dd>
                          <dt>Season</dt><dd>{selectedApp.farming_season || '—'}</dd>
                          <dt>Est. Yield (kg)</dt><dd>{selectedApp.farming_estimated_yield != null ? Number(selectedApp.farming_estimated_yield).toLocaleString() : '—'}</dd>
                          <dt>Livestock</dt><dd>{selectedApp.farming_livestock || '—'}</dd>
                          {selectedApp.farming_notes && (<><dt>Notes</dt><dd>{selectedApp.farming_notes}</dd></>)}
                        </dl>
                      </div>

                      {/* ── AI Assessment ── */}
                      <div className="admin-dashboard__detail-section">
                        <h3 className="admin-dashboard__detail-group-title">AI Assessment</h3>
                        <dl className="admin-dashboard__detail-grid">
                          <dt>Eligibility</dt>
                          <dd>
                            {selectedApp.eligibility_approved === null ? '—' : (
                              <span className={`admin-dashboard__badge ${selectedApp.eligibility_approved ? 'badge--approved' : 'badge--rejected'}`}>
                                {selectedApp.eligibility_approved ? 'Approved' : 'Rejected'}
                              </span>
                            )}
                          </dd>
                          <dt>Risk Score</dt>
                          <dd>
                            {selectedApp.risk_score != null ? (
                              <span className={`admin-dashboard__badge ${
                                selectedApp.risk_score < 0.3 ? 'badge--approved'
                                : selectedApp.risk_score < 0.6 ? 'badge--review'
                                : 'badge--rejected'
                              }`}>
                                {(selectedApp.risk_score * 100).toFixed(1)}%
                              </span>
                            ) : '—'}
                          </dd>
                          <dt>Recommended Amount</dt>
                          <dd>{selectedApp.recommended_amount != null ? `RWF ${Number(selectedApp.recommended_amount).toLocaleString()}` : '—'}</dd>
                          <dt>Eligibility Reason</dt>
                          <dd className="admin-dashboard__detail-reason">{selectedApp.eligibility_reason || '—'}</dd>
                        </dl>
                      </div>

                      {/* ── Documents ── */}
                      <div className="admin-dashboard__detail-section">
                        <h3 className="admin-dashboard__detail-group-title">Submitted Documents</h3>
                        {selectedApp.documents?.length > 0 ? (
                          <ul className="admin-dashboard__doc-list">
                            {selectedApp.documents.map((doc) => (
                              <li key={doc.id} className="admin-dashboard__doc-item">
                                <span className="admin-dashboard__doc-type">{doc.document_type_display}</span>
                                {doc.file_url ? (
                                  <a
                                    href={doc.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="admin-dashboard__doc-link"
                                  >
                                    View / Download ↗
                                  </a>
                                ) : (
                                  <span className="admin-dashboard__doc-missing">No file</span>
                                )}
                                <span className="admin-dashboard__doc-date">
                                  {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="admin-dashboard__empty admin-dashboard__empty--sm">No documents uploaded yet.</p>
                        )}
                      </div>

                      {/* ── Status Update ── */}
                      <div className="admin-dashboard__detail-section admin-dashboard__detail-section--action">
                        <h3 className="admin-dashboard__detail-group-title">Update Status</h3>
                        <div className="admin-dashboard__status-form">
                          <label htmlFor="status-edit">New Status</label>
                          <select
                            id="status-edit"
                            value={statusEdit}
                            onChange={(e) => setStatusEdit(e.target.value)}
                          >
                            <option value="pending">Pending</option>
                            <option value="under_review">Under Review</option>
                            <option value="documents_requested">Documents Requested</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                          {statusEdit === 'rejected' && (
                            <>
                              <label htmlFor="rejection-edit">Rejection Reason</label>
                              <textarea
                                id="rejection-edit"
                                value={rejectionEdit}
                                onChange={(e) => setRejectionEdit(e.target.value)}
                                rows={3}
                                placeholder="State the reason for rejection…"
                              />
                            </>
                          )}
                          <button
                            type="button"
                            className="admin-dashboard__save-btn"
                            onClick={saveStatus}
                            disabled={statusSaving}
                          >
                            {statusSaving ? 'Saving…' : 'Save Status'}
                          </button>
                          {statusSaved && (
                            <span className="admin-dashboard__saved-msg">✓ Status updated</span>
                          )}
                        </div>
                        {selectedApp.reviewed_by && (
                          <p className="admin-dashboard__review-meta">
                            Last reviewed by <strong>{selectedApp.reviewed_by}</strong>
                            {selectedApp.reviewed_at ? ` on ${new Date(selectedApp.reviewed_at).toLocaleString()}` : ''}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </aside>
              </div>
            )}
          </section>
        )}

        {/* ── USERS TAB ── */}
        {activeTab === 'users' && (
          <section className="admin-dashboard__section" aria-labelledby="users-heading">
            <h2 id="users-heading" className="admin-dashboard__section-title">Registered Users</h2>
            <div className="admin-dashboard__filters">
              <label htmlFor="role-filter">Role:</label>
              <select
                id="role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="farmer">Farmer</option>
                <option value="microfinance">Microfinance</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {users.length > 0 ? (
              <div className="admin-dashboard__table-wrap">
                <table className="admin-dashboard__table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Email / Username</th>
                      <th>Name</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>{u.email}</td>
                        <td>{u.name || '—'}</td>
                        <td>
                          <span className={`admin-dashboard__badge ${u.role === 'farmer' ? 'badge--approved' : u.role === 'microfinance' ? 'badge--review' : 'badge--pending'}`}>
                            {u.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="admin-dashboard__empty">{loading ? 'Loading…' : 'No users found.'}</p>
            )}
          </section>
        )}

        {/* ── ACTIVITY TAB ── */}
        {activeTab === 'activity' && (
          <section className="admin-dashboard__section" aria-labelledby="activity-heading">
            <h2 id="activity-heading" className="admin-dashboard__section-title">Site Activity Log</h2>
            <p className="admin-dashboard__hint">
              Tracks when visitors open the Get Started modal or click Register / Login.
            </p>
            {activity ? (
              <div className="admin-dashboard__table-wrap">
                <table className="admin-dashboard__table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Role</th>
                      <th>IP Address</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.events?.map((e) => (
                      <tr key={e.id}>
                        <td>{e.event_type?.replace(/_/g, ' ')}</td>
                        <td>{e.role || '—'}</td>
                        <td>{e.ip_address || '—'}</td>
                        <td>{e.created_at ? new Date(e.created_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(activity.events?.length || 0) === 0 && (
                  <p className="admin-dashboard__empty">No activity events yet.</p>
                )}
              </div>
            ) : (
              <p className="admin-dashboard__empty">{loading ? 'Loading…' : 'No activity data.'}</p>
            )}
          </section>
        )}

      </div>
    </div>
  );
}
