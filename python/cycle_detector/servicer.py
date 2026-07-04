"""
servicer.py — gRPC servicer implementing CycleService.

Two RPCs:
  CheckCycle  — called every turn, fast (no web search)
  Remediate   — called only when CheckCycle reports a cycle (does web search)

All errors are caught and handled with safe fallbacks so the gateway
always gets a usable response — a broken cycle detector must never
break inference.
"""

import traceback

from gen import cycle_pb2, cycle_pb2_grpc
from cache.embedding import embed
from cycle_detector.graph_store import GraphStore
from cycle_detector.cluster import find_cycle
from cycle_detector.cove import build_remediation


class CycleServicer(cycle_pb2_grpc.CycleServiceServicer):

    def __init__(self, redis_client):
        self._store = GraphStore(redis_client)

    # ── CheckCycle ────────────────────────────────────────────────────────────

    def CheckCycle(self, request, context):
        """
        Embed the new response, check it against the session's sliding
        window for a cycle, then add it to the window.

        On error: returns PASS (cycle_detected=False) — never blocks
        the response on a broken cycle detector.
        """
        try:
            embedding = embed(request.response)

            past_nodes = self._store.get_nodes(request.session_id)
            cycle_detected, cycle_length, _ = find_cycle(past_nodes, embedding)

            # add the new node regardless of cycle outcome —
            # the graph must keep growing to detect future cycles
            self._store.add_node(request.session_id, embedding, request.response)

            action = "REMEDIATE" if cycle_detected else "PASS"

            return cycle_pb2.CycleResponse(
                cycle_detected=cycle_detected,
                cycle_length=cycle_length,
                action=action,
            )

        except Exception as e:
            print(f"[cycle/CheckCycle] error for request_id={request.request_id}: {e}")
            traceback.print_exc()
            return cycle_pb2.CycleResponse(
                cycle_detected=False,
                cycle_length=0,
                action="PASS",
            )

    # ── Remediate ─────────────────────────────────────────────────────────────

    def Remediate(self, request, context):
        """
        Build the remediation package: diagnosis, web search context,
        corrected prompt, and recommended model.

        On error: returns a minimal diagnosis with no escalation and
        the original prompt unchanged — the gateway can still retry
        with the same model rather than failing outright.
        """
        try:
            result = build_remediation(
                original_prompt=request.original_prompt,
                looping_response=request.looping_response,
                cycle_length=request.cycle_length,
                current_model=request.current_model,
            )

            return cycle_pb2.RemediateResponse(
                diagnosis=result.diagnosis,
                search_context=result.search_context,
                corrected_prompt=result.corrected_prompt,
                recommended_model=result.recommended_model,
                escalated=result.escalated,
            )

        except Exception as e:
            print(f"[cycle/Remediate] error for request_id={request.request_id}: {e}")
            traceback.print_exc()
            return cycle_pb2.RemediateResponse(
                diagnosis="A loop was detected, but the remediation service "
                          "encountered an internal error. Retrying with the "
                          "same model.",
                search_context="",
                corrected_prompt=request.original_prompt,
                recommended_model=request.current_model,
                escalated=False,
            )