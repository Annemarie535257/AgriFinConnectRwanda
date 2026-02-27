import { useLanguage } from '../context/LanguageContext';
import './AboutSection.css';

const CARD_ICONS = ['🎯', '✨', '👥'];

export default function AboutSection() {
  const { t } = useLanguage();

  return (
    <section id="about" className="about landing-section" aria-labelledby="about-heading" style={{ animationDelay: '0.08s' }}>
      <div className="about__inner">
        <h2 id="about-heading" className="about__title">{t('about.label')}</h2>
        <div className="about__grid">
          <div className="about__card">
            <span className="about__card-icon" aria-hidden="true">{CARD_ICONS[0]}</span>
            <h3 className="about__card-title">{t('about.mission')}</h3>
            <p className="about__card-text">{t('about.missionText')}</p>
          </div>
          <div className="about__card">
            <span className="about__card-icon" aria-hidden="true">{CARD_ICONS[1]}</span>
            <h3 className="about__card-title">{t('about.offer')}</h3>
            <p className="about__card-text">{t('about.offerText')}</p>
          </div>
          <div className="about__card">
            <span className="about__card-icon" aria-hidden="true">{CARD_ICONS[2]}</span>
            <h3 className="about__card-title">{t('about.who')}</h3>
            <p className="about__card-text">{t('about.whoText')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
