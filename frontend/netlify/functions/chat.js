/**
 * Netlify serverless function: POST /.netlify/functions/chat
 *
 * Production chatbot proxy. This forwards requests to Django /api/chat/
 * and returns a user-friendly warming message during cold starts.
 */

const API_BASE = (
  process.env.RENDER_API_URL ||
  process.env.API_BASE_URL ||
  process.env.VITE_API_URL ||
  'https://agrifinconnectrwanda.onrender.com/api'
).replace(/\/$/, '');

const WARMING_MESSAGES = {
  en: 'The chatbot server is waking up. Please try again in about 30 seconds.',
  fr: 'Le serveur du chatbot se reveille. Veuillez reessayer dans environ 30 secondes.',
  rw: 'Seriveri ya chatbot iri kubyuka. Ongera ugerageze mu masegonda nka 30.',
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  let message = '';
  let language = 'en';

  try {
    const body = JSON.parse(event.body || '{}');
    message = String(body.message || '').trim();
    language = String(body.language || 'en').trim().toLowerCase();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  if (!message) {
    return json(400, { error: 'message is required' });
  }

  if (!['en', 'fr', 'rw'].includes(language)) {
    language = 'en';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 24000);

  try {
    const upstream = await fetch(`${API_BASE}/chat/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, language }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if ([502, 503, 504].includes(upstream.status)) {
      return json(200, {
        reply: WARMING_MESSAGES[language] || WARMING_MESSAGES.en,
        response: WARMING_MESSAGES[language] || WARMING_MESSAGES.en,
        warming_up: true,
      });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return json(200, {
        reply: `Chatbot temporarily unavailable (${upstream.status}). ${text.slice(0, 180)}`,
        response: `Chatbot temporarily unavailable (${upstream.status}). ${text.slice(0, 180)}`,
      });
    }

    if (contentType.includes('application/json')) {
      const data = await upstream.json();
      return json(200, data);
    }

    const text = await upstream.text();
    return json(200, { reply: text, response: text });
  } catch (err) {
    clearTimeout(timeoutId);

    if (err && err.name === 'AbortError') {
      return json(200, {
        reply: WARMING_MESSAGES[language] || WARMING_MESSAGES.en,
        response: WARMING_MESSAGES[language] || WARMING_MESSAGES.en,
        warming_up: true,
      });
    }

    return json(200, {
      reply: 'Chatbot service is currently unavailable. Please try again shortly.',
      response: 'Chatbot service is currently unavailable. Please try again shortly.',
    });
  }
};
