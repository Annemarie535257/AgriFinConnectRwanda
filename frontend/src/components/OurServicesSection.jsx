import { useLanguage } from '../context/LanguageContext';
import './OurServicesSection.css';

const SERVICES = [
  { key: 'loanApplication', icon: '📝' },
  { key: 'eligibility', icon: '📊' },
  { key: 'risk', icon: '📈' },
  { key: 'recommendation', icon: '💰' },
  { key: 'documents', icon: '🗂️' },
  { key: 'farmData', icon: '🌾' },
];

export default function OurServicesSection() {
  const { t } = useLanguage();

  return (
    <section
      id="our-services"
      className="our-services landing-section"
      aria-labelledby="our-services-heading"
      style={{ animationDelay: '0.15s' }}
    >
      <div className="our-services__inner">
        <h2 id="our-services-heading" className="our-services__title">
          {t('services.title')}
        </h2>
        <p className="our-services__lead">{t('services.introLead')}</p>

        <div className="our-services__grid">
          {SERVICES.map(({ key, icon }) => (
            <article key={key} className="our-services__card">
              <div className="our-services__icon-wrap" aria-hidden="true">
                <span className="our-services__icon">{icon}</span>
              </div>
              <h3 className="our-services__card-title">
                {t(`services.cards.${key}.title`)}
              </h3>
              <p className="our-services__card-desc">
                {t(`services.cards.${key}.desc`)}
              </p>
              <div className="our-services__bar" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
