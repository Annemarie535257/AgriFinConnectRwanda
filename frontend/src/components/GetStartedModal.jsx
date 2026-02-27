import { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { logGetStartedActivity } from '../api/client';
import './GetStartedModal.css';

const ROLES = ['farmers', 'microfinances'];

export default function GetStartedModal({ isOpen, onClose, onLogin }) {
  const { t } = useLanguage();

  useEffect(() => {
    if (!isOpen) return;
    logGetStartedActivity('modal_opened');
    const handleEscape = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRegister = (role) => {
    logGetStartedActivity('register_clicked', role);
    // Placeholder: coming soon or future route
    alert(t('getStarted.comingSoon'));
  };

  const handleLogin = (role) => {
    logGetStartedActivity('login_clicked', role);
    onLogin?.(role);
  };

  return (
    <div
      className="get-started-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="get-started-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="get-started-modal">
        <div className="get-started-modal__head">
          <h2 id="get-started-title" className="get-started-modal__title">
            {t('getStarted.title')}
          </h2>
          <p className="get-started-modal__lead">{t('getStarted.lead')}</p>
          <button
            type="button"
            className="get-started-modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="get-started-modal__roles">
          {ROLES.map((role) => (
            <div key={role} className="get-started-role">
              <h3 className="get-started-role__title">{t(`getStarted.${role}`)}</h3>
              <div className="get-started-role__actions">
                <button
                  type="button"
                  className="get-started-role__btn get-started-role__btn--primary"
                  onClick={() => handleRegister(role)}
                >
                  {t('getStarted.register')}
                </button>
                <button
                  type="button"
                  className="get-started-role__btn get-started-role__btn--secondary"
                  onClick={() => handleLogin(role)}
                >
                  {t('getStarted.login')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
