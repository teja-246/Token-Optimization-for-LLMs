"""
test_pruning.py — tests for the prompt pruning pipeline.

All tests are pure unit tests — no external dependencies required.
Run with: pytest tests/test_pruning.py -v
"""

import pytest
from pruning.tokenizer       import count_tokens, count_messages_tokens
from pruning.filler          import remove_fillers
from pruning.tfidf_extractor import extract_key_sentences
from pruning.conversation    import compress_history, RECENT_TURNS_VERBATIM
from pruning.pruner          import prune


# ── tokenizer ─────────────────────────────────────────────────────────────────

def test_count_tokens_basic():
    assert count_tokens("Hello world") > 0

def test_count_tokens_empty():
    assert count_tokens("") == 0

def test_count_tokens_increases_with_length():
    short = count_tokens("Hi")
    long  = count_tokens("Hi, how are you doing today? I hope everything is going well.")
    assert long > short

def test_count_messages_tokens():
    msgs = [
        {"role": "user",      "content": "What is Python?"},
        {"role": "assistant", "content": "Python is a programming language."},
    ]
    total = count_messages_tokens(msgs)
    assert total == count_tokens("What is Python?") + count_tokens("Python is a programming language.")


# ── filler removal ────────────────────────────────────────────────────────────

def test_removes_can_you():
    result = remove_fillers("Can you explain what Python is?")
    assert result.lower().startswith("explain")
    assert "can you" not in result.lower()

def test_removes_could_you():
    result = remove_fillers("Could you please help me understand decorators?")
    assert "could you" not in result.lower()
    assert "decorator" in result.lower()

def test_removes_i_was_wondering():
    result = remove_fillers("I was wondering if you could explain closures in Python.")
    assert "i was wondering" not in result.lower()
    assert "closure" in result.lower()

def test_removes_please_preamble():
    result = remove_fillers("Please explain how generators work.")
    assert result.lower().startswith("explain")

def test_never_returns_empty():
    # even if the entire prompt is a filler, return original
    result = remove_fillers("Please")
    assert result != ""

def test_preserves_technical_content():
    prompt = "Can you explain how transformers work in machine learning?"
    result = remove_fillers(prompt)
    assert "transformer" in result.lower()
    assert "machine learning" in result.lower()

def test_no_filler_unchanged():
    prompt = "Explain recursion with an example."
    result = remove_fillers(prompt)
    # no filler present — should be essentially unchanged (modulo capitalisation)
    assert "recursion" in result.lower()
    assert "example" in result.lower()


# ── TF-IDF extraction ─────────────────────────────────────────────────────────

def test_short_text_unchanged():
    text = "Python is great. I love it."
    result = extract_key_sentences(text, keep_ratio=0.75)
    # only 2 sentences — should not be touched
    assert result == text

def test_reduces_long_text():
    text = (
        "Python is a high-level programming language. "
        "It was created by Guido van Rossum. "
        "Python emphasises code readability. "
        "It supports multiple programming paradigms. "
        "Python has a large standard library. "
        "It is widely used in data science and web development. "
        "Many companies use Python for backend services."
    )
    result = extract_key_sentences(text, keep_ratio=0.5)
    assert len(result) < len(text)

def test_preserves_original_order():
    text = (
        "First, install Python on your machine. "
        "Second, open your terminal and type python. "
        "Third, you can start writing code immediately. "
        "Fourth, use pip to install packages. "
        "Fifth, create a virtual environment for each project."
    )
    result = extract_key_sentences(text, keep_ratio=0.6)
    # whatever sentences are kept, they must appear in original order
    kept_sentences = [s.strip() for s in result.split(". ") if s.strip()]
    original_sentences = [s.strip() for s in text.split(". ") if s.strip()]
    original_positions = [original_sentences.index(s) for s in kept_sentences
                          if s in original_sentences]
    assert original_positions == sorted(original_positions)


# ── conversation compression ──────────────────────────────────────────────────

def test_short_history_unchanged():
    history = [
        {"role": "user",      "content": "Hello"},
        {"role": "assistant", "content": "Hi there"},
    ]
    result = compress_history(history)
    assert result == history

def test_recent_turns_preserved_verbatim():
    # build a history longer than RECENT_TURNS_VERBATIM
    history = [
        {"role": "user",      "content": f"Question {i} about Python and machine learning and data science."}
        for i in range(10)
    ]
    result = compress_history(history)
    # the last RECENT_TURNS_VERBATIM turns must be identical
    recent_result   = result[-RECENT_TURNS_VERBATIM:]
    recent_original = history[-RECENT_TURNS_VERBATIM:]
    assert recent_result == recent_original

def test_long_old_turns_get_compressed():
    long_content = " ".join(["This is a sentence about machine learning."] * 20)
    history = [
        {"role": "user",      "content": long_content},  # old, long
        {"role": "assistant", "content": long_content},  # old, long
        {"role": "user",      "content": "Short message"},  # recent
        {"role": "assistant", "content": "Short reply"},    # recent
        {"role": "user",      "content": "Another recent message"},  # recent
    ]
    result = compress_history(history)
    # old long turns should be shorter than originals
    assert len(result[0]["content"]) <= len(long_content)
    assert len(result[1]["content"]) <= len(long_content)
    # recent turns should be unchanged
    assert result[-1]["content"] == "Another recent message"


# ── full pipeline ─────────────────────────────────────────────────────────────

def test_prune_reduces_tokens_on_verbose_prompt():
    verbose = (
        "Can you please explain, in as much detail as possible, "
        "how attention mechanisms work in transformer models? "
        "I've been reading about them but I'm having trouble understanding "
        "the key concepts. I was wondering if you could provide a clear "
        "explanation with examples if possible."
    )
    result = prune(verbose, [])
    assert result.pruned_tokens <= result.original_tokens
    assert result.compression_ratio <= 1.0

def test_prune_preserves_key_terms():
    prompt = "Can you explain how transformers and attention mechanisms work?"
    result = prune(prompt, [])
    assert "transformer" in result.pruned_prompt.lower()
    assert "attention" in result.pruned_prompt.lower()

def test_prune_short_prompt_not_fragmented():
    prompt = "What is Python?"
    result = prune(prompt, [])
    # short prompt should not be chopped up — keep it whole
    assert result.pruned_prompt != ""
    assert "python" in result.pruned_prompt.lower()

def test_prune_metrics_are_consistent():
    prompt = "Can you please help me understand how neural networks work in practice?"
    history = [{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi"}]
    result = prune(prompt, history)
    assert result.original_tokens > 0
    assert result.pruned_tokens > 0
    assert 0.0 < result.compression_ratio <= 1.0

def test_prune_history_compresses_old_turns():
    long_content = " ".join(["Neural networks learn by adjusting weights."] * 15)
    history = [
        {"role": "user",      "content": long_content},
        {"role": "assistant", "content": long_content},
        {"role": "user",      "content": long_content},
        {"role": "assistant", "content": long_content},
        {"role": "user",      "content": "What is backpropagation?"},  # recent
    ]
    result = prune("What is backpropagation?", history)
    # total tokens should be less than original
    assert result.pruned_tokens < result.original_tokens