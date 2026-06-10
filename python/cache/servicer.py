"""
servicer.py — gRPC servicer implementing CacheService.

This is the boundary between the gRPC transport layer and the
SemanticCache business logic. It translates proto messages ↔ Python objects
and handles all errors so they never crash the gRPC server.
"""

import traceback

from gen import cache_pb2, cache_pb2_grpc
from cache.semantic_cache import SemanticCache


class CacheServicer(cache_pb2_grpc.CacheServiceServicer):
    """
    Implements the CacheService gRPC contract defined in proto/cache.proto.
    Registered with the gRPC server in grpc_server.py.
    """

    def __init__(self, chroma_host: str = "localhost", chroma_port: int = 8001):
        self._cache = SemanticCache(host=chroma_host, port=chroma_port)

    # ── Query ─────────────────────────────────────────────────────────────────

    def Query(self, request, context):
        """
        Check whether a semantically similar prompt exists in the cache.

        On any internal error, returns MISS so the Go gateway degrades
        gracefully (falls through to the LLM) rather than returning 500.
        """
        try:
            result = self._cache.query(request.prompt)
            return cache_pb2.CacheQueryResponse(
                tier=result.tier,
                similarity=result.similarity,
                response=result.response,
            )
        except Exception as e:
            print(f"[cache/Query] error for request_id={request.request_id}: {e}")
            traceback.print_exc()
            # degrade gracefully — return MISS so the LLM call still proceeds
            return cache_pb2.CacheQueryResponse(
                tier="MISS",
                similarity=0.0,
                response="",
            )

    # ── Write ─────────────────────────────────────────────────────────────────

    def Write(self, request, context):
        """
        Store a new prompt+response pair in the cache.

        Called by the Go gateway after a successful LLM response (MISS path only).
        Errors are logged but never surfaced to the caller — a failed cache write
        should never break a successful inference response.
        """
        try:
            self._cache.write(
                prompt=request.prompt,
                response=request.response,
                session_id=request.session_id,
            )
            return cache_pb2.CacheWriteResponse(success=True)
        except Exception as e:
            print(f"[cache/Write] error for request_id={request.request_id}: {e}")
            traceback.print_exc()
            return cache_pb2.CacheWriteResponse(success=False)