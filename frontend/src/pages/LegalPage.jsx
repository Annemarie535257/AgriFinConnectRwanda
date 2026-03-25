import Header from '../components/Header';
import Footer from '../components/Footer';
import BackToTop from '../components/BackToTop';
import FloatingChatbot from '../components/FloatingChatbot';
import { useLanguage } from '../context/LanguageContext';
import '../App.css';
import './LegalPage.css';

const EULA_KEYS = [
  'acceptance',
  'eligibility',
  'permittedUse',
  'accountSecurity',
  'loanDecisionNotice',
  'dataAccuracy',
  'serviceAvailability',
  'limitation',
  'termination',
  'governingLaw',
];

const PRIVACY_KEYS = [
  'dataCollected',
  'useOfData',
  'legalBasis',
  'sharing',
  'retention',
  'security',
  'crossBorder',
  'userRights',
  'cookies',
  'contact',
];

export default function LegalPage() {
  const { t } = useLanguage();

  return (
    <div className="app landing-layout">
      <Header />
      <main className="legal-page" aria-label={t('legal.pageAriaLabel')}>
        <section className="legal-page__hero">
          <p className="legal-page__eyebrow">{t('legal.eyebrow')}</p>
          <h1 className="legal-page__title">{t('legal.title')}</h1>
          <p className="legal-page__lead">{t('legal.lead')}</p>
          <p className="legal-page__meta">{t('legal.lastUpdatedLabel')}: {t('legal.lastUpdatedDate')}</p>
        </section>

        <section className="legal-page__section" id="eula" aria-labelledby="eula-title">
          <h2 id="eula-title" className="legal-page__section-title">{t('legal.eulaTitle')}</h2>
          <p className="legal-page__section-intro">{t('legal.eulaIntro')}</p>
          <ol className="legal-page__clause-list">
            {EULA_KEYS.map((key) => (
              <li key={key} className="legal-page__clause-item">
                <h3 className="legal-page__clause-title">{t(`legal.eula.${key}.title`)}</h3>
                <p className="legal-page__clause-text">{t(`legal.eula.${key}.text`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="legal-page__section" id="privacy" aria-labelledby="privacy-title">
          <h2 id="privacy-title" className="legal-page__section-title">{t('legal.privacyTitle')}</h2>
          <p className="legal-page__section-intro">{t('legal.privacyIntro')}</p>
          <ol className="legal-page__clause-list">
            {PRIVACY_KEYS.map((key) => (
              <li key={key} className="legal-page__clause-item">
                <h3 className="legal-page__clause-title">{t(`legal.privacy.${key}.title`)}</h3>
                <p className="legal-page__clause-text">{t(`legal.privacy.${key}.text`)}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <Footer />
      <BackToTop />
      <FloatingChatbot />
    </div>
  );
}
