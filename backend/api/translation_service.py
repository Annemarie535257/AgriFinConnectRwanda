"""
Lightweight translation helpers for the chatbot.

We keep the core financial reasoning in English (fine-tuned T5 model),
and use small MarianMT models to translate:
- French <-> English
- Kinyarwanda <-> English

This gives more reliable non-English answers than relying on the
financial model itself to translate.
"""
import logging
from functools import lru_cache

from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

logger = logging.getLogger(__name__)


def _load_marian(model_name: str):
    """Load a MarianMT tokenizer + model pair."""
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
    return tokenizer, model


@lru_cache(maxsize=None)
def _en_fr():
    return _load_marian("Helsinki-NLP/opus-mt-en-fr")


@lru_cache(maxsize=None)
def _fr_en():
    return _load_marian("Helsinki-NLP/opus-mt-fr-en")


@lru_cache(maxsize=None)
def _en_rw():
    return _load_marian("Helsinki-NLP/opus-mt-en-rw")


@lru_cache(maxsize=None)
def _rw_en():
    return _load_marian("Helsinki-NLP/opus-mt-rw-en")


def _translate(text: str, pair_loader, max_length: int = 512) -> str:
    """Translate text using a cached (tokenizer, model) loader."""
    if not text:
        return text
    try:
        tokenizer, model = pair_loader()
        inputs = tokenizer(
            [text],
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=max_length,
        )
        outputs = model.generate(
            **inputs,
            max_length=max_length,
        )
        out = tokenizer.batch_decode(outputs, skip_special_tokens=True)[0]
        return out.strip() if out else text
    except Exception as exc:  # pragma: no cover - fail soft
        logger.exception("Translation failed: %s", exc)
        return text


def to_english(text: str, source_lang: str) -> str:
    """Translate user message from FR/RW to English for the chatbot."""
    lang = (source_lang or "en").lower()
    if lang == "fr":
        return _translate(text, _fr_en)
    if lang == "rw":
        return _translate(text, _rw_en)
    # Already English or unsupported code
    return text


def from_english(text: str, target_lang: str) -> str:
    """Translate chatbot answer from English to FR/RW (best-effort)."""
    lang = (target_lang or "en").lower()
    if lang == "fr":
        return _translate(text, _en_fr)
    if lang == "rw":
        return _translate(text, _en_rw)
    # Default: English / unsupported code
    return text

