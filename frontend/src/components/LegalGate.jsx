import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import './LegalGate.css';

export default function LegalGate() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);

  const handleAccept = () => {
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="legal-gate" role="region" aria-label={t('legalGate.title')}>
      <div className="legal-gate__card">
        <p className="legal-gate__eyebrow">{t('legalGate.eyebrow')}</p>
        <h2 id="legal-gate-title" className="legal-gate__title">{t('legalGate.title')}</h2>
        <p className="legal-gate__lead">{t('legalGate.lead')}</p>
        
        <div className="legal-gate__section">
          <h3 className="legal-gate__subtitle">{t('legalGate.whatWeDo')}</h3>
          <p className="legal-gate__text">{t('legalGate.whatWeDoDesc')}</p>
        </div>

        <div className="legal-gate__highlights-section">
          <h3 className="legal-gate__subtitle">{t('legalGate.keyPoints')}</h3>
          <ul className="legal-gate__list">
            <li>
              <strong>{t('legalGate.highlights.licenseTitle')}:</strong> {t('legalGate.highlights.license')}
            </li>
            <li>
              <strong>{t('legalGate.highlights.privacyTitle')}:</strong> {t('legalGate.highlights.privacy')}
            </li>
            <li>
              <strong>{t('legalGate.highlights.userRightsTitle')}:</strong> {t('legalGate.highlights.userRights')}
            </li>
          </ul>
        </div>

        <div className="legal-gate__info-box">
          <p className="legal-gate__info-text">{t('legalGate.importantNote')}</p>
        </div>

        <div className="legal-gate__actions">
          <Link to="/legal" className="legal-gate__link">
            {t('legalGate.readFullPolicy')}
          </Link>
          <button type="button" className="legal-gate__accept" onClick={handleAccept}>
            {t('legalGate.acceptContinue')}
          </button>
        </div>
      </div>
    </div>
  );
}
