"""
embedding.py — wraps sentence-transformers for prompt vectorisation.

Uses all-MiniLM-L6-v2:
  - 384-dimensional embeddings
  - ~22MB model size — fast to load and run
  - Strong semantic similarity performance for English text
  - Produces L2-normalised vectors (dot product == cosine similarity)

The model is loaded once at module level (singleton pattern).
Subsequent calls to embed() reuse the loaded model — no cold start per request.
"""

from sentence_transformers import SentenceTransformer

# Load once at import time.
# On first import this downloads the model (~22MB) if not already cached.
# Subsequent imports (same process) reuse the in-memory instance.
_MODEL_NAME = "all-MiniLM-L6-v2"
_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        print(f"[embedding] loading model: {_MODEL_NAME}")
        _model = SentenceTransformer(_MODEL_NAME)
        print(f"[embedding] model loaded — embedding dim: {_model.get_sentence_embedding_dimension()}")
    return _model


def embed(text: str) -> list[float]:
    """
    Embed a single text string into a 384-dimensional vector.

    The output vector is L2-normalised (unit length), which means:
      cosine_similarity(a, b) == dot_product(a, b)
    and ChromaDB cosine distance = 1 - cosine_similarity.

    Args:
        text: The input string to embed.

    Returns:
        A list of 384 floats representing the semantic embedding.
    """
    model = _get_model()
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()