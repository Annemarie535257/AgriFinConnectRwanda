import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { detectFraud } from '../api/client';
import './Card.css';

const today = new Date().toISOString().slice(0, 16);
const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 16);

const INITIAL = {
  TransactionAmount: 1500,
  AccountBalance: 8000,
  LoginAttempts: 1,
  TransactionDuration: 90,
  CustomerAge: 35,
  TransactionType: 'Debit',
  Channel: 'Online',
  CustomerOccupation: 'Engineer',
  TransactionDate: today,
  PreviousTransactionDate: weekAgo,
};

const RISK_CONFIG = {
  LOW:    { cls: 'risk-low',  bar: '#22c55e' },
  MEDIUM: { cls: 'risk-mid',  bar: '#f59e0b' },
  HIGH:   { cls: 'risk-high', bar: '#ef4444' },
};

export default function FraudDetectionCard() {
  const { t } = useLanguage();
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: isNaN(Number(value)) || value === '' ? value : Number(value) }));
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await detectFraud(form);
      setResult(data);
    } catch (err) {
      setError(err.status ? `API error ${err.status}` : t('apiError'));
    } finally {
      setLoading(false);
    }
  };

  const cfg = result ? RISK_CONFIG[result.risk_level] || RISK_CONFIG.LOW : null;

  return (
    <section className="card" aria-labelledby="fraud-heading">
      <h2 id="fraud-heading" className="card__title">{t('card5.title')}</h2>
      <p className="card__desc">{t('card5.desc')}</p>
      <form className="card__form" onSubmit={handleSubmit}>
        <div className="card__grid">
          <label className="card__label">
            {t('card5.amount')}
            <input type="number" name="TransactionAmount" value={form.TransactionAmount}
              onChange={handleChange} min={0} className="card__input" />
          </label>
          <label className="card__label">
            {t('card5.balance')}
            <input type="number" name="AccountBalance" value={form.AccountBalance}
              onChange={handleChange} min={0} className="card__input" />
          </label>
          <label className="card__label">
            {t('card5.loginAttempts')}
            <input type="number" name="LoginAttempts" value={form.LoginAttempts}
              onChange={handleChange} min={1} max={10} className="card__input" />
          </label>
          <label className="card__label">
            {t('card5.duration')}
            <input type="number" name="TransactionDuration" value={form.TransactionDuration}
              onChange={handleChange} min={0} className="card__input" />
          </label>
          <label className="card__label">
            {t('card1.age')}
            <input type="number" name="CustomerAge" value={form.CustomerAge}
              onChange={handleChange} min={18} max={100} className="card__input" />
          </label>
          <label className="card__label">
            {t('card5.txType')}
            <select name="TransactionType" value={form.TransactionType} onChange={handleChange} className="card__input">
              <option value="Credit">Credit</option>
              <option value="Debit">Debit</option>
            </select>
          </label>
          <label className="card__label">
            {t('card5.channel')}
            <select name="Channel" value={form.Channel} onChange={handleChange} className="card__input">
              <option value="Online">Online</option>
              <option value="ATM">ATM</option>
              <option value="Branch">Branch</option>
            </select>
          </label>
          <label className="card__label">
            {t('card5.occupation')}
            <select name="CustomerOccupation" value={form.CustomerOccupation} onChange={handleChange} className="card__input">
              <option value="Doctor">Doctor</option>
              <option value="Engineer">Engineer</option>
              <option value="Retired">Retired</option>
              <option value="Student">Student</option>
            </select>
          </label>
          <label className="card__label">
            {t('card5.txDate')}
            <input type="datetime-local" name="TransactionDate" value={form.TransactionDate}
              onChange={handleChange} className="card__input" />
          </label>
          <label className="card__label">
            {t('card5.prevTxDate')}
            <input type="datetime-local" name="PreviousTransactionDate" value={form.PreviousTransactionDate}
              onChange={handleChange} className="card__input" />
          </label>
        </div>
        <button type="submit" className="card__btn" disabled={loading}>
          {loading ? t('card5.analysing') : t('card5.submit')}
        </button>
      </form>

      {error && <div className="card__message card__message--error">{error}</div>}

      {result && cfg && (
        <div className="card__result fraud-result">
          {/* Risk level badge */}
          <div className="fraud-result__badge" style={{ borderColor: cfg.bar, color: cfg.bar }}>
            {result.is_fraud ? t('card5.fraudAlert') : t('card5.legitimate')}
            {' — '}
            <strong>{result.risk_level}</strong>
          </div>

          {/* Risk score bar */}
          <div className="fraud-result__bar-wrap" aria-label={`Risk score ${result.risk_score}`}>
            <div className="fraud-result__bar-track">
              <div
                className="fraud-result__bar-fill"
                style={{ width: `${Math.min(100, result.risk_score)}%`, background: cfg.bar }}
              />
            </div>
            <span className="fraud-result__bar-label">
              {t('card5.riskScore')}: <strong>{result.risk_score}</strong> / 100
            </span>
          </div>

          {/* Metric grid */}
          <dl className="fraud-result__metrics">
            <div className="fraud-result__metric">
              <dt>{t('card5.fraudProb')}</dt>
              <dd>{(result.fraud_probability * 100).toFixed(1)}%</dd>
            </div>
            <div className="fraud-result__metric">
              <dt>{t('card5.anomalyScore')}</dt>
              <dd>{result.anomaly_score}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
