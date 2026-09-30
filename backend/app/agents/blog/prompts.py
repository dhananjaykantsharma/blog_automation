"""Every prompt the blog graph sends to the LLM. Each function returns a message list for llm.ainvoke()."""

TARGET_WORDS = {"short": 800, "medium": 1500, "long": 2500}
# Without a limit the model writes 10+ thin sections even for a short post
SECTION_COUNT = {"short": "4-5", "medium": "5-7", "long": "7-10"}

WRITER_SYSTEM = (
    "You are an expert blog writer. You write accurate, well-structured, engaging posts in Markdown. "
    "Only state facts that appear in the research notes; never invent statistics, quotes or sources."
)


def _brief(request: dict) -> str:
    """The user's blog settings as plain text; every prompt after research includes it."""
    lines = [
        f"Title: {request['title']}",
        f"Blog type: {request['blog_type'].replace('_', ' ')}",
        f"Tone: {request['tone']}",
        f"Language: {request['language']}",
        f"Target length: about {TARGET_WORDS[request['length']]} words",
    ]
    if request["target_audience"]:
        lines.append(f"Target audience: {request['target_audience']}")
    if request["primary_keyword"]:
        lines.append(f"Primary SEO keyword: {request['primary_keyword']}")
    if request["secondary_keywords"]:
        lines.append(f"Secondary keywords: {', '.join(request['secondary_keywords'])}")
    if request["instructions"]:
        lines.append(f"Extra instructions from the user: {request['instructions']}")
    return "\n".join(lines)


def _notes(notes: list[dict]) -> str:
    return "\n".join(f"- {n['fact']} (source: {n['source']})" for n in notes)


def _outline(outline: dict) -> str:
    parts = [f"# {outline['title']}"]
    for section in outline["sections"]:
        parts.append(f"## {section['heading']}")
        parts += [f"- {point}" for point in section["key_points"]]
    return "\n".join(parts)


def notes_prompt(request: dict, sources: list[dict]) -> list[tuple[str, str]]:
    blocks = "\n\n".join(
        f"<source url=\"{s['url']}\" title=\"{s['title']}\">\n{s['content']}\n</source>" for s in sources
    )
    return [
        ("system", "You are a research assistant who extracts useful facts for a blog writer."),
        ("human", (
            f"Blog title: {request['title']}\n\n"
            "From the sources below, extract 8-20 facts that would help write this blog: definitions, "
            "statistics, examples, steps, quotes and opinions worth citing. Skip navigation text, ads and "
            "anything unrelated to the title. Set each note's source to the URL it came from.\n\n"
            f"{blocks}"
        )),
    ]


def outline_prompt(request: dict, notes: list[dict], previous: dict | None, feedback: str) -> list[tuple[str, str]]:
    extras = []
    if request["include_faq"]:
        extras.append("an 'FAQ' section near the end")
    if request["include_cta"]:
        extras.append("a closing section with a call to action")
    task = (
        "Create a blog outline: an introduction, the main sections, and a conclusion. "
        f"Use {SECTION_COUNT[request['length']]} sections in total, counting all of those. "
        "Headings should be specific, not generic."
    )
    if extras:
        task += f" Include {' and '.join(extras)}."
    if previous and feedback:
        # Regenerating: show the model what it made last time and what the user wants changed
        task += (
            f"\n\nThe user rejected this earlier outline:\n{_outline(previous)}\n\n"
            f"Their feedback: {feedback}\nProduce a new outline that applies this feedback."
        )
    return [
        ("system", WRITER_SYSTEM),
        ("human", f"{_brief(request)}\n\nResearch notes:\n{_notes(notes)}\n\n{task}"),
    ]


def section_prompt(
    request: dict, notes: list[dict], outline: dict, section: dict, written: str, words: int
) -> list[tuple[str, str]]:
    return [
        ("system", WRITER_SYSTEM),
        ("human", (
            f"{_brief(request)}\n\nFull outline:\n{_outline(outline)}\n\n"
            f"Research notes:\n{_notes(notes)}\n\n"
            f"Already written (continue from here, don't repeat it):\n{written or '(nothing yet)'}\n\n"
            f"Now write only the body of the section \"{section['heading']}\", about {words} words, "
            f"covering: {'; '.join(section['key_points'])}.\n"
            "Do not write the section heading itself. Use ### subheadings, lists or code blocks where they help. "
            "Output only the Markdown."
        )),
    ]


def revise_prompt(request: dict, notes: list[dict], content: str, feedback: str) -> list[tuple[str, str]]:
    return [
        ("system", WRITER_SYSTEM),
        ("human", (
            f"{_brief(request)}\n\nResearch notes:\n{_notes(notes)}\n\n"
            f"Current draft:\n{content}\n\n"
            f"Revise the draft according to this feedback: {feedback}\n"
            "Keep everything the feedback doesn't ask to change. Output the complete revised blog in Markdown, "
            "starting with the # title."
        )),
    ]
