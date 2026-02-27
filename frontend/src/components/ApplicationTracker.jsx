import { useLanguage } from '../context/LanguageContext';
import './ApplicationTracker.css';

const STATUS_ORDER = ['pending', 'under_review', 'documents_requested', 'approved', 'rejected'];

const statusLabelKey = {
  pending: 'tracker.pending',
  under_review: 'tracker.underReview',
  documents_requested: 'tracker.documentsRequested',
  approved: 'tracker.approved',
  rejected: 'tracker.rejected',
};

const statusDetailKey = {
  pending: 'tracker.pendingDetail',
};

/** Progress step 1–4 for the bar */
function getProgressStep(currentStatus) {
  if (!currentStatus) return 0;
  const i = STATUS_ORDER.indexOf(currentStatus);
  return i >= 0 ? i + 1 : 1;
}

/** Four steps for horizontal display: Submitted, Under review, Documents requested, Outcome */
function getHorizontalSteps(currentStatus) {
  const outcome = currentStatus === 'rejected' ? 'rejected' : 'approved';
  return [
    'pending',
    'under_review',
    'documents_requested',
    outcome,
  ];
}

const StepIcons = {
  pending: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  under_review: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  documents_requested: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M12 18v-6" />
      <path d="M9 15h6" />
    </svg>
  ),
  approved: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  rejected: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
};

export default function ApplicationTracker({ statusHistory, currentStatus, compact = false }) {
  const { t } = useLanguage();
  const steps = getHorizontalSteps(currentStatus);
  const progressStep = getProgressStep(currentStatus);
  const totalSteps = 4;
  const progressPercent = Math.min(100, Math.round((progressStep / totalSteps) * 100));
  const currentIndex = currentStatus ? STATUS_ORDER.indexOf(currentStatus) : 0;

  const getHistoryEntry = (status) => statusHistory?.find((h) => h.status === status);

  return (
    <div
      className={`application-tracker application-tracker--horizontal ${compact ? 'application-tracker--compact' : 'application-tracker--full'}`}
      role="region"
      aria-label={t('farmer.applicationProgress') || 'Application progress'}
      aria-live="polite"
    >
      {!compact && (
        <div className="application-tracker__progress-wrap">
          <div className="application-tracker__progress-header">
            <span className="application-tracker__progress-label">
              {t('tracker.stepProgress', 'Progress')}: {progressStep} {t('tracker.ofSteps', 'of')} {totalSteps} {t('tracker.steps', 'steps')}
            </span>
            <span className="application-tracker__progress-percent">{progressPercent}%</span>
          </div>
          <div
            className="application-tracker__progress-bar application-tracker__progress-bar--horizontal"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="application-tracker__progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      <div className="application-tracker__track">
        <div className="application-tracker__track-line" aria-hidden>
          <div className="application-tracker__track-line-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <ol className="application-tracker__timeline" role="list">
          {steps.map((status, index) => {
            const historyEntry = getHistoryEntry(status);
            const date = historyEntry?.created_at;
            const isDone = STATUS_ORDER.indexOf(status) < currentIndex || status === currentStatus;
            const isCurrent = status === currentStatus;
            const label = t(statusLabelKey[status]) || status.replace(/_/g, ' ');
            const detailKey = statusDetailKey[status];
            const detail = detailKey ? (t(detailKey) || '') : '';
            const Icon = StepIcons[status];

            return (
              <li
                key={`${status}-${index}`}
                className={`application-tracker__step ${isDone ? 'application-tracker__step--done' : ''} ${isCurrent ? 'application-tracker__step--current' : ''}`}
                role="listitem"
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div className="application-tracker__marker" aria-hidden>
                  {Icon}
                </div>
                <strong className="application-tracker__label">{label}</strong>
                {!compact && detail ? (
                  <span className="application-tracker__detail">{detail}</span>
                ) : null}
                {!compact && (
                  <span className="application-tracker__date">
                    {date
                      ? new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {!compact && steps.some((s) => getHistoryEntry(s)?.note) && (
        <div className="application-tracker__notes">
          {steps.map((status) => {
            const entry = getHistoryEntry(status);
            if (!entry?.note) return null;
            const label = t(statusLabelKey[status]) || status.replace(/_/g, ' ');
            return (
              <div key={status} className="application-tracker__note-block">
                <span className="application-tracker__note-label">{label}:</span>
                <p className="application-tracker__note-text">{entry.note}</p>
                {entry.updated_by_name && entry.updated_by_name !== 'System' && (
                  <span className="application-tracker__updated-by">
                    {t('tracker.updatedBy', 'Updated by')} {entry.updated_by_name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
