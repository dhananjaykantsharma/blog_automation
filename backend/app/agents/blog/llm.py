from functools import lru_cache

from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.core.config import get_settings


@lru_cache
def get_llm() -> ChatOpenAI:
    settings = get_settings()
    # max_retries: the OpenAI SDK itself retries rate limits (429), 5xx and dropped connections with backoff
    return ChatOpenAI(model=settings.openai_model, api_key=settings.openai_api_key, max_retries=3, timeout=120)


# ---- Shapes the LLM must answer in (used with with_structured_output) ----
# Field descriptions are sent to the model as part of the JSON schema, so they work like mini prompts.


class Note(BaseModel):
    source: str = Field(description="URL of the source the fact comes from, copied exactly")
    fact: str = Field(description="One self-contained fact, statistic, example or quote, in your own words")


class ResearchNotes(BaseModel):
    notes: list[Note]


class SectionPlan(BaseModel):
    heading: str
    key_points: list[str] = Field(description="2-4 points this section must cover")


class OutlinePlan(BaseModel):
    title: str
    sections: list[SectionPlan]
