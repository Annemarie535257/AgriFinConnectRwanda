/**
 * Netlify serverless function: POST /.netlify/functions/chat
 *
 * Architecture:
 *  - Main chatbot  → HF Gradio Space (free, public, no token required)
 *    https://huggingface.co/spaces/Annemarie535257/agrifinconnect-chatbot-api
 *  - Translation   → HF Inference router (Helsinki-NLP MarianMT models)
 *    Requires HF_API_TOKEN env var in Netlify.
 *
 * Why Gradio Space instead of HF Serverless Inference API:
 *  The Serverless Inference API only hosts popular models. Custom fine-tuned
 *  models (like this one) get "No Inference Provider available" errors.
 *  A Gradio Space hosts ANY model for free and exposes a stable HTTP API.
 *
 * Cold-start: The Space sleeps after inactivity. On cold start the /api/predict
 * call takes ~30-60 s to load the model. We time out after 22 s and return a
 * "warming up — please retry" message. Once warm, responses take 1-3 s.
 *
 * Optional Netlify env vars:
 *   HF_API_TOKEN          — for translation (fallback: send untranslated)
 *   CHATBOT_HF_SPACE      — Space repo (default: Annemarie535257/agrifinconnect-chatbot-api)
 *   CHATBOT_INPUT_PREFIX  — prompt prefix (default: "answer the question: ")
 */

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

