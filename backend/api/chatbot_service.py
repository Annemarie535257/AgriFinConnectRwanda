"""
Load the saved T5 chatbot model (saved-model/ or AI_Chatbot_model/) and generate replies.
Model is from Financial_LLM_Chatbot.ipynb (Flan-T5-small fine-tuned on Bitext mortgage/loans).

When CHATBOT_MODEL_DIR exists, loads from local path. When it does not (e.g. on Render),
loads from Hugging Face Hub if CHATBOT_MODEL_HF_REPO is set (e.g. Annemarie535257/agrifinconnect-chatbot).

Uses PyTorch (T5ForConditionalGeneration) when possible so the chatbot works on Render without
TensorFlow. Falls back to TensorFlow (TFT5ForConditionalGeneration) if PyTorch load fails
and TensorFlow is available (e.g. local TF-only saved model).

Set CHATBOT_DISABLED=1 environment variable to skip model loading entirely (e.g. on memory-
constrained hosts like Render free tier). The chat endpoint will return a static fallback reply.
"""
import logging
import os
from functools import lru_cache
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)

# When CHATBOT_DISABLED=1 (or truthy) is set, skip all model loading to avoid OOM on Render.
CHATBOT_DISABLED = os.environ.get('CHATBOT_DISABLED', '').strip() in ('1', 'true', 'yes')

# Saved model dir: project root / saved-model (same as notebook output). Resolved to absolute path.
_project_root = getattr(settings, 'PROJECT_ROOT', None) or Path(__file__).resolve().parent.parent.parent
_custom_dir = getattr(settings, 'CHATBOT_MODEL_DIR', None)
CHATBOT_MODEL_DIR = Path(_custom_dir).resolve() if _custom_dir else (_project_root / 'saved-model').resolve()
# Hugging Face Hub repo when local dir is missing (e.g. Render). Empty string = do not use Hub.
CHATBOT_MODEL_HF_REPO = (getattr(settings, 'CHATBOT_MODEL_HF_REPO', None) or '').strip()

# Input prefix used during training (Financial_LLM_Chatbot.ipynb)
INPUT_PREFIX = "answer the question: "
MAX_INPUT_LENGTH = 128
DEFAULT_MAX_NEW_TOKENS = 64
DEFAULT_TEMPERATURE = 0.0
CHATBOT_CACHE_SIZE = max(0, int(os.environ.get('CHATBOT_CACHE_SIZE', '256') or 256))
CHATBOT_SHORT_REPLY_MODE = os.environ.get('CHATBOT_SHORT_REPLY_MODE', '1').strip().lower() in ('1', 'true', 'yes')
SHORT_REPLY_MAX_NEW_TOKENS = max(16, int(os.environ.get('SHORT_REPLY_MAX_NEW_TOKENS', '40') or 40))
SHORT_REPLY_MAX_INPUT_CHARS = max(40, int(os.environ.get('SHORT_REPLY_MAX_INPUT_CHARS', '220') or 220))

_tokenizer = None
_model = None
_use_torch = True  # True = PyTorch, False = TensorFlow
_load_error = None


def get_load_error():
    """Return the last load error message (or None). Useful for debugging."""
    global _load_error
    if _load_error is None:
        return None
    return f"{type(_load_error).__name__}: {_load_error}"


def _load_chatbot():
    """Lazy-load tokenizer and T5 model. Prefer PyTorch (works on Render without TensorFlow).
    Uses local CHATBOT_MODEL_DIR if it exists; otherwise loads from Hugging Face Hub if CHATBOT_MODEL_HF_REPO is set.
    """
    global _tokenizer, _model, _use_torch, _load_error
    if CHATBOT_DISABLED:
        logger.info("Chatbot model loading skipped (CHATBOT_DISABLED=1)")
        return False
    if _model is not None and _tokenizer is not None:
        return True
    if _load_error is not None:
        return False

    use_hub = not CHATBOT_MODEL_DIR.exists() and bool(CHATBOT_MODEL_HF_REPO)
    load_path = CHATBOT_MODEL_HF_REPO if use_hub else str(CHATBOT_MODEL_DIR)

    if not use_hub and not CHATBOT_MODEL_DIR.exists():
        _load_error = FileNotFoundError(f"Chatbot model dir not found: {CHATBOT_MODEL_DIR} (and no CHATBOT_MODEL_HF_REPO)")
        logger.warning("Chatbot model dir not found: %s", CHATBOT_MODEL_DIR)
        return False

    # 1) Try PyTorch first (no TensorFlow required; works on Render and Hub)
    try:
        import torch
        from transformers import T5ForConditionalGeneration, T5TokenizerFast
        _tokenizer = T5TokenizerFast.from_pretrained(load_path)
        _model = T5ForConditionalGeneration.from_pretrained(load_path)
        # Dynamic int8 quantization reduces CPU cost with minimal quality impact for T5-small.
        _model = torch.quantization.quantize_dynamic(_model, {torch.nn.Linear}, dtype=torch.qint8)
        _model.eval()
        _use_torch = True
        logger.info("Chatbot model loaded (PyTorch) from %s", "Hugging Face Hub" if use_hub else load_path)
        return True
    except Exception as e_pt:
        logger.debug("PyTorch load failed: %s", e_pt)
        _tokenizer = None
        _model = None

    # 2) Fallback to TensorFlow only for local path (Hub is PyTorch/safetensors)
    if use_hub:
        _load_error = e_pt
        logger.exception("Failed to load chatbot from Hub %s: %s", CHATBOT_MODEL_HF_REPO, e_pt)
        return False
    try:
        from transformers import T5TokenizerFast
        try:
            from transformers import TFT5ForConditionalGeneration
        except ImportError:
            from transformers.models.t5.modeling_tf_t5 import TFT5ForConditionalGeneration
        _tokenizer = T5TokenizerFast.from_pretrained(load_path)
        _model = TFT5ForConditionalGeneration.from_pretrained(load_path)
        _use_torch = False
        logger.info("Chatbot model loaded (TensorFlow) from %s", load_path)
        return True
    except Exception as e:
        _load_error = e
        _tokenizer = None
        _model = None
        logger.exception("Failed to load chatbot model from %s: %s", load_path, e)
        return False


def generate_reply(message, language='en', max_new_tokens=None, temperature=None):
    """
    Generate a chatbot reply using the saved T5 model.
    NOTE: The core model is trained primarily on English; callers that
    need other languages should translate externally (see translation_service).
    The `language` argument is accepted for backwards compatibility but
    is currently not used to change generation behaviour.
    """
    if not message or not str(message).strip():
        return None
    if not _load_chatbot():
        return None
    raw_message = str(message).strip()
    use_default_tokens = max_new_tokens is None
    max_new_tokens = max_new_tokens if max_new_tokens is not None else DEFAULT_MAX_NEW_TOKENS
    temperature = temperature if temperature is not None else DEFAULT_TEMPERATURE
    if use_default_tokens and _should_use_short_reply(raw_message):
        max_new_tokens = min(max_new_tokens, SHORT_REPLY_MAX_NEW_TOKENS)
    max_new_tokens = max(16, min(128, int(max_new_tokens)))
    temperature = max(0.0, float(temperature))
    input_text = INPUT_PREFIX + raw_message

    if _use_torch:
        return _cached_generate_reply_torch(input_text, max_new_tokens, temperature)
    return _cached_generate_reply_tf(input_text, max_new_tokens, temperature)


@lru_cache(maxsize=CHATBOT_CACHE_SIZE or 1)
def _cached_generate_reply_torch(input_text, max_new_tokens, temperature):
    return _generate_reply_torch(input_text, max_new_tokens, temperature)


@lru_cache(maxsize=CHATBOT_CACHE_SIZE or 1)
def _cached_generate_reply_tf(input_text, max_new_tokens, temperature):
    return _generate_reply_tf(input_text, max_new_tokens, temperature)


def _generate_reply_torch(input_text, max_new_tokens, temperature):
    """Generate using PyTorch (no TensorFlow dependency)."""
    try:
        import torch
        inputs = _tokenizer(
            input_text,
            return_tensors='pt',
            padding=True,
            truncation=True,
            max_length=MAX_INPUT_LENGTH,
        )
        # Move to same device as model (CPU or GPU)
        device = next(_model.parameters()).device
        inputs = {k: v.to(device) for k, v in inputs.items()}
        # Prefer greedy decoding by default for faster, lower-CPU inference.
        do_sample = temperature > 0
        with torch.inference_mode():
            outputs = _model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=temperature if do_sample else 1.0,
                do_sample=do_sample,
                pad_token_id=_tokenizer.pad_token_id,
            )
        reply = _tokenizer.decode(outputs[0], skip_special_tokens=True)
        return reply.strip() if reply else None
    except Exception:
        return None


def _should_use_short_reply(message: str) -> bool:
    """Enable shorter replies for simple prompts to reduce CPU while keeping quality."""
    if not CHATBOT_SHORT_REPLY_MODE:
        return False
    msg = (message or '').strip()
    if not msg:
        return False
    if len(msg) > SHORT_REPLY_MAX_INPUT_CHARS:
        return False
    # Heuristic: short, single-turn prompts are usually FAQ-like and can use fewer tokens.
    return msg.count('\n') <= 1


def _generate_reply_tf(input_text, max_new_tokens, temperature):
    """Generate using TensorFlow (fallback when model was saved as TF)."""
    try:
        import tensorflow as tf  # noqa: F401
        inputs = _tokenizer(
            [input_text],
            return_tensors='tf',
            padding=True,
            truncation=True,
            max_length=MAX_INPUT_LENGTH,
        )
        outputs = _model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            do_sample=temperature > 0,
            pad_token_id=_tokenizer.pad_token_id,
        )
        reply = _tokenizer.batch_decode(outputs, skip_special_tokens=True)[0]
        return reply.strip() if reply else None
    except Exception:
        return None


def is_available():
    """Return True if the chatbot model is loaded and ready."""
    return _load_chatbot()
