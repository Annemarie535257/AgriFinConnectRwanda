import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './FaqSection.css';

const FAQ_KEYS = ['whatIsPlatform', 'whoCanUse', 'howApplicationsWork', 'howAIUsed', 'dataSecurity'];

export default function FaqSection() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();
  const filteredKeys = FAQ_KEYS.filter((key) => {
    if (!normalizedQuery) return true;
    const q = t(`faq.items.${key}.q`)?.toLowerCase() || '';
    const a = t(`faq.items.${key}.a`)?.toLowerCase() || '';
    return q.includes(normalizedQuery) || a.includes(normalizedQuery);
  });

  return (
    <section id="faq" className="faq landing-section" aria-labelledby="faq-heading">
      <div className="faq__inner">
        <div className="faq__header">
          <div>
            <h2 id="faq-heading" className="faq__title">
              {t('faq.title')}
            </h2>
            <p className="faq__lead">{t('faq.lead')}</p>
          </div>
          <div className="faq__search-wrap">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="faq__search"
              placeholder={t('faq.searchPlaceholder') || 'Search question here'}
              aria-label={t('faq.searchPlaceholder') || 'Search question here'}
            />
          </div>
        </div>

        <div className="faq__body">
          <div className="faq__list">
            {filteredKeys.map((key) => (
              <details key={key} className="faq__item">
                <summary className="faq__question">
                  <span>{t(`faq.items.${key}.q`)}</span>
                </summary>
                <p className="faq__answer">{t(`faq.items.${key}.a`)}</p>
              </details>
            ))}
            {filteredKeys.length === 0 && (
              <p className="faq__empty">
                {t('faq.empty') || 'No questions match your search yet.'}
              </p>
            )}
          </div>

          <div className="faq__illustration" aria-hidden="true">
            <img src="/FAQs-alt.jpg" alt="" className="faq__image" loading="lazy" />
            <div className="faq__illustration-overlay">
              <div className="faq__illustration-badge">FAQ</div>
              <p className="faq__illustration-text">
                {t('faq.sideText') ||
                  'Find quick answers about how AgriFinConnect Rwanda works for farmers and microfinance institutions.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

