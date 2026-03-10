/**
 * Netlify serverless function: POST /.netlify/functions/chat
 *
 * Proxies chat requests to the Render Django backend (/api/chat/).
 * This solves the original timeout: the browser→Render direct call was hitting
 * Render's 30 s free-tier limit during cold starts. The Netlify function gets
 * 26 s and handles the cold-start gracefully by returning a "please retry" msg.
 *
 * When Render is already warm the round-trip is 1–5 s and works perfectly.
 */

const RENDER_API = (process.env.VITE_API_URL || 'https://agrifinconnectrwanda.onrender.com/api').replace(/\/$/, '');

const WARMING_MESSAGES = {
  en: 'The server is waking up (Render free tier sleeps after inactivity). Please send your message again in about 30 seconds.',
  fr: "Le serveur se réveille (le plan gratuit Render s'endort après inactivité). Veuillez renvoyer votre message dans environ 30 secondes.",
  rw: "Seriveri irakanguka (Render ya mahoro isinzira). Nyamuneka, ohereza ubutumwa bwawe vuba mu masegonda 30.",
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let message = '';
  let language = 'en';
  try {
    const payload = JSON.parse(event.body || '{}');
    message = (payload.message || '').trim();
    language = (payload.language || 'en').trim().toLowerCase();
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!message) {
    return { statusCode: 400, body: JSON.stringify({ error: 'message is required' }) };
  }

  const supportedLanguages = ['en', 'fr', 'rw'];
  if (!supportedLanguages.includes(language)) language = 'en';

  const controller = new AbortController();
  // 24 s — leaves 2 s margin before Netlify's 26 s hard limit
  const timeoutId = setTimeout(() => controller.abort(), 24000);

  try {
    const res = await fetch(`${RENDER_API}/chat/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, language }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Render cold-start returns 502/503/504 — tell user to retry
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reply: WARMING_MESSAGES[language] || WARMING_MESSAGES.en,
          warming_up: true,
        }),
      };
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    clearTimeout(timeoutId);
    // AbortError = our 24 s timeout fired — Render is still waking up
    if (err.name === 'AbortError') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reply: WARMING_MESSAGES[language] || WARMING_MESSAGES.en,
          warming_up: true,
        }),
      };
    }
    console.error('Chat proxy error:', err.message);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: `[Chatbot error] ${err.message}` }),
    };
  }
};


const CHATBOT_REPO =
  process.env.CHATBOT_HF_REPO || 'Annemarie535257/agrifinconnect-chatbot';
const INPUT_PREFIX =
const SPACE_REPO =
  process.env.CHATBOT_HF_SPACE || 'Annemarie535257/agrifinconnect-chatbot-api';
const INPUT_PREFIX =
  process.env.CHATBOT_INPUT_PREFIX || 'answer the question: ';

// Derive Gradio Space URL from repo name (e.g. User/my-space → user-my-space.hf.space)
const SPACE_BASE_URL = `https://${SPACE_REPO.replace('/', '-').toLowerCase()}.hf.space`;

const HF_ROUTER = 'https://router.huggingface.co/hf-inference/models';

const TRANSLATION_MODELS = {
  fr_en: 'Helsinki-NLP/opus-mt-fr-en',
  en_fr: 'Helsinki-NLP/opus-mt-en-fr',
  rw_en: 'Helsinki-NLP/opus-mt-rw-en',
  en_rw: 'Helsinki-NLP/opus-mt-en-rw',
};

const WARMING_MESSAGES = {
  en: 'The AI model is warming up (first use takes ~30 seconds). Please send your message again in a moment.',
  fr: "Le modèle IA se prépare (environ 30 secondes au premier lancement). Veuillez renvoyer votre message dans un instant.",
  rw: "Modèle ya AI iri gutegurwa (nk'amasegonda 30 ubwa mbere). Nyamuneka, ohereza ubutumwa bwawe vuba.",
};

/** Call the Gradio Space /api/predict endpoint. Times out after 22 s. */
async function callGradioSpace(message) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 22000);
  try {
    const res = await fetch(`${SPACE_BASE_URL}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [`${INPUT_PREFIX}${message}`], fn_index: 0 }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.status === 503 || res.status === 504 || res.status === 502) {
      return { loading: true };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Space API ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    // Gradio returns { data: ["reply text"] }
    if (Array.isArray(json.data) && json.data.length > 0) {
      return { text: String(json.data[0]) };
    }
    throw new Error(`Unexpected Space response: ${JSON.stringify(json).slice(0, 200)}`);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') return { loading: true };
    throw err;
  }
}

/** Translate text via HF Inference router (Helsinki-NLP MarianMT). Falls back to original. */
async function translate(text, modelId, token) {
  if (!text || !token) return text;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${HF_ROUTER}/${modelId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return text;
    const json = await res.json();
    if (Array.isArray(json) && json[0]?.translation_text) return json[0].translation_text;
    return text;
  } catch {
    clearTimeout(timeoutId);
    return text; // graceful degradation
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let message = '';
  let language = 'en';
  try {
    const payload = JSON.parse(event.body || '{}');
    message = (payload.message || '').trim();
    language = (payload.language || 'en').trim().toLowerCase();
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!message) {
    return { statusCode: 400, body: JSON.stringify({ error: 'message is required' }) };
  }

  const supportedLanguages = ['en', 'fr', 'rw'];
  if (!supportedLanguages.includes(language)) language = 'en';

  // HF_API_TOKEN is optional — only needed for translation
  const token = process.env.HF_API_TOKEN || '';

  // ── Inference ─────────────────────────────────────────────────────────────
  try {
    // 1. Translate question to English for FR/RW
    let englishMessage = message;
    if (language === 'fr') {
      englishMessage = await translate(message, TRANSLATION_MODELS.fr_en, token);
    } else if (language === 'rw') {
      englishMessage = await translate(message, TRANSLATION_MODELS.rw_en, token);
    }

    // 2. Run chatbot via Gradio Space
    const result = await callGradioSpace(englishMessage);
    if (result.loading) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reply: WARMING_MESSAGES[language] || WARMING_MESSAGES.en,
          warming_up: true,
        }),
      };
    }

    // 3. Translate reply back
    let reply = result.text;
    if (language === 'fr') {
      reply = await translate(result.text, TRANSLATION_MODELS.en_fr, token);
    } else if (language === 'rw') {
      reply = await translate(result.text, TRANSLATION_MODELS.en_rw, token);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply, response: reply }),
    };
  } catch (err) {
    console.error('Chat function error:', err.message);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: `[Chatbot error] ${err.message}` }),
    };
  }
};

