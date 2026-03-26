import { useState, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { analyzeBankStatement } from '../api/client';
import './Card.css';
import './BankStatementAnalyzer.css';

const RISK_COLOR = { LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444' };

export default function BankStatementAnalyzer() {
  const { t } = useLanguage();
  const fileRef = useRef(null);

  const [file, setFile]               = useState(null);
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState(null);
  const [filterLevel, setFilterLevel] = useState('all'); // all | HIGH | MEDIUM | LOW

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f && f.type !== 'application/pdf') {
      setError('Please select a PDF file.');
      setFile(null);
      return;
    }
    setFile(f || null);
    setError(null);
    setResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setError('Please select a PDF bank statement.'); return; }
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await analyzeBankStatement(file);
      setResult(data);
    } catch (err) {
      setError(err.body?.error || err.message || t('apiError'));
    } finally {
      setLoading(false);
    }
  };

  const displayedTx = result
    ? (filterLevel === 'all' ? result.transactions : result.transactions.filter((tx) => tx.risk_level === filterLevel))
    : [];

  return (
    <section className="bsa-wrap" aria-labelledby="bsa-heading">
      <div className="bsa-header">
        <h3 id="bsa-heading" className="bsa-title">
          📄 Bank Statement Fraud Scan
        </h3>
        <p className="bsa-desc">
          Upload a farmer's PDF bank statement. Transactions will be extracted automatically
          and each one will be scored for fraud risk using the ML models.
        </p>
      </div>

      <form className="bsa-form card__form" onSubmit={handleSubmit}>
        <div className="card__grid">
          {/* File upload */}
          <label className="card__label bsa-file-label">
            PDF Bank Statement
            <div
              className={`bsa-drop-zone ${file ? 'bsa-drop-zone--has-file' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) { setFile(f); setError(null); setResult(null); }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              aria-label="Upload PDF bank statement"
            >
              {file ? (
                <span className="bsa-drop-zone__filename">📎 {file.name}</span>
              ) : (
                <span>Click or drag &amp; drop a PDF here</span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <button type="submit" className="card__btn" disabled={loading || !file}>
          {loading ? 'Analysing…' : 'Scan for Fraud'}
        </button>
      </form>

      {error && <div className="card__message card__message--error">{error}</div>}

      {result && (
        <div className="bsa-results">

          {/* ── Statement-level verdict ── */}
          <div className={`bsa-verdict bsa-verdict--${result.statement_is_fraud ? 'fraud' : 'clean'}`}>
            <div className="bsa-verdict__icon">
              {result.statement_is_fraud ? '⚠' : '✓'}
            </div>
            <div className="bsa-verdict__body">
              <span className="bsa-verdict__label">
                {result.statement_is_fraud
                  ? 'FRAUDULENT STATEMENT'
                  : 'STATEMENT APPEARS CLEAN'}
              </span>
              <span className="bsa-verdict__sub">
                {result.statement_is_fraud
                  ? `${result.flagged_count} of ${result.total_transactions} transactions flagged · worst risk score ${result.statement_risk_score?.toFixed(1)} / 100 (${result.statement_risk_level}) · fraud ratio ${(result.fraud_ratio * 100).toFixed(1)}%`
                  : `All ${result.total_transactions} transactions passed fraud checks · max risk score ${result.statement_risk_score?.toFixed(1)} / 100 (${result.statement_risk_level})`}
              </span>
            </div>
            <div className="bsa-verdict__score" style={{ color: RISK_COLOR[result.statement_risk_level] }}>
              {result.statement_risk_score?.toFixed(1)}<small>/100</small>
            </div>
          </div>

          {/* Worst transaction callout */}
          {result.statement_is_fraud && result.worst_transaction && (
            <div className="bsa-worst">
              <span className="bsa-worst__title">Most suspicious transaction</span>
              <span className="bsa-worst__date">{result.worst_transaction.date}</span>
              <span className="bsa-worst__desc">{result.worst_transaction.description || '—'}</span>
              <span className="bsa-worst__amount">RWF {result.worst_transaction.amount?.toLocaleString()}</span>
              <span className="bsa-worst__score" style={{ color: RISK_COLOR[result.worst_transaction.risk_level] }}>
                Score {result.worst_transaction.risk_score?.toFixed(1)} · {result.worst_transaction.risk_level}
              </span>
            </div>
          )}

          {/* Summary stats */}
          <div className="bsa-summary">
            <div className="bsa-stat">
              <span className="bsa-stat__value">{result.total_transactions}</span>
              <span className="bsa-stat__label">Transactions found</span>
            </div>
            <div className="bsa-stat bsa-stat--warn">
              <span className="bsa-stat__value">{result.flagged_count}</span>
              <span className="bsa-stat__label">Flagged as fraud</span>
            </div>
            <div className="bsa-stat bsa-stat--danger">
              <span className="bsa-stat__value">{result.high_risk_count}</span>
              <span className="bsa-stat__label">High risk</span>
            </div>
          </div>

          {/* Warnings */}
          {result.parse_warnings?.length > 0 && (
            <details className="bsa-warnings">
              <summary>⚠ {result.parse_warnings.length} parse warning(s)</summary>
              <ul>{result.parse_warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </details>
          )}

          {result.transactions.length === 0 ? (
            <p className="bsa-empty">No transactions could be extracted. The PDF may use an image-based scan or an unsupported layout.</p>
          ) : (
            <>
              {/* Filter */}
              <div className="bsa-filter">
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

              {/* Table */}
              <div className="bsa-table-wrap">
                <table className="bsa-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Type</th>
                      <th>Amount (RWF)</th>
                      <th>Balance (RWF)</th>
                      <th>Risk Score</th>
                      <th>Risk Level</th>
                      <th>Fraud Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTx.map((tx) => (
                      <tr key={tx.index} className={tx.is_fraud ? 'bsa-row--flagged' : ''}>
                        <td>{tx.index}</td>
                        <td className="bsa-td--date">{tx.date}</td>
                        <td className="bsa-td--desc" title={tx.description}>{tx.description || '—'}</td>
                        <td>
                          <span className={`bsa-badge bsa-badge--${tx.tx_type.toLowerCase()}`}>
                            {tx.tx_type}
                          </span>
                        </td>
                        <td className="bsa-td--num">{tx.amount.toLocaleString()}</td>
                        <td className="bsa-td--num">{tx.balance.toLocaleString()}</td>
                        <td className="bsa-td--num">
                          <div className="bsa-mini-bar-wrap">
                            <div
                              className="bsa-mini-bar"
                              style={{
                                width: `${Math.min(100, tx.risk_score)}%`,
                                background: RISK_COLOR[tx.risk_level] || '#94a3b8',
                              }}
                            />
                          </div>
                          {tx.risk_score.toFixed(1)}
                        </td>
                        <td>
                          <span
                            className="bsa-risk-tag"
                            style={{ color: RISK_COLOR[tx.risk_level], borderColor: RISK_COLOR[tx.risk_level] }}
                          >
                            {tx.risk_level}
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
            </>
          )}
        </div>
      )}
    </section>
  );
}
