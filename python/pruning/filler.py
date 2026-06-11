"""
filler.py — strips filler phrases that inflate token count without adding meaning.

These are common patterns users type in natural conversation that add nothing
to what the LLM actually needs to understand the request.

Examples of what gets removed:
  "Can you please explain what Python is?"  →  "explain what Python is"
  "I was wondering if you could help me understand..."  →  "help me understand..."
  "As an AI language model, please..."  →  "..."

The stripping is conservative — we only remove patterns we're confident about.
When in doubt, leave the text as-is. A missed filler is better than a
changed meaning.
"""

import re

# Ordered from most specific to least specific.
# Each tuple is (pattern, replacement).
_FILLER_RULES: list[tuple[str, str]] = [

    # ── Preamble phrases ───────────────────────────────────────────────────────
    # "Can you please explain X" → "explain X"
    (r"(?i)^can you (please\s+)?", ""),
    # "Could you please help me with X" → "help me with X"
    (r"(?i)^could you (please\s+)?", ""),
    # "Would you mind explaining X" → "explaining X"
    (r"(?i)^would you (mind\s+)?(please\s+)?", ""),
    # "I was wondering if you could X" → "X"
    (r"(?i)^I was wondering if you (could|would|can|might)\s+", ""),
    # "I'd like you to X" → "X"
    (r"(?i)^I'?d (like|want|need) (you to|to ask you to)\s+", ""),
    # "I need you to X" → "X"
    (r"(?i)^I need (you to\s+)?", ""),
    # "Please help me X" → "help me X" (keep the actual request)
    (r"(?i)^please\s+", ""),

    # ── AI-directed noise ──────────────────────────────────────────────────────
    # "As an AI language model, ..." → strip the whole phrase
    (r"(?i)\bAs an? (AI|artificial intelligence|language model|LLM)[,.]?\s*", ""),
    # "Note that you are an AI..." → strip
    (r"(?i)\bNote that you (are|were) (an? )?(AI|language model)[,.]?\s*", ""),

    # ── Politeness tokens (mid-sentence) ──────────────────────────────────────
    # "please" in the middle/end of a sentence
    (r"(?i),?\s*\bplease\b\s*", " "),
    # "kindly" as a standalone politeness marker
    (r"(?i)\bkindly\b\s*", ""),
    # "if you don't mind" + optional comma
    (r"(?i),?\s*\bif you don'?t mind\b[,.]?\s*", " "),
    # "if possible" as a trailing phrase
    (r"(?i),?\s*\bif (at all )?possible\b[,.]?\s*$", ""),

    # ── Verbose starters ───────────────────────────────────────────────────────
    # "I think that..." → remove "I think that"
    (r"(?i)^I (think|believe|feel) (that\s+)?", ""),
    # "Just wondering..." → remove
    (r"(?i)^(just\s+)?wondering[,.]?\s*", ""),
]

# Pre-compile all patterns for performance
_COMPILED_RULES = [(re.compile(pattern), replacement) for pattern, replacement in _FILLER_RULES]


def remove_fillers(text: str) -> str:
    """
    Remove filler phrases from text.

    Applies rules in order, collapses multiple spaces, and strips the result.
    If the result would be empty, returns the original text unchanged.
    """
    result = text

    for pattern, replacement in _COMPILED_RULES:
        result = pattern.sub(replacement, result)

    # collapse multiple spaces introduced by removals
    result = re.sub(r" {2,}", " ", result).strip()

    # safety: never return empty string
    if not result:
        return text

    # capitalise the first letter if the original was capitalised
    if text[0].isupper() and result[0].islower():
        result = result[0].upper() + result[1:]

    return result