import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import {
  HomeIcon,
  ChartIcon,
  FormIcon,
  ProfileIcon,
  LoanIcon,
  ApplicationIcon,
  RepaymentIcon,
  PortfolioIcon,
  UsersIcon,
  ActivityIcon,
} from '../components/DashboardIcons';
import './DashboardLayout.css';

const ALL_DASHBOARD_LINKS = [
  { path: '/dashboard/farmer', key: 'farmers', role: 'farmer', Icon: HomeIcon },
  { path: '/dashboard/microfinance', key: 'microfinances', role: 'microfinance', Icon: ChartIcon },
  { path: '/dashboard/admin', key: 'admin', role: 'admin', Icon: ProfileIcon },
];

const FARMER_SUB_NAV = [
  { tab: 'apply', tKey: 'dashboard.applyLoan', Icon: FormIcon },
  { tab: 'applications', tKey: 'dashboard.myApplications', Icon: ApplicationIcon },
  { tab: 'loans', tKey: 'farmer.myLoans', fallback: 'My loans', Icon: LoanIcon },
  { tab: 'repayments', tKey: 'farmer.repayments', fallback: 'Repayments', Icon: RepaymentIcon },
  { tab: 'farm', tKey: 'farmer.farmData', fallback: 'Farm data', Icon: FormIcon },
  { tab: 'profile', tKey: 'farmer.profile', fallback: 'Profile', Icon: ProfileIcon },
];

const MFI_SUB_NAV = [
  { tab: 'applications', tKey: 'dashboard.reviewApplications', Icon: ApplicationIcon },
  { tab: 'portfolio', tKey: 'mfi.portfolio', Icon: PortfolioIcon },
];

const ADMIN_SUB_NAV = [
  { tab: 'activity', tKey: 'admin.activity', fallback: 'Activity', Icon: ActivityIcon },
  { tab: 'users', tKey: 'dashboard.users', Icon: UsersIcon },
  { tab: 'stats', tKey: 'admin.stats', fallback: 'Stats', Icon: ChartIcon },
];

export default function DashboardLayout() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userRole, setUserRole] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const u = localStorage.getItem('agrifinconnect-user');
      const parsed = u ? JSON.parse(u) : null;
      setUserRole(parsed?.role || null);
    } catch {
      setUserRole(null);
    }
  }, []);

  const links = userRole
    ? ALL_DASHBOARD_LINKS.filter((l) => l.role === userRole)
    : ALL_DASHBOARD_LINKS;

  const isFarmer = location.pathname === '/dashboard/farmer';
  const isMfi = location.pathname === '/dashboard/microfinance';
  const isAdmin = location.pathname === '/dashboard/admin';

  const rawTab = searchParams.get('tab');
  const defaultTab = isFarmer ? 'apply' : isMfi ? 'applications' : 'activity';
  const validFarmerTabs = ['apply', 'applications', 'loans', 'repayments', 'farm', 'profile'];
  const validMfiTabs = ['applications', 'portfolio'];
  const validAdminTabs = ['activity', 'users', 'stats'];
  const validTabs = isFarmer ? validFarmerTabs : isMfi ? validMfiTabs : isAdmin ? validAdminTabs : [];
  const activeTab = (rawTab && validTabs.includes(rawTab)) ? rawTab : defaultTab;

  const subNav = isFarmer ? FARMER_SUB_NAV : isMfi ? MFI_SUB_NAV : isAdmin ? ADMIN_SUB_NAV : [];

  const setTab = (tab) => setSearchParams({ tab });

  return (
    <div className={`dashboard-layout ${sidebarCollapsed ? 'dashboard-layout--collapsed' : ''}`}>
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar__brand">
          <Link to="/" className="dashboard-sidebar__logo">
            <img src="/logo (3).png" alt="" className="dashboard-sidebar__logo-img" />
          </Link>
          <span className="dashboard-sidebar__brand-name">AgriFinConnect</span>
        </div>
        <nav className="dashboard-sidebar__nav" aria-label="Dashboard navigation">
          {links.map(({ path, key, Icon }) => (
            <Link
              key={path}
              to={path}
              className={`dashboard-sidebar__link ${location.pathname === path ? 'dashboard-sidebar__link--active' : ''}`}
            >
              <Icon className="dashboard-sidebar__icon" />
              <span>{t(`getStarted.${key}`)}</span>
            </Link>
          ))}
          {subNav.length > 0 && (
            <div className="dashboard-sidebar__subnav">
              {subNav.map(({ tab, tKey, fallback, Icon }) => (
                <button
                  key={tab}
                  type="button"
                  className={`dashboard-sidebar__sublink ${activeTab === tab ? 'dashboard-sidebar__sublink--active' : ''}`}
                  onClick={() => setTab(tab)}
                >
                  <Icon className="dashboard-sidebar__icon" />
                  <span>{t(tKey) || fallback}</span>
                </button>
              ))}
            </div>
          )}
        </nav>
        <button
          type="button"
          className="dashboard-sidebar__logout"
          onClick={() => {
            localStorage.removeItem('agrifinconnect-token');
            localStorage.removeItem('agrifinconnect-user');
            navigate('/get-started');
          }}
        >
          <span className="dashboard-sidebar__logout-text">{t('getStarted.logout') || 'Logout'}</span>
        </button>
        <button
          type="button"
          className="dashboard-sidebar__toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d={sidebarCollapsed ? 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z' : 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z'} />
          </svg>
        </button>
      </aside>
      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  );
}
