/**
 * Netlify serverless function: POST /.netlify/functions/chat
 * Placed at repo-root /netlify/functions/ — Netlify's default discovery path,
 * always found regardless of `base` directory setting in netlify.toml.
 *
 * Calls the HF Inference API directly.  Bypasses Render entirely for chat so
 * Render's 30 s free-tier timeout is never hit.
 *
 * Required Netlify env var:
 *   HF_API_TOKEN  — Hugging Face token (read access is enough)
 *     → Netlify UI: Site configuration → Environment variables → Add a variable
 *
 * Optional Netlify env vars:
 *   CHATBOT_HF_REPO        — default: Annemarie535257/agrifinconnect-chatbot
 *   CHATBOT_INPUT_PREFIX   — default: "answer the question: "
 *   CHATBOT_MAX_NEW_TOKENS — default: 128
 *
 * Cold-start behaviour:
 *   HF loads the model on first request (~20-60 s). Rather than hanging and
 *   hitting Netlify's 10 s timeout, we detect the 503 "model loading" response
 *   immediately and return a friendly "warming up" message. The user just needs
 *   to retry once the model is warm (usually <30 s after the first request).
 */

const CHATBOT_REPO =
  process.env.CHATBOT_HF_REPO || 'Annemarie535257/agrifinconnect-chatbot';
const INPUT_PREFIX =
  process.env.CHATBOT_INPUT_PREFIX || 'answer the question: ';
const MAX_NEW_TOKENS = parseInt(process.env.CHATBOT_MAX_NEW_TOKENS || '128', 10);

const HF_INFERENCE_BASE = 'https://router.huggingface.co/hf-inference/models';

const TRANSLATION_MODELS = {
  fr_en: 'Helsinki-NLP/opus-mt-fr-en',
  en_fr: 'Helsinki-NLP/opus-mt-en-fr',
  rw_en: 'Helsinki-NLP/opus-mt-rw-en',
  en_rw: 'Helsinki-NLP/opus-mt-en-rw',
};

const WARMING_MESSAGES = {
  en: 'The AI model is warming up on the server (this takes about 20-30 seconds on first use). Please send your message again in a moment.',
  fr: "Le modèle IA se réchauffe sur le serveur (environ 20-30 secondes au premier lancement). Veuillez renvoyer votre message dans un instant.",
  rw: "Modèle ya AI itangira gutegurwa kuri seriveri (nk'amasegonda 20-30 ubwa mbere). Nyamuneka, ohereza ubutumwa bwawe vuba.",
};

/**
 * Call the HF Inference API.
 * Does NOT use wait_for_model:true — that keeps the HTTP connection open for
 * up to 60 s which exceeds Netlify's 10 s function timeout.
 * Instead we return immediately on 503 and let the caller show a retry message.
 */
async function hfInfer(modelRepo, inputs, extraParams, token) {
  const url = `${HF_INFERENCE_BASE}/${modelRepo}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs,
      parameters: { max_new_tokens: MAX_NEW_TOKENS, ...extraParams },
      options: { wait_for_model: false, use_cache: true },
    }),
  });

  if (res.status === 503) {
    // Model is cold / loading — tell caller to show a retry message
    return { loading: true };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HF API ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  if (Array.isArray(json) && json.length > 0 && json[0].generated_text !== undefined) {
    return { text: json[0].generated_text };
  }
  if (json && json.generated_text !== undefined) {
    return { text: json.generated_text };
  }
  throw new Error(`Unexpected HF response: ${JSON.stringify(json).slice(0, 300)}`);
}

async function translate(text, modelKey, token) {
  if (!text) return text;
  try {
    const result = await hfInfer(TRANSLATION_MODELS[modelKey], text, { max_new_tokens: 512 }, token);
    return result.text || text; // fall back to original on loading/error
  } catch {
    return text;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // ── Token check ──────────────────────────────────────────────────────────
  const token = process.env.HF_API_TOKEN;
  if (!token) {
    const msg =
      '[Setup] HF_API_TOKEN is missing. In Netlify: Site configuration → ' +
      'Environment variables → Add variable: HF_API_TOKEN = your HF read token. Then redeploy.';
    console.error(msg);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: msg }),
    };
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

  // ── Inference ─────────────────────────────────────────────────────────────
  try {
    // 1. Translate question to English for FR/RW
    let englishMessage = message;
    if (language === 'fr') {
      englishMessage = await translate(message, 'fr_en', token);
    } else if (language === 'rw') {
      englishMessage = await translate(message, 'rw_en', token);
    }

    // 2. Run chatbot model
    const result = await hfInfer(CHATBOT_REPO, `${INPUT_PREFIX}${englishMessage}`, {}, token);

    if (result.loading) {
      // Model cold — tell user to retry (don't hang / time out)
      const warmingMsg = WARMING_MESSAGES[language] || WARMING_MESSAGES.en;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: warmingMsg, warming_up: true }),
      };
    }

    // 3. Translate reply back
    let reply = result.text;
    if (language === 'fr') {
      reply = await translate(result.text, 'en_fr', token);
    } else if (language === 'rw') {
      reply = await translate(result.text, 'en_rw', token);
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
