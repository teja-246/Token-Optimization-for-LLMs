"""
cluster.py — cycle detection via exact cosine similarity.

Why exact (not FAISS/HNSW):
  A session window holds at most WINDOW_SIZE (20) responses. Exact
  pairwise cosine similarity over 20 vectors is sub-millisecond —
  FAISS/HNSW is built for millions of vectors and adds unnecessary
  complexity and approximation error at this scale.

Cycle definition:
  The session graph is a simple temporal chain: R1 -> R2 -> ... -> Rn.
  If the newest response Rn is semantically very similar (cosine
  similarity >= SIMILARITY_THRESHOLD) to an earlier response Ri (i < n),
  this represents the LLM returning to semantic territory it already
  covered — a hallucination or debug loop.

  cycle_length = n - i
    The number of turns the loop spans. A smaller value means the model
    is repeating itself more rapidly (tighter loop).

Threshold:
  0.90 is conservative — catches near-paraphrases of the same content
  while allowing genuinely different responses on related topics.
  Tune per-domain if false positives/negatives appear in practice.
"""

import numpy as np

SIMILARITY_THRESHOLD = 0.90
MIN_CYCLE_LENGTH     = 3 

def find_cycle(past_nodes: list[dict], new_embedding: list[float]) -> tuple[bool, int, dict | None]:
    """
    Check whether new_embedding closes a cycle against past_nodes.

    Args:
        past_nodes:    Nodes already in the session graph (oldest first),
                        NOT including the new response. Each is
                        {"embedding": [...], "text": "..."}.
        new_embedding: Embedding of the response just produced.

    Returns:
        (cycle_detected, cycle_length, matched_node)
          cycle_detected: True if a sufficiently similar past node was found
          cycle_length:   number of turns spanned (0 if no cycle)
          matched_node:   the past node that matched (for diagnosis text),
                           or None if no cycle
    """
    if not past_nodes:
        return False, 0, None

    new_vec = np.array(new_embedding, dtype=np.float32)

    # search from most recent to oldest — a recent repeat is a tighter,
    # more urgent loop and should be reported with the smallest cycle_length
    for offset, node in enumerate(reversed(past_nodes)):
        past_vec = np.array(node["embedding"], dtype=np.float32)

        # vectors are L2-normalised (see cache/embedding.py) so dot product
        # IS cosine similarity — no need to divide by norms
        similarity = float(np.dot(new_vec, past_vec))

        if similarity >= SIMILARITY_THRESHOLD:
            cycle_length = offset + 1  # turns between the match and now
            return True, cycle_length, node

    return False, 0, None