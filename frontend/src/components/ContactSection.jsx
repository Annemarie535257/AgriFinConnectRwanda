import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './ContactSection.css';

const SERVICE_KEYS = ['service1', 'service2', 'service3', 'service4', 'service5', 'service6'];

export default function ContactSection() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section id="contact" className="contact landing-section" aria-labelledby="contact-heading" style={{ animationDelay: '0.22s' }}>
      <div className="contact__inner">
        <h2 id="contact-heading" className="contact__title">{t('contact.title')}</h2>
        <p className="contact__lead">{t('contact.lead')}</p>
        <div className="contact__two-col">
          <div className="contact__info">
            <div className="contact__block">
              <span className="contact__block-icon" aria-hidden="true">📍</span>
              <h3 className="contact__block-title">{t('contact.address')}</h3>
              <p className="contact__block-value">{t('contact.addressValue')}</p>
            </div>
            <div className="contact__block">
              <span className="contact__block-icon" aria-hidden="true">📞</span>
              <h3 className="contact__block-title">{t('contact.letsTalk')}</h3>
              <p className="contact__block-value">{t('contact.phoneValue')}</p>
            </div>
            <div className="contact__block">
              <span className="contact__block-icon" aria-hidden="true">✉️</span>
              <h3 className="contact__block-title">{t('contact.support')}</h3>
              <p className="contact__block-value">{t('contact.emailValue')}</p>
            </div>
            <div className="contact__block contact__block--services">
              <h3 className="contact__block-title">{t('contact.servicesWeOffer')}</h3>
              <ul className="contact__services-list">
                {SERVICE_KEYS.map((key) => (
                  <li key={key}>{t(`contact.${key}`)}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="contact__form-wrap">
            <h3 className="contact__form-title">{t('contact.sendMessage')}</h3>
            {submitted ? (
              <p className="contact__form-thanks">{t('contact.footer')}</p>
            ) : (
              <form className="contact__form" onSubmit={handleSubmit}>
                <div className="contact__form-row">
                  <label className="contact__form-label" htmlFor="contact-name">
                    {t('contact.nameLabel')}
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    name="name"
                    className="contact__form-input"
                    placeholder={t('contact.namePlaceholder')}
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="contact__form-row">
                  <label className="contact__form-label" htmlFor="contact-email">
                    {t('contact.emailLabel')}
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    name="email"
                    className="contact__form-input"
                    placeholder={t('contact.emailPlaceholder')}
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="contact__form-row">
                  <label className="contact__form-label" htmlFor="contact-subject">
                    {t('contact.subjectLabel')}
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    name="subject"
                    className="contact__form-input"
                    placeholder={t('contact.subjectPlaceholder')}
                    value={formData.subject}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="contact__form-row">
                  <label className="contact__form-label" htmlFor="contact-message">
                    {t('contact.messageLabel')}
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    className="contact__form-input contact__form-textarea"
                    placeholder={t('contact.messagePlaceholder')}
                    value={formData.message}
                    onChange={handleChange}
                    rows={4}
                    required
                  />
                </div>
                <button type="submit" className="contact__form-submit">
                  {t('contact.sendButton')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
