/**
 * Netlify serverless function: POST /.netlify/functions/chat
 * Calls the HF Inference API directly so the chatbot never touches Render.
 * Render times out (30 s free tier) before the model can respond; here the
 * request is handled on HF's own hardware and the function just proxies it.
 *
 * Required Netlify env var:
 *   HF_API_TOKEN  — your Hugging Face API token (read or write, read is fine)
 *
 * Optional Netlify env vars (defaults shown):
 *   CHATBOT_HF_REPO       — e.g. Annemarie535257/agrifinconnect-chatbot
 *   CHATBOT_INPUT_PREFIX  — "answer the question: "
 *   CHATBOT_MAX_NEW_TOKENS — 128
 */

const CHATBOT_REPO =
  process.env.CHATBOT_HF_REPO || 'Annemarie535257/agrifinconnect-chatbot';
const INPUT_PREFIX =
  process.env.CHATBOT_INPUT_PREFIX || 'answer the question: ';
const MAX_NEW_TOKENS = parseInt(process.env.CHATBOT_MAX_NEW_TOKENS || '128', 10);

// MarianMT Helsinki-NLP models used by the Django backend for translation
const TRANSLATION_MODELS = {
  fr_en: 'Helsinki-NLP/opus-mt-fr-en',
  en_fr: 'Helsinki-NLP/opus-mt-en-fr',
  rw_en: 'Helsinki-NLP/opus-mt-rw-en',
  en_rw: 'Helsinki-NLP/opus-mt-en-rw',
};

const HF_INFERENCE_BASE = 'https://api-inference.huggingface.co/models';

// Friendly fallback messages mirroring the Django backend
const FALLBACK = {
  en: 'Thank you for your message. The chatbot model is not available right now. To apply for a loan, use the Loan Eligibility and Loan Amount Recommendation tools. We support Kinyarwanda, English, and French.',
  fr: "Merci pour votre message. Le modèle du chatbot n'est pas disponible. Pour demander un prêt, utilisez les outils d'éligibilité et de recommandation ci-dessus.",
  rw: "Murakoze kubutumwa. Modèle y'ikibazo ntabwo iri. Kugira ngo usabe inguzanyo, koresha ibikoresho by'emera no gutoranya inguzanyo hejuru.",
};

/**
 * Call the HF Inference API for a text2text / seq2seq model.
 * Returns the generated string, or throws on non-retryable errors.
 * Handles the 503 "model is loading" case with one automatic retry.
 */
async function hfInfer(modelRepo, inputs, extraParams = {}, token, retries = 1) {
  const url = `${HF_INFERENCE_BASE}/${modelRepo}`;
  const body = JSON.stringify({
    inputs,
    parameters: { max_new_tokens: MAX_NEW_TOKENS, ...extraParams },
    options: { wait_for_model: true, use_cache: false },
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  if (res.status === 503 && retries > 0) {
    // Model still loading — HF said wait_for_model but occasionally returns 503 anyway
    const json = await res.json().catch(() => ({}));
    const wait = Math.min((json.estimated_time || 20) * 1000, 8000);
    await new Promise((r) => setTimeout(r, wait));
    return hfInfer(modelRepo, inputs, extraParams, token, retries - 1);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HF API ${res.status} for ${modelRepo}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  // Seq2seq / text2text returns [{ generated_text: "..." }]
  if (Array.isArray(json) && json.length > 0 && json[0].generated_text !== undefined) {
    return json[0].generated_text;
  }
  // Some models return { generated_text: "..." } directly
  if (json && json.generated_text !== undefined) {
    return json.generated_text;
  }
  throw new Error(`Unexpected HF response shape: ${JSON.stringify(json).slice(0, 200)}`);
}

async function translateViaHF(text, modelKey, token) {
  const modelRepo = TRANSLATION_MODELS[modelKey];
  if (!modelRepo) return text;
  try {
    return await hfInfer(modelRepo, text, { max_new_tokens: 512 }, token);
  } catch (e) {
    console.warn(`Translation ${modelKey} failed, using original text:`, e.message);
    return text; // graceful degradation
  }
}

exports.handler = async (event) => {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const token = process.env.HF_API_TOKEN;
  if (!token) {
    const msg = '[Config error] HF_API_TOKEN is not set in Netlify environment variables. Go to: Netlify site → Site configuration → Environment variables → add HF_API_TOKEN with your Hugging Face read token → redeploy.';
    console.error(msg);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: msg }),
    };
  }

  let message = '';
  let language = 'en';
  try {
    const payload = JSON.parse(event.body || '{}');
    message = (payload.message || '').trim();
    language = (payload.language || 'en').trim().toLowerCase();
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!message) {
    return { statusCode: 400, body: JSON.stringify({ error: 'message is required' }) };
  }

  // Validate language to prevent unexpected values being used in API calls
  const supportedLanguages = ['en', 'fr', 'rw'];
  if (!supportedLanguages.includes(language)) language = 'en';

  try {
    // 1. Translate input to English for non-English languages
    let englishMessage = message;
    if (language === 'fr') {
      englishMessage = await translateViaHF(message, 'fr_en', token);
    } else if (language === 'rw') {
      englishMessage = await translateViaHF(message, 'rw_en', token);
    }

    // 2. Run the chatbot model (flan-T5-small fine-tuned on mortgage/loan data)
    const promptedInput = `${INPUT_PREFIX}${englishMessage}`;
    const englishReply = await hfInfer(CHATBOT_REPO, promptedInput, {}, token);

    // 3. Translate reply back to the requested language
    let reply = englishReply;
    if (language === 'fr') {
      reply = await translateViaHF(englishReply, 'en_fr', token);
    } else if (language === 'rw') {
      reply = await translateViaHF(englishReply, 'en_rw', token);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply, response: reply }),
    };
  } catch (err) {
    console.error('Chat function error:', err);
    // Surface the real error in the reply so it's visible for debugging
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: `[Chatbot error] ${err.message}` }),
    };
  }
};
