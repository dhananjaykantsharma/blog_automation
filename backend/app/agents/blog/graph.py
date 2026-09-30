from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy

from app.agents.blog.nodes import (
    finalize,
    generate_outline,
    research,
    review_content,
    review_outline,
    revise_content,
    take_notes,
    write_sections,
)
from app.agents.blog.research_tools import is_transient
from app.agents.blog.state import BlogState


def build_graph():
    builder = StateGraph(BlogState)
    # A retry re-runs the whole node, which is fine here: research has no side effects besides progress events
    builder.add_node("research", research, retry_policy=RetryPolicy(max_attempts=3, retry_on=is_transient))
    # LLM nodes need no retry_policy: ChatOpenAI(max_retries=3) already retries the failing request itself
    builder.add_node("take_notes", take_notes)
    builder.add_node("generate_outline", generate_outline)
    builder.add_node("review_outline", review_outline)
    builder.add_node("write_sections", write_sections)
    builder.add_node("review_content", review_content)
    builder.add_node("revise_content", revise_content)
    builder.add_node("finalize", finalize)

    builder.add_edge(START, "research")
    builder.add_edge("research", "take_notes")
    builder.add_edge("take_notes", "generate_outline")
    builder.add_edge("generate_outline", "review_outline")
    # review_outline routes itself via Command → write_sections | generate_outline
    builder.add_edge("write_sections", "review_content")
    # review_content routes itself via Command → finalize | revise_content
    builder.add_edge("revise_content", "review_content")
    builder.add_edge("finalize", END)

    # InMemorySaver loses paused blogs on restart; use AsyncPostgresSaver in production
    return builder.compile(checkpointer=InMemorySaver())


graph = build_graph()
