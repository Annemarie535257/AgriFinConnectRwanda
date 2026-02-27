import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { predictRisk } from '../api/client';
import './Card.css';

const INITIAL = {
  Age: 40,
  AnnualIncome: 60000,
  CreditScore: 580,
  LoanAmount: 20000,
  LoanDuration: 48,
  DebtToIncomeRatio: 0.42,
  EmploymentStatus: 'Employed',
  EducationLevel: 'Associate',
};

export default function RiskAssessmentCard() {
  const { t, language } = useLanguage();
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: isNaN(Number(value)) ? value : Number(value) }));
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await predictRisk(form, language);
      setResult(data);
    } catch (err) {
      setError(err.status ? `API error ${err.status}` : t('apiError'));
    } finally {
      setLoading(false);
    }
  };

  const riskLevel = (score) => {
    if (score == null) return null;
    const s = Number(score);
    if (s <= 35) return { labelKey: 'card2.lowRisk', class: 'risk-low' };
    if (s <= 55) return { labelKey: 'card2.moderateRisk', class: 'risk-mid' };
    return { labelKey: 'card2.higherRisk', class: 'risk-high' };
  };

  const r = result && (result.risk_score ?? result.riskScore ?? result.score ?? result.prediction);
  const level = riskLevel(r);

  return (
    <section className="card" aria-labelledby="risk-heading">
      <h2 id="risk-heading" className="card__title">{t('card2.title')}</h2>
      <p className="card__desc">{t('card2.desc')}</p>
      <form className="card__form" onSubmit={handleSubmit}>
        <div className="card__grid">
          <label className="card__label">
            {t('card1.age')}
            <input type="number" name="Age" value={form.Age} onChange={handleChange} min={18} max={100} className="card__input" />
          </label>
          <label className="card__label">
            {t('card1.annualIncome')}
            <input type="number" name="AnnualIncome" value={form.AnnualIncome} onChange={handleChange} min={0} className="card__input" />
          </label>
          <label className="card__label">
            {t('card1.creditScore')}
            <input type="number" name="CreditScore" value={form.CreditScore} onChange={handleChange} min={300} max={850} className="card__input" />
          </label>
          <label className="card__label">
            {t('card1.loanAmount')}
            <input type="number" name="LoanAmount" value={form.LoanAmount} onChange={handleChange} min={0} className="card__input" />
          </label>
          <label className="card__label">
            {t('card1.loanDuration')}
            <input type="number" name="LoanDuration" value={form.LoanDuration} onChange={handleChange} min={1} max={120} className="card__input" />
          </label>
          <label className="card__label">
            {t('card1.debtToIncome')}
            <input type="number" name="DebtToIncomeRatio" value={form.DebtToIncomeRatio} onChange={handleChange} min={0} max={1} step={0.01} className="card__input" />
          </label>
          <label className="card__label">
            {t('card1.employment')}
            <select name="EmploymentStatus" value={form.EmploymentStatus} onChange={handleChange} className="card__input">
              <option value="Employed">Employed</option>
              <option value="Self-Employed">Self-Employed</option>
              <option value="Unemployed">Unemployed</option>
            </select>
          </label>
          <label className="card__label">
            {t('card1.education')}
            <select name="EducationLevel" value={form.EducationLevel} onChange={handleChange} className="card__input">
              <option value="High School">High School</option>
              <option value="Associate">Associate</option>
              <option value="Bachelor">Bachelor</option>
              <option value="Master">Master</option>
            </select>
          </label>
        </div>
        <button type="submit" className="card__btn" disabled={loading}>
          {loading ? t('card2.assessing') : t('card2.submit')}
        </button>
      </form>
      {error && <div className="card__message card__message--error">{error}</div>}
      {result && (
        <div className="card__result">
          <strong>{t('card2.riskScore')}</strong>{' '}
          <span className={level ? level.class : ''}>
            {typeof r === 'number' ? r.toFixed(2) : r}
            {result.interpretation ? ` — ${result.interpretation}` : level && ` — ${t(level.labelKey)}`}
          </span>
          {result.description && <p className="card__result-detail">{result.description}</p>}
        </div>
      )}
    </section>
  );
}
