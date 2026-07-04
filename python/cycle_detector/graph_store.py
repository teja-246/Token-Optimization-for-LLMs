"""
graph_store.py — Redis-backed session response graph.

Each session maintains a sliding window of the last WINDOW_SIZE responses,
stored as a Redis list. Each entry holds the response's embedding and a
short text snippet (for diagnosis display).

The graph is "directed" implicitly by list order — index 0 is the oldest,
index -1 is the newest. A cycle is detected when the newest response's
embedding is highly similar to an earlier entry in the same window.

Why Redis and not in-memory:
  The Python gRPC server may restart between requests. Redis ensures the
  session graph survives process restarts, same as conversation history.
"""

import json

WINDOW_SIZE   = 20              # max nodes kept per session
TTL_SECONDS   = 24 * 60 * 60    # session graph expires after 24h of inactivity
SNIPPET_CHARS = 200              # how much of the response text to store for display


class GraphStore:
    def __init__(self, redis_client):
        self._redis = redis_client

    def _key(self, session_id: str) -> str:
        return f"cyclegraph:{session_id}:nodes"

    def get_nodes(self, session_id: str) -> list[dict]:
        """
        Return all nodes currently in the session's sliding window,
        oldest first. Each node is {"embedding": [...], "text": "..."}.
        Returns an empty list for a new session.
        """
        raw = self._redis.lrange(self._key(session_id), 0, -1)
        return [json.loads(r) for r in raw]

    def add_node(self, session_id: str, embedding: list[float], response_text: str) -> None:
        """
        Append a new response node to the session graph.
        Trims to WINDOW_SIZE (drops oldest) and refreshes TTL.
        """
        key = self._key(session_id)
        entry = json.dumps({
            "embedding": embedding,
            "text": response_text[:SNIPPET_CHARS],
        })

        pipe = self._redis.pipeline()
        pipe.rpush(key, entry)
        pipe.ltrim(key, -WINDOW_SIZE, -1)
        pipe.expire(key, TTL_SECONDS)
        pipe.execute()

    def clear(self, session_id: str) -> None:
        """Remove the session graph entirely. Useful for tests / new conversation."""
        self._redis.delete(self._key(session_id))