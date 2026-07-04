"""
web_search.py — free web search via DuckDuckGo for CoVe remediation.

Uses the `duckduckgo-search` package — no API key, no cost.
Only called when a cycle is detected (rare), so the free-tier rate
limits are not a practical concern.

If the search fails for any reason (network, rate limit, package issue),
returns an empty list — CoVe degrades to model-escalation-only with a
diagnosis based purely on the conversation, no external grounding.
"""

from duckduckgo_search import DDGS

MAX_RESULTS = 3


def search(query: str, max_results: int = MAX_RESULTS) -> list[dict]:
    """
    Run a web search and return up to max_results results.

    Each result is a dict with keys: "title", "body", "href".
    Returns an empty list on any error.
    """
    if not query or not query.strip():
        return []

    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        return results
    except Exception as e:
        print(f"[web_search] search failed for query={query!r}: {e}")
        return []


def summarize_results(results: list[dict]) -> str:
    """
    Format search results into a compact text block suitable for
    injecting into a correction prompt.

    Returns an empty string if results is empty.
    """
    if not results:
        return ""

    lines = []
    for r in results:
        title = r.get("title", "").strip()
        body  = r.get("body", "").strip()
        if title or body:
            lines.append(f"- {title}: {body}")

    return "\n".join(lines)