"""
semantic_cache.py — ChromaDB interface for the semantic cache.

Three-tier similarity logic:
  similarity > 0.88  → HIT       — return cached response, skip LLM entirely
  0.85 ≤ sim ≤ 0.72  → FEW_SHOT  — inject as context, still call LLM
  similarity < 0.72  → MISS      — proceed to LLM normally

Similarity is cosine similarity derived from ChromaDB's cosine distance:
  cosine_similarity = 1 - cosine_distance
  (valid because sentence-transformers produces L2-normalised vectors)
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import chromadb
from chromadb.config import Settings

from cache.embedding import embed

# ── Thresholds ────────────────────────────────────────────────────────────────

THRESHOLD_HIT       = 0.88  # above this → cache HIT, skip LLM
THRESHOLD_FEW_SHOT  = 0.72  # above this → FEW_SHOT, inject as context

# ── Result type ───────────────────────────────────────────────────────────────

@dataclass
class CacheResult:
    tier: str        # "HIT" | "FEW_SHOT" | "MISS"
    similarity: float
    response: str    # populated for HIT and FEW_SHOT; empty string for MISS


# ── SemanticCache ─────────────────────────────────────────────────────────────

class SemanticCache:
    """
    Manages the ChromaDB vector collection for semantic caching.

    Collection design:
      - name: "aether_cache"
      - distance metric: cosine (ChromaDB hnsw:space setting)
      - documents: the original prompt text (for debugging)
      - embeddings: 384-dim sentence-transformer vector
      - metadatas: { response, session_id, created_at }
      - ids: UUID strings
    """

    COLLECTION_NAME = "aether_cache"

    def __init__(self, host: str = "localhost", port: int = 8001):
        self._client = chromadb.HttpClient(
            host=host,
            port=port,
            settings=Settings(anonymized_telemetry=False),
        )
        self._collection = self._client.get_or_create_collection(
            name=self.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},  # use cosine distance
        )
        print(f"[cache] connected to ChromaDB — collection: {self.COLLECTION_NAME}")

    # ── Query ─────────────────────────────────────────────────────────────────

    def query(self, prompt: str) -> CacheResult:
        """
        Search the cache for the most semantically similar stored prompt.

        Steps:
          1. Embed the incoming prompt
          2. Query ChromaDB for the nearest neighbour (n_results=1)
          3. Convert ChromaDB cosine distance → cosine similarity
          4. Apply three-tier threshold logic

        Returns a CacheResult with tier, similarity, and response.
        Returns MISS immediately if the collection is empty.
        """
        # guard: empty collection
        if self._collection.count() == 0:
            return CacheResult(tier="MISS", similarity=0.0, response="")

        embedding = embed(prompt)

        results = self._collection.query(
            query_embeddings=[embedding],
            n_results=1,
            include=["metadatas", "distances"],
        )

        if not results["distances"] or not results["distances"][0]:
            return CacheResult(tier="MISS", similarity=0.0, response="")

        distance   = results["distances"][0][0]
        metadata   = results["metadatas"][0][0]
        similarity = 1.0 - distance  # cosine: distance = 1 - similarity

        # clamp to [0, 1] — floating point rounding can push slightly past
        similarity = max(0.0, min(1.0, similarity))

        response = metadata.get("response", "")

        if similarity >= THRESHOLD_HIT:
            return CacheResult(tier="HIT", similarity=similarity, response=response)
        elif similarity >= THRESHOLD_FEW_SHOT:
            return CacheResult(tier="FEW_SHOT", similarity=similarity, response=response)
        else:
            return CacheResult(tier="MISS", similarity=similarity, response="")

    # ── Write ─────────────────────────────────────────────────────────────────

    def write(self, prompt: str, response: str, session_id: str = "") -> None:
        """
        Store a new prompt+response pair in the vector cache.

        Only called on the MISS path after a successful LLM response.
        Each entry gets a unique UUID — duplicate prompts are allowed
        (they may have subtly different context or the LLM may improve over time).

        Args:
            prompt:     The pruned prompt that was sent to the LLM.
            response:   The full LLM response text.
            session_id: The session that generated this pair (for debugging).
        """
        embedding = embed(prompt)
        entry_id  = str(uuid.uuid4())

        self._collection.add(
            ids=[entry_id],
            embeddings=[embedding],
            documents=[prompt],
            metadatas=[{
                "response":   response,
                "session_id": session_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }],
        )