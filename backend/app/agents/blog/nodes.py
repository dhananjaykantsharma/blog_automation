import asyncio
from typing import Any, Literal

from langchain_core.runnables import RunnableConfig
from langchain_core.runnables.config import var_child_runnable_config
from langgraph.types import Command, interrupt

from app.agents.blog import prompts
from app.agents.blog.llm import OutlinePlan, ResearchNotes, get_llm
from app.agents.blog.research_tools import extract_urls, search_web
from app.agents.blog.state import BlogState
from app.services.events import bus

MAX_OUTLINE_ATTEMPTS = 3


# ---- Work nodes: research uses Tavily, the rest call the LLM ----
# Each node receives the current state and returns only the keys it changed.


async def report(config: RunnableConfig, step: str, message: str) -> None:
    """Publishes a progress event straight to the SSE bus; thread_id is the blog id.

    LangGraph's own stream writer relies on contextvars, which async nodes don't get on Python 3.10.
    On 3.11+ this could become get_stream_writer() plus stream_mode="custom" in run_graph.
    """
    await bus.publish(config["configurable"]["thread_id"], "progress", {"step": step, "message": message})


def search_query(request: dict) -> str:
    keyword = request["primary_keyword"]
    if keyword and keyword.lower() not in request["title"].lower():
        return f"{request['title']} {keyword}"
    return request["title"]


async def research(state: BlogState, config: RunnableConfig) -> dict:
    request = state["request"]
    urls = request["research_urls"]
    if urls:
        await report(config, "research", f"Reading {len(urls)} source URL(s)")
    if request["web_research"]:
        await report(config, "research", "Searching the web")

    async def search() -> list[dict]:
        if not request["web_research"]:
            return []
        topic = "news" if request["blog_type"] == "news" else "general"
        return await search_web(search_query(request), topic)

    # Extract and search don't depend on each other, so run them at the same time
    (from_urls, failed), from_search = await asyncio.gather(extract_urls(urls), search())

    for url in failed:
        await report(config, "research", f"Couldn't read {url}, skipping it")

    # The user's own URLs come first; drop search results that repeat one of them
    sources = list(from_urls)
    seen = {s["url"] for s in sources}
    sources += [s for s in from_search if s["url"] not in seen]

    if not sources:
        # Writing without any research would make the LLM invent facts, so stop here
        raise RuntimeError("No research sources could be read. Check the URLs or enable web research.")
    await report(config, "research", f"Collected {len(sources)} source(s)")
    return {"sources": sources}


async def take_notes(state: BlogState, config: RunnableConfig) -> dict:
    """Turns long raw pages into a short list of facts, so later prompts stay small and focused."""
    await report(config, "notes", f"Reading {len(state['sources'])} source(s) and taking notes")
    # with_structured_output makes the model answer as ResearchNotes JSON and parses it for us.
    # Passing config along keeps the LLM call inside this node's run (tracing, callbacks).
    llm = get_llm().with_structured_output(ResearchNotes)
    result = await llm.ainvoke(prompts.notes_prompt(state["request"], state["sources"]), config)
    await report(config, "notes", f"Took {len(result.notes)} note(s)")
    return {"notes": [note.model_dump() for note in result.notes]}  # state holds plain dicts, not models


async def generate_outline(state: BlogState, config: RunnableConfig) -> dict:
    feedback = state.get("outline_feedback", "")
    await report(config, "outline", "Regenerating outline with your feedback" if feedback else "Drafting outline")
    llm = get_llm().with_structured_output(OutlinePlan)
    messages = prompts.outline_prompt(state["request"], state["notes"], state.get("outline"), feedback)
    outline = await llm.ainvoke(messages, config)
    return {
        "outline": outline.model_dump(),
        "outline_attempts": state.get("outline_attempts", 0) + 1,
    }


async def write_sections(state: BlogState, config: RunnableConfig) -> dict:
    request, notes, outline = state["request"], state["notes"], state["outline"]
    sections = outline["sections"]
    words = prompts.TARGET_WORDS[request["length"]] // len(sections)
    parts = [f"# {outline['title']}"]
    # One call per section, in order: each call sees what's already written, so sections don't repeat each other
    for i, section in enumerate(sections, 1):
        await report(config, "write", f"Writing section {i}/{len(sections)}: {section['heading']}")
        written = "\n\n".join(parts)
        response = await get_llm().ainvoke(
            prompts.section_prompt(request, notes, outline, section, written, words), config
        )
        parts.append(f"## {section['heading']}\n\n{response.text.strip()}")
    return {"content": "\n\n".join(parts)}


async def revise_content(state: BlogState, config: RunnableConfig) -> dict:
    await report(config, "revise", "Revising the draft with your feedback")
    messages = prompts.revise_prompt(state["request"], state["notes"], state["content"], state["content_feedback"])
    response = await get_llm().ainvoke(messages, config)
    return {"content": response.text.strip(), "content_feedback": ""}


async def finalize(state: BlogState, config: RunnableConfig) -> dict:
    await report(config, "finalize", "Finalizing")
    return {"word_count": len(state["content"].split())}


# ---- Human review nodes ----
# On resume the node re-runs from the top, so nothing expensive may run before interrupt().
# The dict passed to interrupt() is what the frontend receives; the dict sent to Command(resume=...)
# is what interrupt() returns here.


def ask_human(config: RunnableConfig, payload: dict) -> Any:
    """interrupt() with the node's config put back into context.

    interrupt() finds the running graph through a contextvar that async graphs can't pass down on
    Python 3.10. On 3.11+ this is just interrupt(payload).
    """
    token = var_child_runnable_config.set(config)
    try:
        return interrupt(payload)
    finally:
        var_child_runnable_config.reset(token)


def review_outline(state: BlogState, config: RunnableConfig) -> Command[Literal["write_sections", "generate_outline"]]:
    decision = ask_human(config, {
        "type": "outline_review",
        "outline": state["outline"],
        "can_regenerate": state["outline_attempts"] < MAX_OUTLINE_ATTEMPTS,
    })
    if decision["action"] == "approve":
        return Command(
            goto="write_sections",
            update={"outline": decision.get("outline") or state["outline"], "outline_feedback": ""},
        )
    return Command(goto="generate_outline", update={"outline_feedback": decision["feedback"]})


def review_content(state: BlogState, config: RunnableConfig) -> Command[Literal["finalize", "revise_content"]]:
    decision = ask_human(config, {"type": "content_review", "content": state["content"]})
    # The user may have edited the draft in the editor; their version replaces ours on both paths,
    # so a revision starts from their edits instead of throwing them away
    content = decision.get("content") or state["content"]
    if decision["action"] == "approve":
        return Command(goto="finalize", update={"content": content})
    return Command(goto="revise_content", update={"content": content, "content_feedback": decision["feedback"]})
