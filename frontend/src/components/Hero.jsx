import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import './Hero.css';

export default function Hero() {
  const { t } = useLanguage();

  return (
    <section id="home" className="hero landing-section" aria-label="Home">
      <div className="hero__inner">
        <div className="hero__content">
          <p className="hero__label">{t('hero.smallLabel')}</p>
          <h1 className="hero__title hero__title--brand">
            {t('hero.brand')} {t('hero.country')}
          </h1>
          <p className="hero__tagline">{t('hero.tagline')}</p>
          <p className="hero__intro">{t('hero.intro')}</p>
          <div className="hero__cta">
            <Link
              to="/get-started"
              className="hero__btn hero__btn--primary"
            >
              {t('nav.getStarted')}
            </Link>
            <Link
              to="/try-models"
              className="hero__btn hero__btn--secondary"
            >
              {t('nav.tryModels')}
            </Link>
          </div>
        </div>
        <div className="hero__visual" aria-hidden="true">
          <div className="hero__visual-bg hero__visual-bg--circle" />
          <div className="hero__visual-bg hero__visual-bg--circle-faint hero__visual-bg--tl" />
          <div className="hero__visual-bg hero__visual-bg--circle-faint hero__visual-bg--br" />
          <div className="hero__visual-ring" />
          <div className="hero__visual-dots">
            <span className="hero__dot hero__dot--teal" />
            <span className="hero__dot hero__dot--dark" />
          </div>
          <div className="hero__visual-img-wrap">
            <img src="/download (1).jpeg" alt="" className="hero__visual-img" />
          </div>
        </div>
      </div>
    </section>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}
