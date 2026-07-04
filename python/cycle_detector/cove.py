"""
cove.py — Chain-of-Verification remediation for detected loops.

Triggered only when the cycle detector finds a loop. Produces:
  1. A human-readable diagnosis (shown to the user via SSE)
  2. A web search to ground the retry in current information
  3. A recommended model (escalated if not already at the top tier)
  4. A corrected prompt — injected as a system message for the retry call

Model escalation on Groq's free tier:
  Only two models are available. If the looping response came from the
  fast model, escalate to the powerful model. If it was already on the
  powerful model, there's nowhere to escalate to — the diagnosis reflects
  this honestly rather than pretending an upgrade happened.
"""

from dataclasses import dataclass

from cycle_detector.web_search import search, summarize_results

MODEL_FAST     = "llama-3.1-8b-instant"
MODEL_POWERFUL = "llama-3.3-70b-versatile"


@dataclass
class RemediationResult:
    diagnosis: str
    search_context: str
    corrected_prompt: str
    recommended_model: str
    escalated: bool


def escalate_model(current_model: str) -> tuple[str, bool]:
    """
    Return (recommended_model, escalated).

    escalated is False if current_model is already the top tier —
    there's no further escalation available on the free Groq tier.
    """
    if current_model == MODEL_FAST:
        return MODEL_POWERFUL, True
    return MODEL_POWERFUL, False  # already at top tier


def build_remediation(
    original_prompt: str,
    looping_response: str,
    cycle_length: int,
    current_model: str,
) -> RemediationResult:
    """
    Build the full remediation package for a detected loop.

    Args:
        original_prompt:  The user's question for this turn.
        looping_response: The response text that triggered the cycle.
        cycle_length:     Number of turns the loop spans.
        current_model:    The model that produced the looping response.

    Returns:
        RemediationResult with diagnosis, search context, corrected
        prompt, and model recommendation.
    """
    recommended_model, escalated = escalate_model(current_model)

    # ── web search — grounds the retry in current information ────────────────
    # use the user's original question as the search query — it's the most
    # reliable signal of what information is actually needed
    results = search(original_prompt)
    search_context = summarize_results(results)

    # ── diagnosis ──────────────────────────────────────────────────────────────
    snippet = looping_response[:150].strip()
    if len(looping_response) > 150:
        snippet += "..."

    if escalated:
        diagnosis = (
            f"The model repeated essentially the same response across "
            f"{cycle_length} turn(s), suggesting it was stuck and unable to "
            f"make progress on this question. The repeated response began: "
            f"\"{snippet}\" "
            f"Escalating from {current_model} to {recommended_model} and "
            f"re-attempting with additional context."
        )
    else:
        diagnosis = (
            f"The model repeated essentially the same response across "
            f"{cycle_length} turn(s), suggesting it was stuck on this question. "
            f"The repeated response began: \"{snippet}\" "
            f"This model ({current_model}) is already the most capable "
            f"available — re-attempting with additional web context to "
            f"break the loop."
        )

    # ── corrected prompt ───────────────────────────────────────────────────────
    if search_context:
        corrected_prompt = (
            f"{diagnosis}\n\n"
            f"Relevant information from a web search:\n{search_context}\n\n"
            f"Using the above information, provide a new and complete answer "
            f"to the user's original question. Do not repeat your previous "
            f"response — address the question from a different angle or "
            f"with more specific information."
        )
    else:
        corrected_prompt = (
            f"{diagnosis}\n\n"
            f"A web search did not return useful additional information. "
            f"Re-read the user's original question carefully and provide a "
            f"new answer. Do not repeat your previous response — consider "
            f"whether the question may have been ambiguous, whether you "
            f"made an incorrect assumption, or whether a simpler/different "
            f"approach is needed."
        )

    return RemediationResult(
        diagnosis=diagnosis,
        search_context=search_context,
        corrected_prompt=corrected_prompt,
        recommended_model=recommended_model,
        escalated=escalated,
    )