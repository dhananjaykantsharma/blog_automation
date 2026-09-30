from typing import TypedDict


class BlogState(TypedDict, total=False):
    """Everything the graph knows about one blog. Plain JSON types only, so the checkpointer can save it."""

    request: dict  # CreateBlogRequest as JSON
    sources: list[dict]  # [{url, title, content}] read by the research node
    notes: list[dict]
    outline: dict
    outline_feedback: str
    outline_attempts: int
    content: str
    content_feedback: str
    word_count: int
