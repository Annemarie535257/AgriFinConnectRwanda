import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { recommendLoanAmount } from '../api/client';
import './Card.css';

const INITIAL = {
  Age: 38,
  AnnualIncome: 55000,
  CreditScore: 650,
  LoanDuration: 36,
  DebtToIncomeRatio: 0.28,
  EmploymentStatus: 'Employed',
  EducationLevel: 'Bachelor',
};

export default function LoanRecommendationCard() {
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
      const data = await recommendLoanAmount(form, language);
      setResult(data);
    } catch (err) {
      setError(err.status ? `API error ${err.status}` : t('apiError'));
    } finally {
      setLoading(false);
    }
  };

  const amount = result && (result.recommended_amount ?? result.recommendedAmount ?? result.amount ?? result.prediction);

  return (
    <section className="card" aria-labelledby="recommend-heading">
      <h2 id="recommend-heading" className="card__title">{t('card3.title')}</h2>
      <p className="card__desc">{t('card3.desc')}</p>
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
          {loading ? t('card3.getting') : t('card3.submit')}
        </button>
      </form>
      {error && <div className="card__message card__message--error">{error}</div>}
      {result && (
        <div className="card__result card__result--amount">
          <strong>{t('card3.recommended')}</strong>{' '}
          {typeof amount === 'number'
            ? `RWF ${Math.round(amount).toLocaleString()}`
            : amount != null
            ? `RWF ${Number(amount).toLocaleString()}`
            : JSON.stringify(result)}
          {result.explanation && <p className="card__result-detail">{result.explanation}</p>}
        </div>
      )}
    </section>
  );
}
