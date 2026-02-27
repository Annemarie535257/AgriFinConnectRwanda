import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { chat } from '../api/client';
import { languageNames } from '../translations';
import './FloatingChatbot.css';

/** Floating AI chatbot icon — expands on click, minimizes via button. Assists farmers and visitors. */
export default function FloatingChatbot() {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [chatLang, setChatLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    setReply(null);
    setError(null);
    try {
      const data = await chat(message.trim(), chatLang);
      setReply(data.reply ?? data.response ?? data.message ?? data.text ?? JSON.stringify(data));
    } catch (err) {
      setError(err.status ? `API error ${err.status}` : t('apiError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`floating-chatbot ${expanded ? 'floating-chatbot--expanded' : ''}`}>
      {expanded ? (
        <div className="floating-chatbot__panel">
          <div className="floating-chatbot__header">
            <span className="floating-chatbot__title">
              <span className="floating-chatbot__icon" aria-hidden="true">
                <ChatbotIcon />
              </span>
              {t('floatingChatbot.title')}
            </span>
            <button
              type="button"
              className="floating-chatbot__minimize"
              onClick={() => setExpanded(false)}
              aria-label={t('floatingChatbot.minimize')}
            >
              <MinimizeIcon />
            </button>
          </div>
          <p className="floating-chatbot__desc">{t('floatingChatbot.desc')}</p>
          <form className="floating-chatbot__form" onSubmit={handleSubmit}>
            <label className="floating-chatbot__field">
              <span className="floating-chatbot__label">{t('card4.language')}</span>
              <select
                value={chatLang}
                onChange={(e) => setChatLang(e.target.value)}
                className="floating-chatbot__input"
              >
                <option value="en">{languageNames.en}</option>
                <option value="fr">{languageNames.fr}</option>
                <option value="rw">{languageNames.rw}</option>
              </select>
            </label>
            <label className="floating-chatbot__field">
              <span className="floating-chatbot__label">{t('card4.message')}</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('card4.messagePlaceholder')}
                rows={3}
                className="floating-chatbot__input floating-chatbot__textarea"
              />
            </label>
            <button
              type="submit"
              className="floating-chatbot__submit"
              disabled={loading || !message.trim()}
            >
              {loading ? t('card4.sending') : t('card4.send')}
            </button>
          </form>
          {error && <p className="floating-chatbot__error">{error}</p>}
          {reply && (
            <div className="floating-chatbot__reply">
              <strong>{t('card4.reply')}</strong>
              <p className="floating-chatbot__reply-text">{reply}</p>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="floating-chatbot__trigger"
          onClick={() => setExpanded(true)}
          aria-label={t('floatingChatbot.openLabel')}
          title={t('floatingChatbot.openLabel')}
        >
          <span className="floating-chatbot__trigger-icon">
            <ChatbotIcon />
          </span>
          <span className="floating-chatbot__trigger-label">{t('floatingChatbot.openLabel')}</span>
        </button>
      )}
    </div>
  );
}

function ChatbotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
