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
    ci_lower: float = 0.0
    ci_upper: float = 1.0
    ci_percentage_lower: int = 0
    ci_percentage_upper: int = 100
    is_cold_start: bool = False
    total_feedback: int = 0


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
    demoted: bool = False
    suppression_reason: Optional[str] = None
    diff_patch: Optional[str] = None
    language: Optional[str] = "python"
    repo_weight: Optional[int] = None
    why_shown: Optional[str] = None
    ci_bounds: Optional[str] = None
    github_comment_id: Optional[str] = None
    github_pr_id: Optional[str] = None
    created_at: Optional[str] = None


class ReviewerProfile(BaseModel):
    id: str
    repo_id: str
    name: str
    role: str
    avatar_color: str = "#3DFF6B"
    current_acceptance_rate: int = 50
    top_category: str = "Security"
    top_category_weight: int = 80
    weights: List[CategoryWeight] = []
    total_reviews_count: int = 0
    taste_summary: Optional[str] = None


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
    is_cold_start: bool = False
    total_reviews_count: int = 0


class RepoDetail(RepoSummary):
    history: List[HistoryPoint]
    queue: List[FlagItem]
    reviewers: List[ReviewerProfile] = []


class ApplyFixRequest(BaseModel):
    note: Optional[str] = None
    create_branch: bool = True


class ApplyFixResponse(BaseModel):
    flag_id: str
    status: str
    branch_name: str
    commit_sha: str
    diff_patch: str
    file_path: str
    message: str


class ActionRequest(BaseModel):
    action: str = Field(..., description="'accept', 'dismiss', or 'not_relevant'")
    note: Optional[str] = None
    reviewer_id: Optional[str] = None


class ActionResponse(BaseModel):
    flag_id: str
    new_status: str
    repo_id: str
    category: str
    updated_weight: float
    updated_percentage: int
    repo_acceptance_rate: int
    taste_explanation: str
    why_shown: Optional[str] = None
    weights: List[CategoryWeight]
    reviewer_profile: Optional[ReviewerProfile] = None


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


class BenchmarkRoundResult(BaseModel):
    round_number: int
    round_title: str
    total_flags: int
    learned_shown: int
    learned_accepted: int
    learned_dismissed: int
    learned_precision: float
    learned_acceptance_rate: float
    learned_fpr: float
    baseline_shown: int
    baseline_accepted: int
    baseline_dismissed: int
    baseline_precision: float
    baseline_acceptance_rate: float
    baseline_fpr: float


class BenchmarkSummaryResponse(BaseModel):
    repo_name: str
    scenario_name: str
    rounds_count: int = 10
    total_historical_flags: int = 100
    learned_final_precision: float
    baseline_final_precision: float
    precision_gain: float
    learned_final_acceptance_rate: float = 1.0
    baseline_final_acceptance_rate: float = 0.5
    learned_final_fpr: float
    baseline_final_fpr: float
    noise_reduction_pct: float
    rounds: List[BenchmarkRoundResult]
    category_weights_progression: Dict[str, List[int]]


class GitHubWebhookPayload(BaseModel):
    action: Optional[str] = None
    pull_request: Optional[Dict[str, Any]] = None
    repository: Optional[Dict[str, Any]] = None
    comment: Optional[Dict[str, Any]] = None
    reaction: Optional[Dict[str, Any]] = None
    review: Optional[Dict[str, Any]] = None
    sender: Optional[Dict[str, Any]] = None


class GitHubWebhookResponse(BaseModel):
    status: str
    event: str
    action_taken: str
    flags_generated: int = 0
    feedback_recorded: Optional[str] = None
    details: Optional[str] = None


class CategoryComparisonItem(BaseModel):
    category: str
    source_percentage: int
    target_percentage: int
    difference: int
    favored_by: str


class RepoCompareResponse(BaseModel):
    source_repo_id: str
    source_repo_name: str
    target_repo_id: str
    target_repo_name: str
    divergence_score: int
    source_top_category: str
    target_top_category: str
    key_differences: List[str]
    categories: List[CategoryComparisonItem]


class DemoConvergenceResponse(BaseModel):
    status: str
    message: str
    repos_seeded: List[str]
