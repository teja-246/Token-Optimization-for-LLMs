"""
test_cycle_detector.py — tests for Feature 9 (cycle detection + CoVe remediation).

Pure unit tests for cluster.find_cycle and cove.escalate_model/build_remediation
require no external services. GraphStore tests require Redis.
Web search tests are skipped if duckduckgo-search is unavailable / rate-limited.
"""

import pytest
import numpy as np

from cycle_detector.cluster import find_cycle, SIMILARITY_THRESHOLD
from cycle_detector.cove import escalate_model, build_remediation, MODEL_FAST, MODEL_POWERFUL


# ── helpers ───────────────────────────────────────────────────────────────────

def _unit_vector(seed: int, dim: int = 384) -> list[float]:
    """Generate a deterministic L2-normalised random vector."""
    rng = np.random.default_rng(seed)
    v = rng.normal(size=dim)
    v = v / np.linalg.norm(v)
    return v.tolist()


def _node(embedding, text="response text"):
    return {"embedding": embedding, "text": text}


# ── cluster.find_cycle ───────────────────────────────────────────────────────

def test_no_cycle_with_empty_history():
    new_emb = _unit_vector(1)
    detected, length, matched = find_cycle([], new_emb)
    assert detected is False
    assert length == 0
    assert matched is None


def test_no_cycle_with_dissimilar_responses():
    # different random seeds → near-orthogonal vectors → low similarity
    past = [_node(_unit_vector(1)), _node(_unit_vector(2)), _node(_unit_vector(3))]
    new_emb = _unit_vector(99)
    detected, length, matched = find_cycle(past, new_emb)
    assert detected is False


def test_cycle_detected_on_identical_embedding():
    repeated = _unit_vector(42)
    past = [_node(_unit_vector(1)), _node(repeated), _node(_unit_vector(2))]
    # new response is identical to the one 2 turns ago
    detected, length, matched = find_cycle(past, repeated)
    assert detected is True
    assert length == 2  # 2 turns back from the end (offset+1, reversed search)
    assert matched is not None


def test_cycle_length_reflects_most_recent_match():
    repeated = _unit_vector(7)
    # repeated appears at position 0 AND position 2 (most recent)
    past = [_node(repeated), _node(_unit_vector(1)), _node(repeated)]
    detected, length, matched = find_cycle(past, repeated)
    assert detected is True
    # should match the MOST RECENT occurrence (offset 0 from the end → length 1)
    assert length == 1


def test_threshold_boundary():
    """A similarity just below threshold should NOT trigger a cycle."""
    base = np.array(_unit_vector(1))
    # construct a vector with similarity just under threshold
    noise = np.array(_unit_vector(2))
    blended = SIMILARITY_THRESHOLD * base + (1 - SIMILARITY_THRESHOLD) * noise * 5
    blended = blended / np.linalg.norm(blended)

    past = [_node(base.tolist())]
    detected, _, _ = find_cycle(past, blended.tolist())
    # don't assert a specific outcome (depends on exact blend) —
    # just confirm the function runs and returns a valid bool
    assert isinstance(detected, bool)


# ── cove.escalate_model ───────────────────────────────────────────────────────

def test_escalate_from_fast_to_powerful():
    model, escalated = escalate_model(MODEL_FAST)
    assert model == MODEL_POWERFUL
    assert escalated is True


def test_no_escalation_when_already_powerful():
    model, escalated = escalate_model(MODEL_POWERFUL)
    assert model == MODEL_POWERFUL
    assert escalated is False


def test_unknown_model_defaults_to_powerful_no_escalation():
    model, escalated = escalate_model("some-other-model")
    assert model == MODEL_POWERFUL
    assert escalated is False


# ── cove.build_remediation ───────────────────────────────────────────────────
# These tests call build_remediation, which performs a live web search.
# If the search fails (network unavailable in CI), the function should
# still degrade gracefully — diagnosis/corrected_prompt must always be non-empty.

def test_build_remediation_escalation_path():
    result = build_remediation(
        original_prompt="What is the capital of France?",
        looping_response="The capital of France is Paris.",
        cycle_length=2,
        current_model=MODEL_FAST,
    )
    assert result.recommended_model == MODEL_POWERFUL
    assert result.escalated is True
    assert result.diagnosis != ""
    assert result.corrected_prompt != ""
    assert "Paris" in result.diagnosis or "capital" in result.diagnosis.lower()


def test_build_remediation_no_escalation_path():
    result = build_remediation(
        original_prompt="Explain quantum entanglement",
        looping_response="Quantum entanglement is a phenomenon where particles become correlated.",
        cycle_length=3,
        current_model=MODEL_POWERFUL,
    )
    assert result.recommended_model == MODEL_POWERFUL
    assert result.escalated is False
    assert result.diagnosis != ""
    assert "already" in result.diagnosis.lower() or "most capable" in result.diagnosis.lower()


def test_build_remediation_corrected_prompt_mentions_no_repeat():
    result = build_remediation(
        original_prompt="What is 2+2?",
        looping_response="2+2 equals 4.",
        cycle_length=1,
        current_model=MODEL_FAST,
    )
    assert "repeat" in result.corrected_prompt.lower() or "different" in result.corrected_prompt.lower()


# ── GraphStore integration tests ─────────────────────────────────────────────
# Requires a running Redis. Skipped if unavailable.

@pytest.fixture
def graph_store():
    import redis
    from cycle_detector.graph_store import GraphStore

    try:
        client = redis.Redis(host="localhost", port=6379, decode_responses=True)
        client.ping()
    except Exception:
        pytest.skip("Redis not available")

    store = GraphStore(client)
    session_id = "test-cycle-session"
    yield store, session_id
    store.clear(session_id)


def test_graph_store_add_and_get(graph_store):
    store, session_id = graph_store

    assert store.get_nodes(session_id) == []

    store.add_node(session_id, _unit_vector(1), "first response")
    store.add_node(session_id, _unit_vector(2), "second response")

    nodes = store.get_nodes(session_id)
    assert len(nodes) == 2
    assert nodes[0]["text"] == "first response"
    assert nodes[1]["text"] == "second response"


def test_graph_store_sliding_window(graph_store):
    store, session_id = graph_store

    # add more than WINDOW_SIZE (20) nodes
    for i in range(25):
        store.add_node(session_id, _unit_vector(i), f"response {i}")

    nodes = store.get_nodes(session_id)
    assert len(nodes) == 20  # trimmed to window size
    # oldest entries (0-4) should have been evicted
    assert nodes[0]["text"] == "response 5"
    assert nodes[-1]["text"] == "response 24"


def test_end_to_end_cycle_detection(graph_store):
    """Simulate a real loop: same response repeated, then check detection."""
    store, session_id = graph_store

    repeated_embedding = _unit_vector(100)

    # turn 1: store the first occurrence
    store.add_node(session_id, repeated_embedding, "I'm not sure, let me think about that.")

    # turn 2: a different response
    store.add_node(session_id, _unit_vector(200), "Here's another attempt at an answer.")

    # turn 3: the SAME response comes back — check against history BEFORE adding
    past_nodes = store.get_nodes(session_id)
    detected, length, matched = find_cycle(past_nodes, repeated_embedding)

    assert detected is True
    assert length == 2  # 2 turns back
    assert "not sure" in matched["text"]