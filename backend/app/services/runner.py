import asyncio
import logging
from collections.abc import Coroutine
from typing import Any

from app.agents.blog.graph import graph
from app.services.events import bus
from app.services.store import store

log = logging.getLogger(__name__)

REVIEW_STATUS = {
    "outline_review": "awaiting_outline_review",
    "content_review": "awaiting_content_review",
}

# asyncio keeps only weak references to tasks; hold them so they aren't garbage-collected mid-run
_running: set[asyncio.Task] = set()


def start_task(coro: Coroutine[Any, Any, None]) -> None:
    task = asyncio.create_task(coro)
    _running.add(task)
    task.add_done_callback(_running.discard)


def graph_config(blog_id: str) -> dict:
    # thread_id tells the checkpointer which saved run to load or continue
    return {"configurable": {"thread_id": blog_id}}


async def run_graph(blog_id: str, graph_input: Any) -> None:
    """Runs the graph until the next interrupt or END. graph_input is the initial state or a Command(resume=...)."""
    config = graph_config(blog_id)
    try:
        # "updates" yields {node_name: state_update} after each node, or {"__interrupt__": ...} when paused.
        # Progress messages don't come through here; nodes publish them to the bus themselves (see nodes.report).
        async for chunk in graph.astream(graph_input, config, stream_mode="updates"):
            for node in chunk:
                if node == "__interrupt__":
                    payload = chunk[node][0].value
                    store.set_status(blog_id, REVIEW_STATUS[payload["type"]])
                    await bus.publish(blog_id, "review_required", payload)
                else:
                    await bus.publish(blog_id, "step", {"step": node, "status": "completed"})

        snapshot = await graph.aget_state(config)
        if not snapshot.next:  # reached END rather than pausing
            store.set_status(blog_id, "completed")
            await bus.publish(blog_id, "done", {"word_count": snapshot.values.get("word_count", 0)}, final=True)
    except Exception as exc:
        log.exception("Blog pipeline failed for %s", blog_id)
        store.set_status(blog_id, "failed", error=str(exc))
        await bus.publish(blog_id, "error", {"message": str(exc)}, final=True)
