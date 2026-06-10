"""
grpc_server.py — Python ML gRPC server.

Registers all servicers and starts listening on port 50051.
As more ML features are built (pruning, routing, verification, cycle detector),
their servicers are added here. The Go gateway always connects to this one address.

Usage:
    python grpc_server.py

Environment variables:
    GRPC_PORT       — port to listen on (default: 50051)
    CHROMA_HOST     — ChromaDB host (default: localhost)
    CHROMA_PORT     — ChromaDB port (default: 8001)
"""

import os
import signal
import sys
from concurrent import futures

import grpc

from gen import cache_pb2_grpc
from cache.servicer import CacheServicer

# ── Config ────────────────────────────────────────────────────────────────────

GRPC_PORT   = int(os.getenv("GRPC_PORT",   "50051"))
CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8001"))

# ── Server ────────────────────────────────────────────────────────────────────

def serve() -> None:
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=[
            # allow large messages — LLM responses can be long
            ("grpc.max_send_message_length",    10 * 1024 * 1024),  # 10MB
            ("grpc.max_receive_message_length", 10 * 1024 * 1024),
        ],
    )

    # ── register servicers ────────────────────────────────────────────────────
    # Feature 4: Semantic Cache
    cache_pb2_grpc.add_CacheServiceServicer_to_server(
        CacheServicer(chroma_host=CHROMA_HOST, chroma_port=CHROMA_PORT),
        server,
    )

    # Future features register here:
    # Feature 5:  pruning_pb2_grpc.add_PruningServiceServicer_to_server(PruningServicer(), server)
    # Feature 6:  routing_pb2_grpc.add_RoutingServiceServicer_to_server(RoutingServicer(), server)
    # Feature 8:  verification_pb2_grpc.add_VerificationServiceServicer_to_server(...)
    # Feature 9:  cycle_pb2_grpc.add_CycleServiceServicer_to_server(...)

    # ── start ─────────────────────────────────────────────────────────────────
    listen_addr = f"[::]:{GRPC_PORT}"
    server.add_insecure_port(listen_addr)
    server.start()

    print(f"[grpc_server] listening on {listen_addr}")
    print(f"[grpc_server] ChromaDB → {CHROMA_HOST}:{CHROMA_PORT}")
    print(f"[grpc_server] registered servicers: CacheService")

    # graceful shutdown on SIGTERM (Docker stop) or SIGINT (Ctrl+C)
    def _shutdown(sig, frame):
        print("[grpc_server] shutting down...")
        server.stop(grace=5)
        sys.exit(0)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT,  _shutdown)

    server.wait_for_termination()


if __name__ == "__main__":
    serve()