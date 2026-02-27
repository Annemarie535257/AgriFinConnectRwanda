import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { languageNames } from '../translations';
import { register, login } from '../api/client';
import { logGetStartedActivity } from '../api/client';
import FloatingChatbot from '../components/FloatingChatbot';
import '../App.css';
import './GetStartedPage.css';

const ROLE_TO_PATH = {
  farmer: '/dashboard/farmer',
  microfinance: '/dashboard/microfinance',
  admin: '/dashboard/admin',
};

export default function GetStartedPage() {
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [farmerMode, setFarmerMode] = useState('login'); // 'login' | 'register'
  const [microfinanceMode, setMicrofinanceMode] = useState('login');

  useEffect(() => {
    logGetStartedActivity('modal_opened');
  }, []);

  const handleRegister = async (role, { email, password, name }) => {
    logGetStartedActivity('register_clicked', role + 's');
    try {
      await register({ email, password, role, name });
      if (role === 'farmer') setFarmerMode('login');
      else setMicrofinanceMode('login');
      return { success: true, message: t('getStarted.successRegister') };
    } catch (err) {
      const body = err.body || {};
      const emailErrors = typeof body === 'object' && body.email;
      const msg = Array.isArray(emailErrors) ? emailErrors[0] : emailErrors;
      if (msg && String(msg).toLowerCase().includes('exists')) {
        return { success: false, error: t('getStarted.errorEmailExists') };
      }
      return { success: false, error: t('getStarted.errorGeneric') };
    }
  };

  const handleLogin = async (role, { email, password }) => {
    logGetStartedActivity('login_clicked', role + 's');
    try {
      const data = await login({ email, password });
      const token = data.token;
      const userRole = data.user?.role;
      const path = ROLE_TO_PATH[userRole] || ROLE_TO_PATH[role];
      if (token) {
        localStorage.setItem('agrifinconnect-token', token);
        localStorage.setItem('agrifinconnect-user', JSON.stringify(data.user || {}));
      }
      navigate(path);
      return { success: true };
    } catch (err) {
      if (err.status === 401) {
        return { success: false, error: t('getStarted.errorInvalidCredentials') };
      }
      if (err.status === 400 && err.body) {
        const msg = typeof err.body === 'object'
          ? (err.body.error || err.body.email?.[0] || err.body.password?.[0] || JSON.stringify(err.body))
          : err.body;
        return { success: false, error: msg };
      }
      return { success: false, error: t('getStarted.errorGeneric') };
    }
  };

  return (
    <div className="app">
      <header className="get-started-header">
        <div className="get-started-header__inner">
          <Link to="/" className="get-started-header__logo">
            <img src="/logo (3).png" alt="AgriFinConnect Rwanda" className="get-started-header__logo-img" />
          </Link>
          <div className="get-started-header__lang">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="get-started-header__lang-select"
              aria-label="Select language"
            >
              <option value="en">{languageNames.en}</option>
              <option value="fr">{languageNames.fr}</option>
              <option value="rw">{languageNames.rw}</option>
            </select>
          </div>
        </div>
      </header>
      <main className="get-started-page">
        <div className="get-started-page__inner">
          <div className="get-started-page__sections">
            {/* Farmer section */}
            <section className="get-started-section" aria-labelledby="farmer-heading">
              <h2 id="farmer-heading" className="get-started-section__title">
                {t('getStarted.farmerSection')}
              </h2>
              <p className="get-started-section__desc">{t('getStarted.farmerDesc')}</p>
              <AuthForms
                role="farmer"
                mode={farmerMode}
                onModeChange={setFarmerMode}
                onRegister={handleRegister}
                onLogin={handleLogin}
                t={t}
              />
            </section>

            {/* Microfinance section */}
            <section className="get-started-section" aria-labelledby="microfinance-heading">
              <h2 id="microfinance-heading" className="get-started-section__title">
                {t('getStarted.microfinanceSection')}
              </h2>
              <p className="get-started-section__desc">{t('getStarted.microfinanceDesc')}</p>
              <AuthForms
                role="microfinance"
                mode={microfinanceMode}
                onModeChange={setMicrofinanceMode}
                onRegister={handleRegister}
                onLogin={handleLogin}
                t={t}
              />
            </section>

          </div>

          <Link to="/" className="get-started-page__back">
            {t('getStarted.backToHome')}
          </Link>
        </div>
      </main>
      <FloatingChatbot />
    </div>
  );
}

function AuthForms({ role, mode, onModeChange, onRegister, onLogin, t, loginOnly = false }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [isError, setIsError] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (mode === 'register' && password.length < 8) {
      setMessage(t('getStarted.passwordMinLength'));
      setIsError(true);
      return;
    }
    setLoading(true);
    setMessage(null);
    let result;
    if (mode === 'register') {
      result = await onRegister(role, { email: email.trim(), password, name: name.trim() });
    } else {
      result = await onLogin(role, { email: email.trim(), password });
    }
    setLoading(false);
    if (result.success) {
      setMessage(result.message || null);
      setIsError(false);
      if (mode === 'register') resetForm();
    } else {
      setMessage(result.error);
      setIsError(true);
    }
  };

  return (
    <div className="auth-forms">
      {!loginOnly && (
        <div className="auth-forms__tabs">
          <button
            type="button"
            className={`auth-forms__tab ${mode === 'login' ? 'auth-forms__tab--active' : ''}`}
            onClick={() => { onModeChange('login'); resetForm(); }}
          >
            {t('getStarted.login')}
          </button>
          <button
            type="button"
            className={`auth-forms__tab ${mode === 'register' ? 'auth-forms__tab--active' : ''}`}
            onClick={() => { onModeChange('register'); resetForm(); }}
          >
            {t('getStarted.register')}
          </button>
        </div>
      )}

      <form className="auth-forms__form" onSubmit={handleSubmit}>
        {mode === 'register' && !loginOnly && (
          <label className="auth-forms__field">
            <span className="auth-forms__label">{t('getStarted.nameLabel')}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('getStarted.namePlaceholder')}
              className="auth-forms__input"
              autoComplete="name"
            />
          </label>
        )}
        <label className="auth-forms__field">
          <span className="auth-forms__label">{t('getStarted.emailLabel')}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('getStarted.emailPlaceholder')}
            className="auth-forms__input"
            autoComplete="email"
            required
          />
        </label>
        <label className="auth-forms__field">
          <span className="auth-forms__label">{t('getStarted.passwordLabel')}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('getStarted.passwordPlaceholder')}
            className="auth-forms__input"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            required
            minLength={mode === 'register' ? 8 : undefined}
          />
          {mode === 'login' && (
            <Link to="/forgot-password" className="auth-forms__forgot">
              {t('getStarted.forgotPassword')}
            </Link>
          )}
        </label>
        {message && (
          <p className={`auth-forms__message ${isError ? 'auth-forms__message--error' : 'auth-forms__message--success'}`}>
            {message}
          </p>
        )}
        <button
          type="submit"
          className="auth-forms__submit"
          disabled={loading || !email.trim() || !password.trim()}
        >
          {loading ? t('getStarted.submitting') : mode === 'register' ? t('getStarted.register') : t('getStarted.login')}
        </button>
      </form>
    </div>
  );
}
