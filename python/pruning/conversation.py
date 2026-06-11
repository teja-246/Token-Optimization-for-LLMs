"""
conversation.py — compress conversation history to reduce token count.

Strategy:
  - Most recent RECENT_TURNS_VERBATIM turns: always kept verbatim.
  - Older short turns (<= VERBATIM_TOKEN_LIMIT tokens): kept verbatim.
  - Older long turns: compressed via TF-IDF sentence extraction at 50% ratio.

The original history in Redis is never modified.
Pruning only affects what gets forwarded to the LLM.
"""

from pruning.tokenizer import count_tokens
from pruning.tfidf_extractor import extract_key_sentences

RECENT_TURNS_VERBATIM = 3   # keep this many recent turns untouched
VERBATIM_TOKEN_LIMIT  = 80  # turns under this token count are not worth compressing
OLD_TURN_KEEP_RATIO   = 0.50


def compress_history(history: list[dict]) -> list[dict]:
    """
    Compress conversation history, keeping recent turns verbatim.

    Args:
        history: List of {"role": str, "content": str} dicts, oldest first.

    Returns:
        New list — same structure, older long turns compressed.
    """
    if len(history) <= RECENT_TURNS_VERBATIM:
        return list(history)

    cutoff       = len(history) - RECENT_TURNS_VERBATIM
    old_turns    = history[:cutoff]
    recent_turns = history[cutoff:]

    compressed_old = [_compress_turn(msg) for msg in old_turns]
    return compressed_old + list(recent_turns)


def _compress_turn(msg: dict) -> dict:
    """Compress a single turn if long enough. Returns original if not worth it."""
    content     = msg.get("content", "")
    token_count = count_tokens(content)

    if token_count <= VERBATIM_TOKEN_LIMIT:
        return msg

    compressed = extract_key_sentences(content, keep_ratio=OLD_TURN_KEEP_RATIO)

    # safety: never return something longer than the original
    if count_tokens(compressed) >= token_count:
        return msg

    return {"role": msg["role"], "content": compressed}