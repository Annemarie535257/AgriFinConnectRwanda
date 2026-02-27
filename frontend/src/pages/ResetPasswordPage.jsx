import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { resetPassword } from '../api/client';
import Header from '../components/Header';
import FloatingChatbot from '../components/FloatingChatbot';
import '../App.css';
import './ForgotPasswordPage.css';

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!tokenFromUrl) {
      setMessage(t('getStarted.errorTokenInvalid'));
      setIsError(true);
    }
  }, [tokenFromUrl, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tokenFromUrl || password.length < 8) return;
    if (password !== confirmPassword) {
      setMessage(t('getStarted.errorPasswordMismatch'));
      setIsError(true);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await resetPassword({ token: tokenFromUrl, newPassword: password });
      setMessage(t('getStarted.resetSuccess'));
      setIsError(false);
      setTimeout(() => navigate('/get-started'), 2000);
    } catch (err) {
      const errBody = err.body || {};
      const errMsg = typeof errBody === 'object' && errBody.error ? errBody.error : t('getStarted.errorTokenInvalid');
      setMessage(errMsg);
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
          <h1 className="forgot-password-page__title">{t('getStarted.resetPasswordTitle')}</h1>
          <p className="forgot-password-page__lead">{t('getStarted.resetPasswordLead')}</p>

          {tokenFromUrl ? (
            <form className="forgot-password-form" onSubmit={handleSubmit}>
              <label className="forgot-password-form__field">
                <span className="forgot-password-form__label">{t('getStarted.newPasswordLabel')}</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('getStarted.newPasswordPlaceholder')}
                  className="forgot-password-form__input"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </label>
              <label className="forgot-password-form__field">
                <span className="forgot-password-form__label">{t('getStarted.confirmPasswordLabel')}</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('getStarted.confirmPasswordPlaceholder')}
                  className="forgot-password-form__input"
                  autoComplete="new-password"
                  required
                  minLength={8}
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
                disabled={loading || password.length < 8 || password !== confirmPassword}
              >
                {loading ? t('getStarted.submitting') : t('getStarted.setPassword')}
              </button>
            </form>
          ) : (
            <p className="forgot-password-form__message forgot-password-form__message--error">
              {message || t('getStarted.errorTokenInvalid')}
            </p>
          )}

          <Link to="/get-started" className="forgot-password-page__back">
            {t('getStarted.backToHome')}
          </Link>
        </div>
      </main>
      <FloatingChatbot />
    </div>
  );
}
