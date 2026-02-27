import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { languageNames } from '../translations';
import './Header.css';

const NAV_KEYS = [
  { key: 'home', to: '/', hash: '#home' },
  { key: 'about', to: '/', hash: '#about' },
  { key: 'services', to: '/', hash: '#our-services' },
  { key: 'contact', to: '/', hash: '#contact' },
];

export default function Header() {
  const { t, language, setLanguage } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="header">
      <div className="header__inner">
        <Link to="/" className="header__logo" onClick={() => setMenuOpen(false)}>
          <img src="/logo (3).png" alt="AgriFinConnect Rwanda" className="header__logo-img" />
        </Link>
        <div className="header__right">
          <button
            type="button"
            className="header__toggle"
            aria-expanded={menuOpen}
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="header__toggle-bar" />
            <span className="header__toggle-bar" />
            <span className="header__toggle-bar" />
          </button>
          <nav className={`header__nav ${menuOpen ? 'header__nav--open' : ''}`}>
            {NAV_KEYS.map(({ key, to, hash }) => {
              const href = hash ? `${to}${hash}` : to;
              const isActive = location.pathname === '/' && key === 'home';
              return (
                <Link
                  key={key}
                  to={href}
                  className={`header__link ${isActive ? 'header__link--active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {t(`nav.${key}`)}
                </Link>
              );
            })}
            <div className="header__lang">
              <span className="header__lang-label" aria-hidden="true">{t('nav.lang')}</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="header__lang-select"
                aria-label="Select language"
              >
                <option value="en">{languageNames.en}</option>
                <option value="fr">{languageNames.fr}</option>
                <option value="rw">{languageNames.rw}</option>
              </select>
            </div>
            <Link
              to="/get-started"
              className="header__cta header__cta--link"
              onClick={() => setMenuOpen(false)}
            >
              {t('nav.getStarted')}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
