"""
grpc_server.py — Python ML gRPC server.

Registers all servicers. Add new ones here as features are built.

Environment variables:
    GRPC_PORT    — port to listen on (default: 50051)
    CHROMA_HOST  — ChromaDB host (default: localhost)
    CHROMA_PORT  — ChromaDB port (default: 8001)
    REDIS_URL    — Redis connection URL (default: redis://localhost:6379)
"""

import os
import signal
import sys
from concurrent import futures

import grpc
import redis

from gen import cache_pb2_grpc, pruning_pb2_grpc, cycle_pb2_grpc
from cache.servicer          import CacheServicer
from pruning.servicer        import PruningServicer
from cycle_detector.servicer import CycleServicer

GRPC_PORT   = int(os.getenv("GRPC_PORT",   "50051"))
CHROMA_HOST =     os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8001"))
REDIS_URL   =     os.getenv("REDIS_URL",   "redis://localhost:6379")


def serve() -> None:
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=[
            ("grpc.max_send_message_length",    10 * 1024 * 1024),
            ("grpc.max_receive_message_length", 10 * 1024 * 1024),
        ],
    )

    # shared Redis client — used by cycle detector (and future features)
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)

    # ── Feature 4: Semantic Cache ─────────────────────────────────────────────
    cache_pb2_grpc.add_CacheServiceServicer_to_server(
        CacheServicer(chroma_host=CHROMA_HOST, chroma_port=CHROMA_PORT),
        server,
    )

    # ── Feature 5: Prompt Pruning ─────────────────────────────────────────────
    pruning_pb2_grpc.add_PruningServiceServicer_to_server(
        PruningServicer(),
        server,
    )

    # ── Feature 9: Cycle Detector + Remediation (CoVe) ────────────────────────
    cycle_pb2_grpc.add_CycleServiceServicer_to_server(
        CycleServicer(redis_client=redis_client),
        server,
    )

    listen_addr = f"[::]:{GRPC_PORT}"
    server.add_insecure_port(listen_addr)
    server.start()

    print(f"[grpc_server] listening on {listen_addr}")
    print(f"[grpc_server] ChromaDB → {CHROMA_HOST}:{CHROMA_PORT}")
    print(f"[grpc_server] Redis    → {REDIS_URL}")
    print(f"[grpc_server] registered: CacheService, PruningService, CycleService")

    def _shutdown(sig, frame):
        print("[grpc_server] shutting down...")
        server.stop(grace=5)
        sys.exit(0)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT,  _shutdown)
    server.wait_for_termination()


if __name__ == "__main__":
    serve()