"""
Lightweight translation helpers for the chatbot.

We keep the core financial reasoning in English (fine-tuned T5 model),
and use small MarianMT models to translate:
- French <-> English
- Kinyarwanda <-> English

This gives more reliable non-English answers than relying on the
financial model itself to translate.

Imports are inside _load_marian() so this module can be imported without
loading transformers/torch (avoids OOM and worker timeout on Render when
only English chat is used).
"""
import logging
import os
from functools import lru_cache

logger = logging.getLogger(__name__)
TRANSLATION_MAX_LENGTH = max(64, int(os.environ.get('TRANSLATION_MAX_LENGTH', '192') or 192))
TRANSLATION_CACHE_SIZE = max(0, int(os.environ.get('TRANSLATION_CACHE_SIZE', '256') or 256))


def _load_marian(model_name: str):
    """Load a MarianMT tokenizer + model pair. Imports here to avoid loading transformers at module import."""
    import torch
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
    # Dynamic quantization lowers CPU cost while keeping translation quality acceptable.
    try:
        model = torch.quantization.quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8)
    except Exception:
        logger.debug("Marian quantization skipped for %s", model_name)
    model.eval()
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


def _translate(text: str, pair_loader, max_length: int = TRANSLATION_MAX_LENGTH) -> str:
    """Translate text using a cached (tokenizer, model) loader."""
    if not text:
        return text
    try:
        import torch
        tokenizer, model = pair_loader()
        inputs = tokenizer(
            [text],
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=max_length,
        )
        with torch.inference_mode():
            outputs = model.generate(
                **inputs,
                max_length=max_length,
            )
        out = tokenizer.batch_decode(outputs, skip_special_tokens=True)[0]
        return out.strip() if out else text
    except Exception as exc:  # pragma: no cover - fail soft
        logger.exception("Translation failed: %s", exc)
        return text


@lru_cache(maxsize=TRANSLATION_CACHE_SIZE or 1)
def _translate_cached(text: str, pair_loader, max_length: int = TRANSLATION_MAX_LENGTH) -> str:
    return _translate(text, pair_loader, max_length)


def to_english(text: str, source_lang: str) -> str:
    """Translate user message from FR/RW to English for the chatbot."""
    lang = (source_lang or "en").lower()
    if lang == "fr":
        return _translate_cached(text, _fr_en)
    if lang == "rw":
        return _translate_cached(text, _rw_en)
    # Already English or unsupported code
    return text


def from_english(text: str, target_lang: str) -> str:
    """Translate chatbot answer from English to FR/RW (best-effort)."""
    lang = (target_lang or "en").lower()
    if lang == "fr":
        return _translate_cached(text, _en_fr)
    if lang == "rw":
        return _translate_cached(text, _en_rw)
    # Default: English / unsupported code
    return text

