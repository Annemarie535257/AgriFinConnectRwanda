import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import './Footer.css';

const FOOTER_NAV = [
  { key: 'home', to: '/' },
  { key: 'about', to: '/#about' },
  { key: 'services', to: '/#our-services' },
  { key: 'contact', to: '/#contact' },
  { key: 'tryModels', to: '/try-models' },
];

const FOOTER_SERVICES = ['service1', 'service2', 'service3', 'service4'];

export default function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__top">
          <div className="footer__brand">
            <Link to="/" className="footer__logo-link">
              <img src="/logo (3).png" alt="AgriFinConnect Rwanda" className="footer__logo-img" />
            </Link>
            <p className="footer__tagline">{t('footer.tagline')}</p>
          </div>
          <div className="footer__col">
            <span className="footer__col-title">{t('footer.quickLinks')}</span>
            <ul className="footer__links">
              {FOOTER_NAV.map(({ key, to }) => (
                <li key={key}>
                  <Link to={to} className="footer__link">{t(`nav.${key}`)}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="footer__col">
            <span className="footer__col-title">{t('footer.services')}</span>
            <ul className="footer__links">
              {FOOTER_SERVICES.map((key) => (
                <li key={key}>
                  <Link to="/#our-services" className="footer__link">{t(`contact.${key}`)}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="footer__col">
            <span className="footer__col-title">{t('footer.aboutUs')}</span>
            <ul className="footer__links">
              <li>
                <Link to="/#contact" className="footer__link">{t('footer.contactUs')}</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer__bottom">
          <div className="footer__social">
            <a href="#" className="footer__social-link" aria-label="Facebook">f</a>
            <a href="#" className="footer__social-link" aria-label="Twitter">𝕏</a>
            <a href="#" className="footer__social-link" aria-label="LinkedIn">in</a>
          </div>
          <p className="footer__copy">
            © {year} {t('footer.copyright')} {t('footer.allRightsReserved')}
          </p>
        </div>
      </div>
    </footer>
  );
}
