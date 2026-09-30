from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.schemas import BlogStatus, CreateBlogRequest


@dataclass
class BlogRecord:
    id: str
    title: str
    blog_type: str
    status: BlogStatus = "running"
    error: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class BlogStore:
    """In-memory blog records. Replace with a Postgres table, keeping the same method names."""

    def __init__(self) -> None:
        self._blogs: dict[str, BlogRecord] = {}

    def create(self, blog_id: str, payload: CreateBlogRequest) -> BlogRecord:
        record = BlogRecord(id=blog_id, title=payload.title, blog_type=payload.blog_type)
        self._blogs[blog_id] = record
        return record

    def get(self, blog_id: str) -> BlogRecord | None:
        return self._blogs.get(blog_id)

    def list(self) -> list[BlogRecord]:
        return sorted(self._blogs.values(), key=lambda r: r.created_at, reverse=True)

    def set_status(self, blog_id: str, status: BlogStatus, error: str | None = None) -> None:
        record = self._blogs[blog_id]
        record.status = status
        record.error = error


store = BlogStore()
