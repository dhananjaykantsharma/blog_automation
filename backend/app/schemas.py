from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, HttpUrl, model_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class User(BaseModel):
    email: EmailStr
    name: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: User


BlogType = Literal["how_to", "listicle", "tutorial", "comparison", "opinion", "news", "case_study", "review"]
Tone = Literal["professional", "conversational", "technical", "friendly", "authoritative"]
BlogLength = Literal["short", "medium", "long"]
BlogStatus = Literal["running", "awaiting_outline_review", "awaiting_content_review", "completed", "failed"]


class CreateBlogRequest(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    blog_type: BlogType
    research_urls: list[HttpUrl] = Field(default_factory=list, max_length=10)
    web_research: bool = True
    primary_keyword: str = ""
    secondary_keywords: list[str] = Field(default_factory=list)
    target_audience: str = ""
    tone: Tone = "professional"
    length: BlogLength = "medium"
    language: str = "English"
    include_faq: bool = True
    include_cta: bool = True
    instructions: str = Field(default="", max_length=4000)

    @model_validator(mode="after")
    def needs_a_source(self)-> "CreateBlogRequest":
        if not self.web_research and not self.research_urls:
            raise ValueError("Add atleast one research url or enable web research")
        return self

class OutlineSection(BaseModel):
    heading: str = Field(min_length=1, max_length=200)
    key_points: list[str] = Field(default_factory=list)

class Outline(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    sections: list[OutlineSection] = Field(min_length=1)

class OutlineDecision(BaseModel):
    action: Literal["approve", "regenerate"]
    outline: Outline | None = None  # approve: user's edited outline; None keeps the generated one
    feedback: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def feedback_for_regenerate(self) -> "OutlineDecision":
        if self.action == "regenerate" and not self.feedback.strip():
            raise ValueError("Feedback is required to regenerate the outline")
        return self


class ContentDecision(BaseModel):
    action: Literal["approve", "revise"]
    content: str | None = Field(default=None, max_length=100_000)  # user's edited draft; None keeps the generated one
    feedback: str = Field(default="", max_length=4000)

    @model_validator(mode="after")
    def feedback_for_revise(self) -> "ContentDecision":
        if self.action == "revise" and not self.feedback.strip():
            raise ValueError("Feedback is required to request changes")
        return self


class BlogSummary(BaseModel):
    id: str
    title: str
    blog_type: BlogType
    status: BlogStatus
    created_at: datetime


class BlogDetail(BlogSummary):
    error: str | None = None
    pending_review: dict | None = None  # the payload passed to interrupt(), if the graph is paused
    outline: dict | None = None
    content: str | None = None