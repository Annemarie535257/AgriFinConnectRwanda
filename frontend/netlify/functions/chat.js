/**
 * Netlify serverless function: POST /.netlify/functions/chat
 * Uses the official @huggingface/inference SDK — handles routing automatically.
 *
 * IMPORTANT: The HF model repo must be PUBLIC.
 *   → huggingface.co/Annemarie535257/agrifinconnect-chatbot
 *     → Settings → Change visibility → Public
 *
 * Required Netlify env var:
 *   HF_API_TOKEN  — Hugging Face token (read access is enough)
 *
 * Cold-start: HF loads the model on first request (~20-60 s for 300 MB model).
 * We detect this immediately and return a "please retry" message.
 */
import { InferenceClient } from '@huggingface/inference';

const CHATBOT_REPO =
  process.env.CHATBOT_HF_REPO || 'Annemarie535257/agrifinconnect-chatbot';
const INPUT_PREFIX =
  process.env.CHATBOT_INPUT_PREFIX || 'answer the question: ';
const MAX_NEW_TOKENS = parseInt(process.env.CHATBOT_MAX_NEW_TOKENS || '128', 10);

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

function isLoadingError(err) {
  const msg = err?.message || '';
  return (
    msg.includes('loading') ||
    msg.includes('503') ||
    msg.includes('currently loading') ||
    msg.includes('estimated_time')
  );
}

async function runChatbot(client, englishMessage) {
  const output = await client.textGeneration({
    model: CHATBOT_REPO,
    inputs: `${INPUT_PREFIX}${englishMessage}`,
    parameters: { max_new_tokens: MAX_NEW_TOKENS },
  });
  return output.generated_text;
}

async function runTranslation(client, text, modelId) {
  try {
    const output = await client.translation({
      model: modelId,
      inputs: text,
    });
    // SDK returns { translation_text } or [{ translation_text }]
    if (Array.isArray(output)) return output[0]?.translation_text || text;
    return output?.translation_text || text;
  } catch {
    return text; // graceful degradation — use original on translation failure
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // ── Token check ──────────────────────────────────────────────────────────
  const token = process.env.HF_API_TOKEN;
  if (!token) {
    const msg =
      '[Setup error] HF_API_TOKEN is not set. ' +
      'Netlify → Site configuration → Environment variables → Add HF_API_TOKEN → Redeploy.';
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

  const client = new InferenceClient(token);

  // ── Inference ─────────────────────────────────────────────────────────────
  try {
    // 1. Translate question to English for FR/RW
    let englishMessage = message;
    if (language === 'fr') {
      englishMessage = await runTranslation(client, message, TRANSLATION_MODELS.fr_en);
    } else if (language === 'rw') {
      englishMessage = await runTranslation(client, message, TRANSLATION_MODELS.rw_en);
    }

    // 2. Run chatbot model
    let englishReply;
    try {
      englishReply = await runChatbot(client, englishMessage);
    } catch (err) {
      if (isLoadingError(err)) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reply: WARMING_MESSAGES[language] || WARMING_MESSAGES.en,
            warming_up: true,
          }),
        };
      }
      throw err;
    }

    // 3. Translate reply back
    let reply = englishReply;
    if (language === 'fr') {
      reply = await runTranslation(client, englishReply, TRANSLATION_MODELS.en_fr);
    } else if (language === 'rw') {
      reply = await runTranslation(client, englishReply, TRANSLATION_MODELS.en_rw);
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
