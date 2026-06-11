"""
tfidf_extractor.py — sentence-level TF-IDF scoring for prompt compression.

How it works:
  1. Split text into sentences
  2. Score each sentence using TF-IDF (each sentence = a "document")
  3. Rank sentences by score
  4. Keep the top-N sentences in original order

Extractive only — we never rewrite or paraphrase, only decide what to keep.

Why TF-IDF instead of an LLM summariser:
  Using an LLM to compress prompts defeats the purpose (costs tokens to save tokens).
  TF-IDF is CPU-only, sub-millisecond, and captures term importance well.
"""

import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer


def extract_key_sentences(text: str, keep_ratio: float = 0.75) -> str:
    """
    Extract the most important sentences from a block of text.

    Args:
        text:       Input text to compress.
        keep_ratio: Fraction of sentences to keep (0.75 = keep 75%).
                    Always keeps at least 1 sentence.

    Returns:
        Compressed text. Returns original unchanged if <= 2 sentences
        or if scoring fails for any reason.
    """
    sentences = _split_sentences(text)

    if len(sentences) <= 2:
        return text

    n_keep = max(1, round(len(sentences) * keep_ratio))

    if n_keep >= len(sentences):
        return text

    try:
        scores = _score_sentences(sentences)
    except Exception:
        return text  # never fail — return original on any error

    # select top-N by score, then restore original order
    top_indices = set(np.argsort(scores)[::-1][:n_keep])
    kept = [sentences[i] for i in range(len(sentences)) if i in top_indices]

    return " ".join(kept)


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences on .!? boundaries."""
    raw = re.split(r"(?<=[.!?])\s+", text.strip())
    return [s.strip() for s in raw if s.strip()]


def _score_sentences(sentences: list[str]) -> np.ndarray:
    """Score each sentence by mean TF-IDF weight across its terms."""
    vectorizer = TfidfVectorizer(
        stop_words="english",
        min_df=1,
        sublinear_tf=True,  # log(1+tf) dampens effect of very frequent terms
    )
    tfidf_matrix = vectorizer.fit_transform(sentences)
    scores = np.asarray(tfidf_matrix.mean(axis=1)).flatten()
    return scores