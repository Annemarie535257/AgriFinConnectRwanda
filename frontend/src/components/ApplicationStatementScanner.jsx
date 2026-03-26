import { useState } from 'react';
import { analyzeApplicationStatement } from '../api/client';
import './BankStatementAnalyzer.css';
import './ApplicationStatementScanner.css';

const RISK_COLOR = { LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444' };

// ── Small inline result component ────────────────────────────────────────────
function StatementResult({ result }) {
  const [filterLevel, setFilterLevel] = useState('all');
  const color = RISK_COLOR[result.statement_risk_level] || '#94a3b8';

  const displayedTx = filterLevel === 'all'
    ? result.transactions
    : result.transactions.filter((tx) => tx.risk_level === filterLevel);

  return (
    <div className="ass-result">
      {/* Verdict banner */}
      <div className={`bsa-verdict bsa-verdict--${result.statement_is_fraud ? 'fraud' : 'clean'}`}>
        <div className="bsa-verdict__icon">{result.statement_is_fraud ? '⚠' : '✓'}</div>
        <div className="bsa-verdict__body">
          <span className="bsa-verdict__label">
            {result.statement_is_fraud ? 'FRAUDULENT STATEMENT' : 'STATEMENT APPEARS CLEAN'}
          </span>
          <span className="bsa-verdict__sub">
            {result.statement_is_fraud
              ? `${result.flagged_count} of ${result.total_transactions} transactions flagged · worst score ${result.statement_risk_score?.toFixed(1)}/100 (${result.statement_risk_level}) · fraud ratio ${(result.fraud_ratio * 100).toFixed(1)}%`
              : `All ${result.total_transactions} transactions passed · max score ${result.statement_risk_score?.toFixed(1)}/100 (${result.statement_risk_level})`}
          </span>
        </div>
        <div className="bsa-verdict__score" style={{ color }}>
          {result.statement_risk_score?.toFixed(1)}<small>/100</small>
        </div>
      </div>

      {/* Worst transaction */}
      {result.statement_is_fraud && result.worst_transaction && (
        <div className="bsa-worst">
          <span className="bsa-worst__title">Most suspicious</span>
          <span className="bsa-worst__date">{result.worst_transaction.date}</span>
          <span className="bsa-worst__desc">{result.worst_transaction.description || '—'}</span>
          <span className="bsa-worst__amount">RWF {result.worst_transaction.amount?.toLocaleString()}</span>
          <span className="bsa-worst__score" style={{ color: RISK_COLOR[result.worst_transaction.risk_level] }}>
            Score {result.worst_transaction.risk_score?.toFixed(1)} · {result.worst_transaction.risk_level}
          </span>
        </div>
      )}

      {/* Stats + filter + table (collapsible) */}
      {result.transactions.length > 0 && (
        <details className="ass-result__detail">
          <summary className="ass-result__summary">
            View all {result.total_transactions} transactions
            <span className="ass-result__pill ass-result__pill--warn">{result.flagged_count} flagged</span>
            <span className="ass-result__pill ass-result__pill--danger">{result.high_risk_count} high-risk</span>
          </summary>

          <div className="bsa-filter" style={{ marginTop: '0.75rem' }}>
            <span>Show:</span>
            {['all', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`bsa-filter__btn ${filterLevel === lvl ? 'bsa-filter__btn--active' : ''}`}
                onClick={() => setFilterLevel(lvl)}
              >
                {lvl === 'all' ? 'All' : lvl}
                {lvl !== 'all' && (
                  <span className="bsa-filter__count">
                    {result.transactions.filter((tx) => tx.risk_level === lvl).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="bsa-table-wrap">
            <table className="bsa-table">
              <thead>
                <tr>
                  <th>#</th><th>Date</th><th>Description</th><th>Type</th>
                  <th>Amount (RWF)</th><th>Balance (RWF)</th><th>Risk</th><th>Flag</th>
                </tr>
              </thead>
              <tbody>
                {displayedTx.map((tx) => (
                  <tr key={tx.index} className={tx.is_fraud ? 'bsa-row--flagged' : ''}>
                    <td>{tx.index}</td>
                    <td className="bsa-td--date">{tx.date}</td>
                    <td className="bsa-td--desc" title={tx.description}>{tx.description || '—'}</td>
                    <td>
                      <span className={`bsa-badge bsa-badge--${tx.tx_type.toLowerCase()}`}>{tx.tx_type}</span>
                    </td>
                    <td className="bsa-td--num">{tx.amount?.toLocaleString()}</td>
                    <td className="bsa-td--num">{tx.balance?.toLocaleString()}</td>
                    <td>
                      <span className="bsa-risk-tag" style={{ color: RISK_COLOR[tx.risk_level], borderColor: RISK_COLOR[tx.risk_level] }}>
                        {tx.risk_score?.toFixed(1)} · {tx.risk_level}
                      </span>
                    </td>
                    <td className="bsa-td--flag">
                      {tx.is_fraud
                        ? <span className="bsa-flag bsa-flag--yes">⚠ Fraud</span>
                        : <span className="bsa-flag bsa-flag--no">✓ Clean</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.parse_warnings?.length > 0 && (
            <details className="bsa-warnings" style={{ marginTop: '0.5rem' }}>
              <summary>⚠ {result.parse_warnings.length} parse warning(s)</summary>
              <ul>{result.parse_warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </details>
          )}
        </details>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ApplicationStatementScanner({ applications = [] }) {
  const [scanning, setScanning]   = useState({}); // { [appId]: true }
  const [results,  setResults]    = useState({}); // { [appId]: result | { error } }

  // Only show apps that have a proof_of_income document with a PDF
  const appsWithStatement = applications.filter((app) =>
    app.documents?.some(
      (d) => d.document_type === 'proof_of_income' && d.file_name?.toLowerCase().endsWith('.pdf')
    )
  );

  const appsWithoutStatement = applications.filter((app) =>
    !app.documents?.some(
      (d) => d.document_type === 'proof_of_income' && d.file_name?.toLowerCase().endsWith('.pdf')
    )
  );

  const handleScan = async (app) => {
    setScanning((prev) => ({ ...prev, [app.id]: true }));
    setResults((prev) => ({ ...prev, [app.id]: null }));
    try {
      const result = await analyzeApplicationStatement(app.id);
      setResults((prev) => ({ ...prev, [app.id]: result }));
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [app.id]: { error: err.body?.error || err.message || 'Scan failed' },
      }));
    } finally {
      setScanning((prev) => ({ ...prev, [app.id]: false }));
    }
  };

  if (applications.length === 0) {
    return (
      <div className="ass-empty">
        No loan applications found. Applications will appear here once farmers submit them.
      </div>
    );
  }

  return (
    <div className="ass-wrap">
      <div className="ass-header">
        <p className="ass-header__desc">
          Scan the bank statement (proof of income) already submitted by each farmer as part of their loan application.
          The model extracts every transaction from the PDF and flags the statement as{' '}
          <strong>fraudulent</strong> if any transaction is suspicious.
        </p>
      </div>

      {/* Applications that have a scannable PDF */}
      <div className="ass-list">
        {appsWithStatement.map((app) => {
          const doc = app.documents.find(
            (d) => d.document_type === 'proof_of_income' && d.file_name?.toLowerCase().endsWith('.pdf')
          );
          const result  = results[app.id];
          const isScanning = scanning[app.id];

          return (
            <div key={app.id} className={`ass-card ${result?.statement_is_fraud ? 'ass-card--fraud' : result && !result.error ? 'ass-card--clean' : ''}`}>
              <div className="ass-card__header">
                <div className="ass-card__info">
                  <span className="ass-card__name">{app.user_name || app.user_email}</span>
                  <span className="ass-card__meta">
                    App #{app.id} · {new Date(app.created_at).toLocaleDateString()} ·
                    RWF {Number(app.loan_amount_requested).toLocaleString()} ·{' '}
                    <span className={`mfi-dashboard__status mfi-dashboard__status--${app.status}`}>
                      {app.status.replace(/_/g, ' ')}
                    </span>
                  </span>
                  <span className="ass-card__doc">
                    📄 {doc?.file_name}
                  </span>
                </div>
                <button
                  type="button"
                  className={`ass-card__btn ${isScanning ? 'ass-card__btn--loading' : ''}`}
                  onClick={() => handleScan(app)}
                  disabled={isScanning}
                >
                  {isScanning ? 'Scanning…' : result ? 'Re-scan' : 'Scan for Fraud'}
                </button>
              </div>

              {result?.error && (
                <div className="card__message card__message--error" style={{ margin: '0.75rem 0 0' }}>
                  {result.error}
                </div>
              )}

              {result && !result.error && (
                <StatementResult result={result} />
              )}
            </div>
          );
        })}
      </div>

      {/* Applications without a bank statement PDF */}
      {appsWithoutStatement.length > 0 && (
        <details className="ass-missing">
          <summary>
            {appsWithoutStatement.length} application{appsWithoutStatement.length !== 1 ? 's' : ''} without a PDF bank statement
          </summary>
          <ul className="ass-missing__list">
            {appsWithoutStatement.map((app) => (
              <li key={app.id} className="ass-missing__item">
                <strong>{app.user_name || app.user_email}</strong>
                {' — '}App #{app.id}
                {' · '}
                {app.documents?.some((d) => d.document_type === 'proof_of_income')
                  ? 'Bank statement submitted but not a PDF'
                  : 'No bank statement submitted'}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
