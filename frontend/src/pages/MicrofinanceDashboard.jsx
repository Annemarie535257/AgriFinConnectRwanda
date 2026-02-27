import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import {
  getMfiApplications,
  reviewMfiApplication,
  updateMfiApplicationStatus,
  getMfiPortfolio,
  downloadMfiApplicationPackage,
} from '../api/client';
import FloatingChatbot from '../components/FloatingChatbot';
import DashboardTopBar from '../components/DashboardTopBar';
import ApplicationTracker from '../components/ApplicationTracker';
import './Dashboard.css';
import './MicrofinanceDashboard.css';

const MFI_STATUS_OPTIONS = [
  { value: 'under_review', labelKey: 'mfi.underReview' },
  { value: 'documents_requested', labelKey: 'mfi.documentsRequested' },
  { value: 'approved', labelKey: 'tracker.approved' },
  { value: 'rejected', labelKey: 'tracker.rejected' },
];

export default function MicrofinanceDashboard() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab = (rawTab === 'applications' || rawTab === 'portfolio') ? rawTab : 'applications';
  const [applications, setApplications] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [downloadingPackageId, setDownloadingPackageId] = useState(null);
  const [statusForm, setStatusForm] = useState({}); // { [appId]: { status: '', note: '' } }

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMfiApplications(statusFilter);
      setApplications(res.applications || []);
    } catch (err) {
      setError(err.body?.error || err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const fetchPortfolio = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMfiPortfolio();
      setPortfolio(res);
    } catch (err) {
      setError(err.body?.error || err.message || 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'applications') fetchApplications();
    else if (activeTab === 'portfolio') fetchPortfolio();
  }, [activeTab, statusFilter]);

  const handleReview = async (appId, action, extra = {}) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await reviewMfiApplication(appId, action, extra);
      setSuccess(action === 'approve' ? 'Application approved.' : 'Application rejected.');
      fetchApplications();
      if (activeTab === 'portfolio') fetchPortfolio();
    } catch (err) {
      setError(err.body?.error || err.message || 'Failed to process');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (app) => {
    const form = statusForm[app.id] || {};
    const newStatus = form.status || app.status;
    if (!newStatus || newStatus === app.status) return;
    setUpdatingId(app.id);
    setError(null);
    setSuccess(null);
    try {
      const payload = { status: newStatus, note: form.note || '' };
      if (newStatus === 'approved') {
        payload.amount = app.recommended_amount || app.loan_amount_requested;
        payload.duration_months = app.loan_duration_months;
        payload.interest_rate = 0.12;
      }
      await updateMfiApplicationStatus(app.id, payload);
      setSuccess('Status updated.');
      setStatusForm((prev) => ({ ...prev, [app.id]: {} }));
      fetchApplications();
      if (activeTab === 'portfolio') fetchPortfolio();
    } catch (err) {
      setError(err.body?.error || err.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDownloadPackage = async (app) => {
    setDownloadingPackageId(app.id);
    setError(null);
    try {
      const { blob, contentDisposition } = await downloadMfiApplicationPackage(app.id);
      const inferred = /filename="?([^"]+)"?/i.exec(contentDisposition || '')?.[1];
      const filename = inferred || `${app.folder_name || `application_${app.id}`}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.body?.error || err.message || 'Failed to download package');
    } finally {
      setDownloadingPackageId(null);
    }
  };

  const pendingCount = applications.filter((a) => a.status === 'pending').length;
  const approvedCount = applications.filter((a) => a.status === 'approved').length;

  return (
    <div className="dashboard-page mfi-dashboard">
      <DashboardTopBar title={t('dashboard.microfinanceTitle')} />
      <div className="dashboard-content">
        {error && <div className="mfi-dashboard__message mfi-dashboard__message--error">{error}</div>}
        {success && <div className="mfi-dashboard__message mfi-dashboard__message--success">{success}</div>}
        {loading && (
          <div className="mfi-dashboard__loading" aria-live="polite">
            {t('getStarted.submitting') || 'Loading…'}
          </div>
        )}

        {/* Summary cards */}
        <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="dashboard-card">
            <h3 className="dashboard-card__title">{t('dashboard.reviewApplications')}</h3>
            <div className="dashboard-donut" style={{
              background: `conic-gradient(var(--color-primary) ${applications.length ? (approvedCount / applications.length) * 100 : 0}%, #e8eaed 0)`,
            }}>
              <span className="dashboard-donut__inner">{applications.length}</span>
            </div>
            <span className="dashboard-card__label">{t('mfi.pendingApplications')}</span>
          </div>
          <div className="dashboard-card">
            <h3 className="dashboard-card__title">{t('mfi.totalLoans')}</h3>
            <div className="dashboard-card__value">{portfolio?.total_loans ?? 0}</div>
            <span className="dashboard-card__label">{t('mfi.totalLoans')}</span>
          </div>
          <div className="dashboard-card">
            <h3 className="dashboard-card__title">{t('mfi.totalDisbursed')}</h3>
            <div className="dashboard-card__value dashboard-card__value--small">
              RWF {Number(portfolio?.total_amount_disbursed || 0).toLocaleString()}
            </div>
            <span className="dashboard-card__label">{t('mfi.totalDisbursed')}</span>
          </div>
        </div>

        {activeTab === 'applications' && (
          <section className="mfi-dashboard__section" aria-labelledby="mfi-apps-heading">
            <h2 id="mfi-apps-heading" className="mfi-dashboard__section-title">{t('mfi.pendingApplications')}</h2>
            <div className="mfi-dashboard__filters">
              <label>
                <span>{t('mfi.filterStatus')}:</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">{t('mfi.allStatuses') || 'All statuses'}</option>
                  <option value="pending">Pending</option>
                  <option value="under_review">{t('mfi.underReview')}</option>
                  <option value="documents_requested">{t('mfi.documentsRequested')}</option>
                  <option value="approved">{t('tracker.approved')}</option>
                  <option value="rejected">{t('tracker.rejected')}</option>
                </select>
              </label>
            </div>
            {applications.length === 0 ? (
              <p className="mfi-dashboard__empty">{t('mfi.noApplications')}</p>
            ) : (
              <div className="mfi-dashboard__list">
                {applications.map((app) => (
                  <div key={app.id} className="mfi-dashboard__card">
                    <div className="mfi-dashboard__folder-shell">
                      <div className="mfi-dashboard__folder-tab">{app.folder_name || `application_${app.id}`}</div>
                      <div className="mfi-dashboard__card-header">
                        <strong>#{app.id}</strong>
                      </div>
                    </div>
                    <p><strong>{app.user_name || app.user_email}</strong></p>
                    <p>Amount: RWF {Number(app.loan_amount_requested).toLocaleString()} · {app.loan_duration_months} months</p>
                    <p>Income: RWF {Number(app.annual_income).toLocaleString()} · Credit: {app.credit_score}</p>
                    {app.eligibility_approved != null && (
                      <p>AI Eligibility: {app.eligibility_approved ? t('card1.approved') : t('card1.denied')}</p>
                    )}
                    {app.eligibility_reason && <p className="mfi-dashboard__reason">{app.eligibility_reason}</p>}
                    {app.risk_score != null && <p>Risk score: {app.risk_score?.toFixed(2)}</p>}
                    {app.recommended_amount != null && (
                      <p>Recommended: RWF {Number(app.recommended_amount).toLocaleString()}</p>
                    )}
                    <p className="mfi-dashboard__date">{new Date(app.created_at).toLocaleDateString()}</p>

                    <div className="mfi-dashboard__package">
                      <p className="mfi-dashboard__package-date">
                        <strong>{t('mfi.applicationDateLabel') || 'Application date'}:</strong>{' '}
                        {new Date(app.created_at).toLocaleDateString()}
                      </p>
                      {app.documents?.length ? (
                        <ul className="mfi-dashboard__docs-list">
                          {app.documents.map((doc) => (
                            <li key={doc.id} className="mfi-dashboard__docs-item">
                              <span className="mfi-dashboard__docs-type">{doc.document_name || doc.document_type}</span>
                              {doc.file_url ? (
                                <a
                                  href={doc.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mfi-dashboard__docs-link"
                                >
                                  {doc.file_name || 'Open file'}
                                </a>
                              ) : (
                                <span className="mfi-dashboard__docs-missing">{t('mfi.noDocuments')}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mfi-dashboard__docs-empty">{t('mfi.noDocuments')}</p>
                      )}
                      <button
                        type="button"
                        className="mfi-dashboard__btn mfi-dashboard__btn--primary"
                        onClick={() => handleDownloadPackage(app)}
                        disabled={downloadingPackageId === app.id}
                      >
                        {downloadingPackageId === app.id
                          ? (t('getStarted.submitting') || 'Loading…')
                          : (t('mfi.downloadPackage') || 'Download package')}
                      </button>
                    </div>

                    <div className="mfi-dashboard__status-footer">
                      <span className="mfi-dashboard__status-footer-label">{t('mfi.currentStatusLabel') || 'Current status'}:</span>
                      <span className={`mfi-dashboard__status mfi-dashboard__status--${app.status}`}>{app.status.replace(/_/g, ' ')}</span>
                    </div>

                    <div className="mfi-dashboard__tracker">
                      <span className="mfi-dashboard__tracker-title">{t('mfi.statusHistory')}</span>
                      <ApplicationTracker statusHistory={app.status_history} currentStatus={app.status} compact />
                    </div>

                    {app.status !== 'approved' && app.status !== 'rejected' && (
                      <div className="mfi-dashboard__update-status">
                        <label>
                          <span>{t('mfi.updateStatus')}</span>
                          <select
                            value={statusForm[app.id]?.status ?? ''}
                            onChange={(e) => setStatusForm((prev) => ({
                              ...prev,
                              [app.id]: { ...prev[app.id], status: e.target.value },
                            }))}
                          >
                            <option value="">—</option>
                            {MFI_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span className="mfi-dashboard__note-label">{t('mfi.notePlaceholder')}</span>
                          <input
                            type="text"
                            placeholder={t('mfi.notePlaceholder')}
                            value={statusForm[app.id]?.note ?? ''}
                            onChange={(e) => setStatusForm((prev) => ({
                              ...prev,
                              [app.id]: { ...prev[app.id], note: e.target.value },
                            }))}
                            className="mfi-dashboard__note-input"
                          />
                        </label>
                        <button
                          type="button"
                          className="mfi-dashboard__btn mfi-dashboard__btn--primary"
                          onClick={() => handleUpdateStatus(app)}
                          disabled={loading || updatingId === app.id || !(statusForm[app.id]?.status && statusForm[app.id].status !== app.status)}
                        >
                          {updatingId === app.id ? (t('getStarted.submitting') || 'Updating…') : t('mfi.updateStatus')}
                        </button>
                      </div>
                    )}

                    {app.status === 'pending' && (
                      <div className="mfi-dashboard__actions">
                        <button
                          type="button"
                          className="mfi-dashboard__btn mfi-dashboard__btn--approve"
                          onClick={() => handleReview(app.id, 'approve', {
                            amount: app.recommended_amount || app.loan_amount_requested,
                            duration_months: app.loan_duration_months,
                          })}
                          disabled={loading}
                        >
                          {t('mfi.approve')}
                        </button>
                        <button
                          type="button"
                          className="mfi-dashboard__btn mfi-dashboard__btn--reject"
                          onClick={() => handleReview(app.id, 'reject', {
                            rejection_reason: 'Rejected by officer',
                          })}
                          disabled={loading}
                        >
                          {t('mfi.reject')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'portfolio' && (
          <section className="mfi-dashboard__section" aria-labelledby="mfi-portfolio-heading">
            <h2 id="mfi-portfolio-heading" className="mfi-dashboard__section-title">{t('mfi.portfolio')}</h2>
            {portfolio ? (
              <div className="mfi-dashboard__portfolio dashboard-grid">
                <div className="dashboard-card">
                  <h3 className="dashboard-card__title">{t('mfi.totalLoans')}</h3>
                  <div className="dashboard-card__value">{portfolio.total_loans}</div>
                </div>
                <div className="dashboard-card">
                  <h3 className="dashboard-card__title">{t('mfi.totalDisbursed')}</h3>
                  <div className="dashboard-card__value dashboard-card__value--small">
                    RWF {Number(portfolio.total_amount_disbursed).toLocaleString()}
                  </div>
                </div>
                {portfolio.repayments && (
                  <div className="dashboard-card dashboard-card--wide">
                    <h3 className="dashboard-card__title">Repayments</h3>
                    <div className="mfi-dashboard__repayments">
                      <span className="mfi-dashboard__rep-span">Paid: {portfolio.repayments.paid}</span>
                      <span className="mfi-dashboard__rep-span">Pending: {portfolio.repayments.pending}</span>
                      <span className="mfi-dashboard__rep-span">Overdue: {portfolio.repayments.overdue}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="mfi-dashboard__empty">{t('mfi.noApplications')}</p>
            )}
          </section>
        )}

        <FloatingChatbot />
      </div>
    </div>
  );
}
