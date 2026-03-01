import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { getAdminActivity, getAdminUsers, getAdminStats } from '../api/client';
import DashboardTopBar from '../components/DashboardTopBar';
import './Dashboard.css';
import './AdminDashboard.css';

// Base URL for backend (Django admin link). Derive from API URL if only VITE_API_URL is set (e.g. on Netlify).
const API_URL = import.meta.env.VITE_API_URL || '/api';
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (API_URL.startsWith('http') ? API_URL.replace(/\/api\/?$/, '') : 'http://localhost:8080');

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab = (rawTab === 'activity' || rawTab === 'users' || rawTab === 'stats') ? rawTab : 'activity';
  const [activity, setActivity] = useState(null);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [adminToken, setAdminToken] = useState(() =>
    localStorage.getItem('agrifinconnect-token') || localStorage.getItem('agrifinconnect-admin-token') || ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [roleFilter, setRoleFilter] = useState('');

  const token = adminToken.trim();

  const fetchActivity = async () => {
    if (!token) {
      setError('Enter admin token to view activity');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminActivity(token);
      setActivity(data);
    } catch (err) {
      setError(err.status === 403 ? 'Admin access required' : err.status === 401 ? 'Invalid token' : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!token) {
      setError('Enter admin token to view users');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminUsers(token, roleFilter);
      setUsers(data.users || []);
    } catch (err) {
      setError(err.status === 403 ? 'Admin access required' : err.status === 401 ? 'Invalid token' : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!token) {
      setError('Enter admin token to view stats');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminStats(token);
      setStats(data);
    } catch (err) {
      setError(err.status === 403 ? 'Admin access required' : err.status === 401 ? 'Invalid token' : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const fetchByTab = () => {
    if (activeTab === 'activity') fetchActivity();
    else if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'stats') fetchStats();
  };

  useEffect(() => {
    if (token) localStorage.setItem('agrifinconnect-admin-token', token);
  }, [token]);

  useEffect(() => {
    if (token && activeTab) fetchByTab();
  }, [activeTab, token, roleFilter]);

  useEffect(() => {
    if (!token) return;
    getAdminStats(token).then(setStats).catch(() => {});
  }, [token]);

  const farmerCount = stats?.users?.farmers ?? 0;
  const mfiCount = stats?.users?.microfinance ?? 0;
  const pendingApps = stats?.applications?.pending ?? 0;

  return (
    <div className="dashboard-page admin-dashboard">
      <DashboardTopBar title={t('dashboard.adminTitle')} showSearch={false} />
      <div className="dashboard-content">
        <div className="admin-dashboard__token-bar">
          <input
            type="password"
            className="admin-dashboard__token-input"
            placeholder="Admin token (from login)"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            aria-label="Admin API token"
          />
          <button
            type="button"
            className="admin-dashboard__refresh-btn"
            onClick={fetchByTab}
            disabled={loading || !token}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {error && <div className="admin-dashboard__error">{error}</div>}

        {/* Summary cards */}
        {stats && (
          <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="dashboard-card">
              <h3 className="dashboard-card__title">Farmers</h3>
              <div className="dashboard-card__value">{farmerCount}</div>
              <span className="dashboard-card__label">Registered farmers</span>
            </div>
            <div className="dashboard-card">
              <h3 className="dashboard-card__title">Microfinance</h3>
              <div className="dashboard-card__value">{mfiCount}</div>
              <span className="dashboard-card__label">MFI users</span>
            </div>
            <div className="dashboard-card">
              <h3 className="dashboard-card__title">Pending</h3>
              <div className="dashboard-donut" style={{
                background: `conic-gradient(var(--color-primary) ${pendingApps ? 50 : 0}%, #e8eaed 0)`,
              }}>
                <span className="dashboard-donut__inner">{pendingApps}</span>
              </div>
              <span className="dashboard-card__label">Applications</span>
            </div>
            <div className="dashboard-card">
              <h3 className="dashboard-card__title">Approved / Rejected</h3>
              <div className="dashboard-card__value dashboard-card__value--small">
                {stats?.applications?.approved ?? 0} / {stats?.applications?.rejected ?? 0}
              </div>
              <span className="dashboard-card__label">Applications</span>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <section className="admin-dashboard__section" aria-labelledby="activity-heading">
            <h2 id="activity-heading" className="admin-dashboard__section-title">{t('admin.activity')}</h2>
            <p className="admin-dashboard__hint">
              View when visitors open the Get Started modal or click Register/Login.{' '}
              <a href={`${BACKEND_URL}/admin/`} target="_blank" rel="noopener noreferrer">Django admin</a>
            </p>
            {activity && (
              <div className="admin-dashboard__table-wrap">
                <table className="admin-dashboard__table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Role</th>
                      <th>IP</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.events?.map((e) => (
                      <tr key={e.id}>
                        <td>{e.event_type}</td>
                        <td>{e.role || '—'}</td>
                        <td>{e.ip_address || '—'}</td>
                        <td>{e.created_at ? new Date(e.created_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(activity.events?.length || 0) === 0 && (
                  <p className="admin-dashboard__empty">No events yet.</p>
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === 'users' && (
          <section className="admin-dashboard__section" aria-labelledby="users-heading">
            <h2 id="users-heading" className="admin-dashboard__section-title">{t('dashboard.users')}</h2>
            <div className="admin-dashboard__filters">
              <label>
                Role:
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="">All</option>
                  <option value="farmer">Farmer</option>
                  <option value="microfinance">Microfinance</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>
            {users.length > 0 ? (
              <div className="admin-dashboard__table-wrap">
                <table className="admin-dashboard__table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Email</th>
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
                        <td>{u.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="admin-dashboard__empty">No users or enter token to load.</p>
            )}
          </section>
        )}

        {activeTab === 'stats' && (
          <section className="admin-dashboard__section" aria-labelledby="stats-heading">
            <h2 id="stats-heading" className="admin-dashboard__section-title">{t('admin.stats')}</h2>
            {stats ? (
              <div className="admin-dashboard__stats dashboard-grid">
                <div className="dashboard-card">
                  <span className="dashboard-card__title">Farmers</span>
                  <span className="dashboard-card__value">{stats.users?.farmers ?? 0}</span>
                </div>
                <div className="dashboard-card">
                  <span className="dashboard-card__title">Microfinance</span>
                  <span className="dashboard-card__value">{stats.users?.microfinance ?? 0}</span>
                </div>
                <div className="dashboard-card">
                  <span className="dashboard-card__title">Pending</span>
                  <span className="dashboard-card__value">{stats.applications?.pending ?? 0}</span>
                </div>
                <div className="dashboard-card">
                  <span className="dashboard-card__title">Approved</span>
                  <span className="dashboard-card__value">{stats.applications?.approved ?? 0}</span>
                </div>
                <div className="dashboard-card">
                  <span className="dashboard-card__title">Rejected</span>
                  <span className="dashboard-card__value">{stats.applications?.rejected ?? 0}</span>
                </div>
              </div>
            ) : (
              <p className="admin-dashboard__empty">Enter token and click Refresh to load stats.</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
