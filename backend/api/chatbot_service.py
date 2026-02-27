"""
Load the saved T5 chatbot model (saved-model/) and generate replies.
Model is from Financial_LLM_Chatbot.ipynb (Flan-T5-small fine-tuned on Bitext mortgage/loans).
"""
import logging
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)

# Saved model dir: project root / saved-model (same as notebook output). Resolved to absolute path.
_project_root = getattr(settings, 'PROJECT_ROOT', None) or Path(__file__).resolve().parent.parent.parent
_custom_dir = getattr(settings, 'CHATBOT_MODEL_DIR', None)
CHATBOT_MODEL_DIR = Path(_custom_dir).resolve() if _custom_dir else (_project_root / 'saved-model').resolve()

# Input prefix used during training (Financial_LLM_Chatbot.ipynb)
INPUT_PREFIX = "answer the question: "
MAX_INPUT_LENGTH = 256
DEFAULT_MAX_NEW_TOKENS = 128
DEFAULT_TEMPERATURE = 0.7

_tokenizer = None
_model = None
_load_error = None


def get_load_error():
    """Return the last load error message (or None). Useful for debugging."""
    global _load_error
    if _load_error is None:
        return None
    return f"{type(_load_error).__name__}: {_load_error}"


def _load_chatbot():
    """Lazy-load tokenizer and T5 model from saved-model/."""
    global _tokenizer, _model, _load_error
    if _model is not None and _tokenizer is not None:
        return True
    if _load_error is not None:
        return False
    if not CHATBOT_MODEL_DIR.exists():
        _load_error = FileNotFoundError(f"Chatbot model dir not found: {CHATBOT_MODEL_DIR}")
        logger.warning("Chatbot model dir not found: %s", CHATBOT_MODEL_DIR)
        return False
    try:
        from transformers import T5TokenizerFast
        try:
            from transformers import TFT5ForConditionalGeneration
        except ImportError:
            # Some 4.x versions expose TF T5 only from the submodule
            from transformers.models.t5.modeling_tf_t5 import TFT5ForConditionalGeneration
        tokenizer_path = str(CHATBOT_MODEL_DIR)
        _tokenizer = T5TokenizerFast.from_pretrained(tokenizer_path)
        _model = TFT5ForConditionalGeneration.from_pretrained(tokenizer_path)
        logger.info("Chatbot model loaded from %s", tokenizer_path)
        return True
    except Exception as e:
        _load_error = e
        logger.exception("Failed to load chatbot model from %s: %s", CHATBOT_MODEL_DIR, e)
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
    max_new_tokens = max_new_tokens if max_new_tokens is not None else DEFAULT_MAX_NEW_TOKENS
    temperature = temperature if temperature is not None else DEFAULT_TEMPERATURE

    try:
        import tensorflow as tf

        input_text = INPUT_PREFIX + str(message).strip()
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
