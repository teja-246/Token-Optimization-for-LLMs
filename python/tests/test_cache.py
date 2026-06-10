"""
test_cache.py — tests for the semantic cache service.

Unit tests (no external dependencies):
  - similarity threshold logic
  - embedding produces correct dimensionality

Integration tests (requires running ChromaDB):
  - full write → query cycle
  - cache hit, few-shot, and miss paths
  - empty collection handling
"""

import pytest
from cache.embedding import embed
from cache.semantic_cache import SemanticCache, THRESHOLD_HIT, THRESHOLD_FEW_SHOT


# ── Embedding tests ───────────────────────────────────────────────────────────

def test_embed_returns_384_dimensions():
    vector = embed("What is Python?")
    assert len(vector) == 384

def test_embed_is_normalised():
    """L2 norm of the embedding should be ~1.0 (unit vector)."""
    import math
    vector = embed("Hello world")
    norm = math.sqrt(sum(x * x for x in vector))
    assert abs(norm - 1.0) < 1e-4, f"expected unit norm, got {norm}"

def test_embed_different_texts_differ():
    v1 = embed("What is Python?")
    v2 = embed("How do I bake sourdough bread?")
    dot = sum(a * b for a, b in zip(v1, v2))
    # unrelated texts should have low cosine similarity
    assert dot < 0.5, f"expected low similarity, got {dot:.3f}"

def test_embed_similar_texts_are_close():
    v1 = embed("What is Python?")
    v2 = embed("Can you explain what Python is?")
    dot = sum(a * b for a, b in zip(v1, v2))
    # similar texts should have high cosine similarity
    assert dot > 0.85, f"expected high similarity, got {dot:.3f}"


# ── SemanticCache integration tests ──────────────────────────────────────────
# These tests require a running ChromaDB instance.
# Skipped automatically if ChromaDB is not available.

@pytest.fixture
def cache():
    """Provides a SemanticCache connected to local ChromaDB."""
    import chromadb
    try:
        c = SemanticCache(host="localhost", port=8001)
        # use a unique test collection to avoid polluting production data
        c._collection = c._client.get_or_create_collection(
            name="aether_test_cache",
            metadata={"hnsw:space": "cosine"},
        )
        yield c
        # teardown: delete test collection
        c._client.delete_collection("aether_test_cache")
    except Exception:
        pytest.skip("ChromaDB not available")


def test_empty_collection_returns_miss(cache):
    result = cache.query("What is Python?")
    assert result.tier == "MISS"
    assert result.similarity == 0.0
    assert result.response == ""


def test_exact_match_returns_hit(cache):
    cache.write(
        prompt="What is Python?",
        response="Python is a high-level programming language.",
        session_id="test-session",
    )
    result = cache.query("What is Python?")
    assert result.tier == "HIT"
    assert result.similarity >= THRESHOLD_HIT
    assert "Python" in result.response


def test_similar_query_returns_few_shot_or_hit(cache):
    cache.write(
        prompt="What is Python programming language?",
        response="Python is a high-level programming language.",
        session_id="test-session",
    )
    # slightly rephrased — should be FEW_SHOT or HIT
    result = cache.query("Can you explain what Python is?")
    assert result.tier in ("HIT", "FEW_SHOT")
    assert result.similarity >= THRESHOLD_FEW_SHOT
    assert result.response != ""


def test_unrelated_query_returns_miss(cache):
    cache.write(
        prompt="What is Python?",
        response="Python is a programming language.",
        session_id="test-session",
    )
    result = cache.query("How do I make sourdough bread?")
    assert result.tier == "MISS"
    assert result.similarity < THRESHOLD_FEW_SHOT


def test_write_and_query_multiple_entries(cache):
    pairs = [
        ("What is Python?",     "Python is a language."),
        ("What is Go?",         "Go is a compiled language by Google."),
        ("What is Rust?",       "Rust is a systems programming language."),
    ]
    for prompt, response in pairs:
        cache.write(prompt=prompt, response=response, session_id="test")

    # each query should return its own cached response
    r1 = cache.query("What is Python?")
    assert r1.tier in ("HIT", "FEW_SHOT")
    assert "Python" in r1.response

    r2 = cache.query("Tell me about the Go language")
    # may be HIT, FEW_SHOT, or MISS depending on similarity
    # just assert it doesn't crash and returns a valid tier
    assert r2.tier in ("HIT", "FEW_SHOT", "MISS")


def test_threshold_constants_are_sane():
    assert 0 < THRESHOLD_FEW_SHOT < THRESHOLD_HIT < 1.0
    assert THRESHOLD_HIT      == 0.95
    assert THRESHOLD_FEW_SHOT == 0.85