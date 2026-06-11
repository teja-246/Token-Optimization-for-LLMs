"""
servicer.py — gRPC servicer implementing PruningService.

Translates proto messages ↔ Python dicts and delegates to pruner.prune().
All errors are caught and handled: on failure the servicer returns the
original prompt unchanged so the Go gateway always gets a valid response.
"""

import traceback

from gen import pruning_pb2, pruning_pb2_grpc
from pruning.pruner import prune


class PruningServicer(pruning_pb2_grpc.PruningServiceServicer):

    def Prune(self, request, context):
        """
        Compress a prompt and its conversation history.

        On any internal error, returns the original prompt unchanged
        with compression_ratio = 1.0 so the gateway degrades gracefully.
        """
        try:
            # convert proto ConvMessages → plain dicts
            history = [
                {"role": msg.role, "content": msg.content}
                for msg in request.history
            ]

            result = prune(prompt=request.prompt, history=history)

            # convert compressed history dicts → proto ConvMessages
            pruned_history_proto = [
                pruning_pb2.ConvMessage(role=m["role"], content=m["content"])
                for m in result.pruned_history
            ]

            return pruning_pb2.PruneResponse(
                pruned_prompt     = result.pruned_prompt,
                pruned_history    = pruned_history_proto,
                original_tokens   = result.original_tokens,
                pruned_tokens     = result.pruned_tokens,
                compression_ratio = result.compression_ratio,
            )

        except Exception as e:
            print(f"[pruning/Prune] error for request_id={request.request_id}: {e}")
            traceback.print_exc()

            # degrade gracefully — return original prompt unchanged
            return pruning_pb2.PruneResponse(
                pruned_prompt     = request.prompt,
                pruned_history    = list(request.history),
                original_tokens   = 0,
                pruned_tokens     = 0,
                compression_ratio = 1.0,
            )