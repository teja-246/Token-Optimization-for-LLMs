"""
pruner.py — orchestrates the full pruning pipeline.

Pipeline order:
  1. Count original tokens
  2. Remove filler phrases from prompt
  3. TF-IDF sentence extraction (if prompt is long enough)
  4. Compress conversation history (old turns only)
  5. Count pruned tokens and compute compression ratio
"""

from dataclasses import dataclass

from pruning.tokenizer       import count_tokens, count_messages_tokens
from pruning.filler          import remove_fillers
from pruning.tfidf_extractor import extract_key_sentences
from pruning.conversation    import compress_history

MIN_TOKENS_FOR_EXTRACTION = 30   # don't fragment short prompts
PROMPT_KEEP_RATIO         = 0.75 # keep 75% of prompt sentences


@dataclass
class PruneResult:
    pruned_prompt:     str
    pruned_history:    list[dict]
    original_tokens:   int
    pruned_tokens:     int
    compression_ratio: float  # pruned / original (lower = more savings)


def prune(prompt: str, history: list[dict]) -> PruneResult:
    """
    Run the full pruning pipeline.

    Args:
        prompt:  Raw user prompt.
        history: Full conversation history including the current user message.

    Returns:
        PruneResult with compressed prompt, compressed history, and metrics.
    """
    # 1. baseline
    original_total = count_tokens(prompt) + count_messages_tokens(history)

    # 2. filler removal
    pruned_prompt = remove_fillers(prompt)

    # 3. TF-IDF extraction (only on longer prompts)
    if count_tokens(pruned_prompt) > MIN_TOKENS_FOR_EXTRACTION:
        pruned_prompt = extract_key_sentences(pruned_prompt, keep_ratio=PROMPT_KEEP_RATIO)

    # 4. history compression
    pruned_history = compress_history(history)

    # 5. metrics
    pruned_total      = count_tokens(pruned_prompt) + count_messages_tokens(pruned_history)
    compression_ratio = (pruned_total / original_total) if original_total > 0 else 1.0

    # print(f"Pruned prompt='{pruned_prompt}'")
    # print(f"Original tokens: {original_total}, Pruned tokens: {pruned_total}, Compression ratio: {compression_ratio:.2f}")
    return PruneResult(
        pruned_prompt     = pruned_prompt,
        pruned_history    = pruned_history,
        original_tokens   = original_total,
        pruned_tokens     = pruned_total,
        compression_ratio = compression_ratio,
    )