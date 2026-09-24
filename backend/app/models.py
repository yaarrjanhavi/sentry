from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class CategoryEnum(str, Enum):
    SECURITY = "security"
    COMPLEXITY = "complexity"
    STYLE = "style"
    DUPLICATION = "duplication"
    BEST_PRACTICE = "best-practice"


class SeverityEnum(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    NIT = "nit"


class FlagStatusEnum(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DISMISSED = "dismissed"
    NOT_RELEVANT = "not_relevant"


class CategoryWeight(BaseModel):
    category: str
    weight: float = Field(..., ge=0.0, le=1.0, description="Normalized weight [0, 1]")
    percentage: int = Field(..., ge=0, le=100)
    alpha: float
    beta: float
    accept_count: int
    dismiss_count: int
    not_relevant_count: int
    suppressed: bool = False
    color_token: str = "primary"  # 'accent', 'primary', 'muted', etc.


class HistoryPoint(BaseModel):
    round_number: int
    acceptance_rate: int
    total_flags: int
    accepted_flags: int
    dismissed_flags: int
    created_at: str


class FlagItem(BaseModel):
    id: str
    repo_id: str
    round_id: Optional[str] = None
    file_path: str
    line_number: int
    category: str
    severity: str
    title: str
    explanation: str
    proposed_fix: Optional[str] = None
    status: str = "pending"
    confidence: float = 0.85
    suppressed: bool = False
    repo_weight: Optional[int] = None
    created_at: Optional[str] = None


class RepoSummary(BaseModel):
    id: str
    name: str
    description: str
    created_at: str
    current_acceptance_rate: int
    trend_text: str
    flags_this_week: int
    top_category: str
    top_category_weight: int
    weights: List[CategoryWeight]


class RepoDetail(RepoSummary):
    history: List[HistoryPoint]
    queue: List[FlagItem]


class ActionRequest(BaseModel):
    action: str = Field(..., description="'accept', 'dismiss', or 'not_relevant'")
    note: Optional[str] = None


class ActionResponse(BaseModel):
    flag_id: str
    new_status: str
    repo_id: str
    category: str
    updated_weight: float
    updated_percentage: int
    repo_acceptance_rate: int
    taste_explanation: str
    weights: List[CategoryWeight]


class ReviewRequest(BaseModel):
    repo_id: str
    diff_title: str
    diff_content: str


class ReviewResponse(BaseModel):
    repo_id: str
    round_id: str
    diff_title: str
    flags: List[FlagItem]
    filtered_out_count: int
    total_detected: int


class ExplainTasteResponse(BaseModel):
    repo_id: str
    repo_name: str
    headline: str
    summary: str
    priorities: List[str]
    suppressed: List[str]
    confidence_level: str
    stats: Dict[str, Any]


class CreateRepoRequest(BaseModel):
    name: str
    description: Optional[str] = ""
