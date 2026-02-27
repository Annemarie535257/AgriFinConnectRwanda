import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './BackToTop.css';

export default function BackToTop() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      className="back-to-top"
      onClick={scrollToTop}
      aria-label={t('backToTop.ariaLabel')}
    >
      <span className="back-to-top__icon" aria-hidden="true">↑</span>
    </button>
  );
}
