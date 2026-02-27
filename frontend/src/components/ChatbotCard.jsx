import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { chat } from '../api/client';
import { languageNames } from '../translations';
import './Card.css';
import './ChatbotCard.css';

export default function ChatbotCard() {
  const { t } = useLanguage();
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
    <section className="card card--chat" aria-labelledby="chat-heading">
      <h2 id="chat-heading" className="card__title">{t('card4.title')}</h2>
      <p className="card__desc">{t('card4.desc')}</p>
      <form className="chatbot-form" onSubmit={handleSubmit}>
        <label className="card__label">
          {t('card4.language')}
          <select
            value={chatLang}
            onChange={(e) => setChatLang(e.target.value)}
            className="card__input"
          >
            <option value="en">{languageNames.en}</option>
            <option value="fr">{languageNames.fr}</option>
            <option value="rw">{languageNames.rw}</option>
          </select>
        </label>
        <label className="card__label chatbot-form__message">
          {t('card4.message')}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('card4.messagePlaceholder')}
            rows={3}
            className="card__input"
          />
        </label>
        <button type="submit" className="card__btn" disabled={loading || !message.trim()}>
          {loading ? t('card4.sending') : t('card4.send')}
        </button>
      </form>
      {error && <div className="card__message card__message--error">{error}</div>}
      {reply && (
        <div className="chatbot-reply">
          <strong>{t('card4.reply')}</strong>
          <p className="chatbot-reply__text">{reply}</p>
        </div>
      )}
    </section>
  );
}
