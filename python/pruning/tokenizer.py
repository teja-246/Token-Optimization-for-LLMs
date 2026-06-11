"""
tokenizer.py — accurate token counting using tiktoken.

Uses cl100k_base encoding (GPT-4 / GPT-3.5 tokenizer).
This is a good approximation for Llama/Groq models too —
actual counts may differ by ~5% but that's acceptable for budget estimation.

The encoder is loaded once (singleton) since it's expensive to construct.
"""

import threading
import tiktoken

_encoder = None
_lock = threading.Lock()


def _get_encoder() -> tiktoken.Encoding:
    global _encoder
    if _encoder is None:
        with _lock:
            if _encoder is None:
                _encoder = tiktoken.get_encoding("cl100k_base")
    return _encoder


def count_tokens(text: str) -> int:
    """Return the number of tokens in text."""
    if not text:
        return 0
    return len(_get_encoder().encode(text))


def count_messages_tokens(messages: list[dict]) -> int:
    """Return total tokens across a list of {'role':..., 'content':...} dicts."""
    return sum(count_tokens(m.get("content", "")) for m in messages)