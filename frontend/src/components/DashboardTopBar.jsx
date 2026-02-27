import { useLanguage } from '../context/LanguageContext';
import { languageNames } from '../translations';
import { HomeIcon } from './DashboardIcons';
import './DashboardTopBar.css';

export default function DashboardTopBar({ title, showSearch = true }) {
  const { t, language, setLanguage } = useLanguage();

  return (
    <header className="dashboard-topbar">
      <h1 className="dashboard-topbar__title">
        <HomeIcon className="dashboard-topbar__icon" />
        {title}
      </h1>
      <div className="dashboard-topbar__right">
          <div className="dashboard-topbar__lang">
            <label className="dashboard-topbar__lang-label" htmlFor="dashboard-lang">
              {t('nav.lang')}
            </label>
            <select
              id="dashboard-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="dashboard-topbar__lang-select"
              aria-label="Select language"
            >
              <option value="en">{languageNames.en}</option>
              <option value="fr">{languageNames.fr}</option>
              <option value="rw">{languageNames.rw}</option>
            </select>
          </div>
          {showSearch && (
            <input
              type="search"
              className="dashboard-topbar__search"
              placeholder={t('dashboard.search') || 'Search'}
              aria-label="Search"
            />
          )}
      </div>
    </header>
  );
}
