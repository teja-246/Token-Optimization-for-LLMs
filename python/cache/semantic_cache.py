import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import chromadb
from chromadb.config import Settings

from cache.embedding import embed

THRESHOLD_HIT      = 0.88
THRESHOLD_FEW_SHOT = 0.72
COLLECTION_NAME    = "aether_cache"


@dataclass
class CacheResult:
    tier: str
    similarity: float
    response: str


class SemanticCache:

    def __init__(self, host: str = "localhost", port: int = 8001):
        self._client = chromadb.HttpClient(
            host=host,
            port=port,
            settings=Settings(anonymized_telemetry=False),
        )
        # verify connection on startup — fail fast if ChromaDB unreachable
        self._client.heartbeat()
        print(f"[cache] connected to ChromaDB at {host}:{port}")

    def _collection(self):
        """
        Always fetch a fresh collection reference — never cache it.
        get_or_create_collection is idempotent and cheap (~1ms HTTP call).
        Stale cached references cause the UUID-not-found error on reconnect.
        """
        return self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    def query(self, prompt: str) -> CacheResult:
        col = self._collection()

        if col.count() == 0:
            return CacheResult(tier="MISS", similarity=0.0, response="")

        embedding = embed(prompt)
        results   = col.query(
            query_embeddings=[embedding],
            n_results=1,
            include=["metadatas", "distances"],
        )

        if not results["distances"] or not results["distances"][0]:
            return CacheResult(tier="MISS", similarity=0.0, response="")

        distance   = results["distances"][0][0]
        metadata   = results["metadatas"][0][0]
        similarity = max(0.0, min(1.0, 1.0 - distance))
        response   = metadata.get("response", "")

        if similarity >= THRESHOLD_HIT:
            return CacheResult(tier="HIT", similarity=similarity, response=response)
        elif similarity >= THRESHOLD_FEW_SHOT:
            return CacheResult(tier="FEW_SHOT", similarity=similarity, response=response)
        else:
            return CacheResult(tier="MISS", similarity=0.0, response="")

    def write(self, prompt: str, response: str, session_id: str = "") -> None:
        col = self._collection()
        col.add(
            ids=[str(uuid.uuid4())],
            embeddings=[embed(prompt)],
            documents=[prompt],
            metadatas=[{
                "response":   response,
                "session_id": session_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }],
        )