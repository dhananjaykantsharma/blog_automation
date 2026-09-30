import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

HEARTBEAT_SECONDS = 15


@dataclass
class BlogRun:
    events: list[dict] = field(default_factory=list)
    done: bool = False
    changed: asyncio.Condition = field(default_factory=asyncio.Condition)


class EventBus:
    """In-memory per-blog event log. Single-process only; swap for Redis to run multiple workers."""

    def __init__(self) -> None:
        self._runs: dict[str, BlogRun] = {}

    def create(self, blog_id: str) -> None:
        self._runs[blog_id] = BlogRun()

    def exists(self, blog_id: str) -> bool:
        return blog_id in self._runs

    async def publish(self, blog_id: str, event: str, data: dict, final: bool = False) -> None:
        run = self._runs[blog_id]
        async with run.changed:
            run.events.append({"id": len(run.events), "event": event, "data": data})
            run.done = run.done or final
            run.changed.notify_all()

    async def subscribe(self, blog_id: str, last_id: int = -1) -> AsyncIterator[dict | None]:
        """Yields every event after last_id (replay, then live). Yields None as a heartbeat when idle."""
        run = self._runs[blog_id]
        cursor = last_id + 1
        while True:
            async with run.changed:
                try:
                    await asyncio.wait_for(
                        run.changed.wait_for(lambda: cursor < len(run.events) or run.done),
                        HEARTBEAT_SECONDS,
                    )
                except asyncio.TimeoutError:
                    batch = None
                else:
                    batch = run.events[cursor:]
            if batch is None:
                yield None
                continue
            for event in batch:
                yield event
            cursor += len(batch)
            if run.done and cursor >= len(run.events):
                return


bus = EventBus()
