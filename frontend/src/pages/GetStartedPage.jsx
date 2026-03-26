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
  const [legalAccepted, setLegalAccepted] = useState(() => {
    return localStorage.getItem('agrifinconnect-legal-accepted') === 'true';
  });
  const [legalGateOpen, setLegalGateOpen] = useState(false);
  const [legalAcceptedJustNow, setLegalAcceptedJustNow] = useState(false);
  const [pendingRegisterRole, setPendingRegisterRole] = useState(null);

  useEffect(() => {
    logGetStartedActivity('modal_opened');
  }, []);

  useEffect(() => {
    if (!legalAcceptedJustNow) return undefined;

    const timer = setTimeout(() => {
      setLegalAcceptedJustNow(false);
      setLegalGateOpen(false);
      if (pendingRegisterRole === 'farmer') {
        setFarmerMode('register');
      }
      if (pendingRegisterRole === 'microfinance') {
        setMicrofinanceMode('register');
      }
      setPendingRegisterRole(null);
    }, 1200);

    return () => clearTimeout(timer);
  }, [legalAcceptedJustNow, pendingRegisterRole]);

  const handleRequestRegister = (role) => {
    if (legalAccepted) {
      if (role === 'farmer') setFarmerMode('register');
      if (role === 'microfinance') setMicrofinanceMode('register');
      return;
    }

    setPendingRegisterRole(role);
    setLegalGateOpen(true);
    setLegalAcceptedJustNow(false);
  };

  const handleAgreeAndContinue = () => {
    localStorage.setItem('agrifinconnect-legal-accepted', 'true');
    setLegalAccepted(true);
    setLegalAcceptedJustNow(true);
  };

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
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="AgriFinConnect Rwanda" className="get-started-header__logo-img" />
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
                onRequestRegister={handleRequestRegister}
                onRegister={handleRegister}
                onLogin={handleLogin}
                legalAccepted={legalAccepted}
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
                onRequestRegister={handleRequestRegister}
                onRegister={handleRegister}
                onLogin={handleLogin}
                legalAccepted={legalAccepted}
                t={t}
              />
            </section>

          </div>

          <Link to="/" className="get-started-page__back">
            {t('getStarted.backToHome')}
          </Link>
          <Link to="/admin-login" className="get-started-page__admin-link">
            System Admin
          </Link>
        </div>

        {legalGateOpen && (
          <div className="register-legal-gate" role="dialog" aria-modal="true" aria-labelledby="register-legal-title">
            <div className="register-legal-gate__card">
              {legalAcceptedJustNow ? (
                <div className="register-legal-gate__success" aria-live="polite">
                  <div className="register-legal-gate__tick" aria-hidden="true">✓</div>
                  <h2 className="register-legal-gate__title">{t('legalGate.agreedTitle')}</h2>
                  <p className="register-legal-gate__lead">{t('legalGate.agreedLead')}</p>
                </div>
              ) : (
                <>
                  <p className="register-legal-gate__eyebrow">{t('legalGate.eyebrow')}</p>
                  <h2 id="register-legal-title" className="register-legal-gate__title">{t('legalGate.title')}</h2>
                  <p className="register-legal-gate__lead">{t('legalGate.lead')}</p>

                  <ul className="register-legal-gate__list">
                    <li>
                      <strong>{t('legalGate.highlights.licenseTitle')}:</strong> {t('legalGate.highlights.license')}
                    </li>
                    <li>
                      <strong>{t('legalGate.highlights.privacyTitle')}:</strong> {t('legalGate.highlights.privacy')}
                    </li>
                  </ul>

                  <p className="register-legal-gate__note">{t('legalGate.importantNote')}</p>

                  <div className="register-legal-gate__actions">
                    <Link to="/legal" className="register-legal-gate__link">
                      {t('legalGate.readFullPolicy')}
                    </Link>
                    <button type="button" className="register-legal-gate__button" onClick={handleAgreeAndContinue}>
                      {t('legalGate.acceptContinue')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
      <FloatingChatbot />
    </div>
  );
}

function AuthForms({ role, mode, onModeChange, onRequestRegister, onRegister, onLogin, legalAccepted, t, loginOnly = false }) {
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
      if (mode === 'register') {
        resetForm();
      }
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
            onClick={() => {
              if (legalAccepted) {
                onModeChange('register');
                resetForm();
                return;
              }
              onRequestRegister(role);
            }}
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
          {loading
            ? t('getStarted.submitting')
            : (mode === 'register' ? t('getStarted.register') : t('getStarted.login'))}
        </button>
      </form>
    </div>
  );
}
