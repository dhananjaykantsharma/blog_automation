from functools import lru_cache

from langgraph.types import default_retry_on
from tavily import (
    AsyncTavilyClient,
    BadRequestError,
    InvalidAPIKeyError,
    MissingAPIKeyError,
    UsageLimitExceededError,
)
from tavily.errors import ForbiddenError

from app.core.config import get_settings

# Whole pages can be 50k+ characters; cap each source so the LLM prompt stays small and cheap
MAX_SOURCE_CHARS = 8000

# Retrying these can't help: the key, the quota or the request itself is wrong
_PERMANENT_ERRORS = (InvalidAPIKeyError, MissingAPIKeyError, UsageLimitExceededError, BadRequestError, ForbiddenError)


def is_transient(exc: Exception) -> bool:
    """retry_on for the research node: retry network blips and 5xx, never auth or quota errors."""
    return not isinstance(exc, _PERMANENT_ERRORS) and default_retry_on(exc)


@lru_cache
def _client() -> AsyncTavilyClient:
    # One client for the whole app so its HTTP connection pool is reused
    return AsyncTavilyClient(api_key=get_settings().tavily_api_key)


def _source(url: str, title: str | None, content: str | None) -> dict:
    return {"url": url, "title": title or url, "content": (content or "")[:MAX_SOURCE_CHARS]}


async def extract_urls(urls: list[str]) -> tuple[list[dict], list[str]]:
    """Reads the given pages. Returns (sources, urls_that_failed)."""
    if not urls:
        return [], []
    response = await _client().extract(urls, extract_depth="basic", format="markdown")
    sources = [_source(r["url"], r.get("title"), r.get("raw_content")) for r in response["results"]]
    failed = [r["url"] for r in response["failed_results"]]
    return [s for s in sources if s["content"]], failed


async def search_web(query: str, topic: str) -> list[dict]:
    """Searches the web and returns each result with its full page content."""
    settings = get_settings()
    response = await _client().search(
        query,
        topic=topic,
        search_depth=settings.tavily_search_depth,
        max_results=settings.tavily_max_results,
        include_raw_content="markdown",
    )
    # raw_content is None when Tavily couldn't fetch the full page; fall back to its short snippet
    return [
        _source(r["url"], r.get("title"), r.get("raw_content") or r.get("content"))
        for r in response["results"]
    ]
