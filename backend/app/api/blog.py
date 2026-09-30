import json
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from langgraph.types import Command

from app.agents.blog.graph import graph
from app.api.deps import get_current_user
from app.schemas import BlogDetail, BlogStatus, BlogSummary, ContentDecision, CreateBlogRequest, OutlineDecision
from app.services.events import bus
from app.services.runner import graph_config, run_graph, start_task
from app.services.store import BlogRecord, store

router = APIRouter(prefix="/blogs", tags=["blogs"], dependencies=[Depends(get_current_user)])


def _get_or_404(blog_id: str) -> BlogRecord:
    record = store.get(blog_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blog not found")
    return record


def _summary(record: BlogRecord) -> BlogSummary:
    return BlogSummary.model_validate(record, from_attributes=True)


def _ensure_status(record: BlogRecord, expected: BlogStatus) -> None:
    if record.status != expected:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Blog is '{record.status}', not '{expected}'",
        )


async def _resume(record: BlogRecord, expected: BlogStatus, decision: dict) -> BlogSummary:
    # Check-and-set with no await in between, so a double-clicked Approve can't resume twice
    _ensure_status(record, expected)
    record.status = "running"
    await bus.publish(record.id, "resumed", {"status": "running"})
    start_task(run_graph(record.id, Command(resume=decision)))
    return _summary(record)


@router.post("", response_model=BlogSummary, status_code=status.HTTP_202_ACCEPTED)
async def create_blog(payload: CreateBlogRequest) -> BlogSummary:
    record = store.create(uuid4().hex, payload)
    bus.create(record.id)
    # Fire and forget: the request returns now, the graph runs until its first interrupt
    start_task(run_graph(record.id, {"request": payload.model_dump(mode="json")}))
    return _summary(record)


@router.get("", response_model=list[BlogSummary])
async def list_blogs() -> list[BlogSummary]:
    return [_summary(r) for r in store.list()]


@router.get("/{blog_id}", response_model=BlogDetail)
async def get_blog(blog_id: str) -> BlogDetail:
    record = _get_or_404(blog_id)
    snapshot = await graph.aget_state(graph_config(blog_id))
    return BlogDetail(
        **_summary(record).model_dump(),
        error=record.error,
        pending_review=snapshot.interrupts[0].value if snapshot.interrupts else None,
        outline=snapshot.values.get("outline"),
        content=snapshot.values.get("content"),
    )


@router.get("/{blog_id}/events")
async def blog_events(blog_id: str, request: Request, last_event_id: int = Header(-1)) -> StreamingResponse:
    _get_or_404(blog_id)
    if not bus.exists(blog_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No live events for this blog")

    async def stream():
        async for event in bus.subscribe(blog_id, last_event_id):
            if await request.is_disconnected():
                break
            if event is None:
                yield ": ping\n\n"
                continue
            yield f"id: {event['id']}\nevent: {event['event']}\ndata: {json.dumps(event['data'])}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/{blog_id}/outline/review", response_model=BlogSummary, status_code=status.HTTP_202_ACCEPTED)
async def review_outline(blog_id: str, decision: OutlineDecision) -> BlogSummary:
    record = _get_or_404(blog_id)
    _ensure_status(record, "awaiting_outline_review")
    if decision.action == "regenerate":
        snapshot = await graph.aget_state(graph_config(blog_id))
        pending = snapshot.interrupts[0].value if snapshot.interrupts else {}
        if not pending.get("can_regenerate", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Regeneration limit reached. Edit the outline and approve it.",
            )
    return await _resume(record, "awaiting_outline_review", decision.model_dump())


@router.post("/{blog_id}/content/review", response_model=BlogSummary, status_code=status.HTTP_202_ACCEPTED)
async def review_content(blog_id: str, decision: ContentDecision) -> BlogSummary:
    record = _get_or_404(blog_id)
    return await _resume(record, "awaiting_content_review", decision.model_dump())
