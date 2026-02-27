import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { forgotPassword } from '../api/client';
import Header from '../components/Header';
import FloatingChatbot from '../components/FloatingChatbot';
import '../App.css';
import './ForgotPasswordPage.css';

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      await forgotPassword({ email: email.trim() });
      setMessage(t('getStarted.forgotPasswordSuccess'));
      setIsError(false);
      setEmail('');
    } catch (err) {
      setMessage(t('getStarted.errorGeneric'));
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <Header />
      <main className="forgot-password-page">
        <div className="forgot-password-page__inner">
          <h1 className="forgot-password-page__title">{t('getStarted.forgotPasswordTitle')}</h1>
          <p className="forgot-password-page__lead">{t('getStarted.forgotPasswordLead')}</p>

          <form className="forgot-password-form" onSubmit={handleSubmit}>
            <label className="forgot-password-form__field">
              <span className="forgot-password-form__label">{t('getStarted.emailLabel')}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('getStarted.emailPlaceholder')}
                className="forgot-password-form__input"
                autoComplete="email"
                required
              />
            </label>
            {message && (
              <p className={`forgot-password-form__message ${isError ? 'forgot-password-form__message--error' : 'forgot-password-form__message--success'}`}>
                {message}
              </p>
            )}
            <button
              type="submit"
              className="forgot-password-form__submit"
              disabled={loading || !email.trim()}
            >
              {loading ? t('getStarted.submitting') : t('getStarted.sendResetLink')}
            </button>
          </form>

          <Link to="/get-started" className="forgot-password-page__back">
            {t('getStarted.backToHome')}
          </Link>
        </div>
      </main>
      <FloatingChatbot />
    </div>
  );
}
