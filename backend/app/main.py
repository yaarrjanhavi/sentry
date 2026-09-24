import os
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.database import (
    init_db,
    get_all_repos,
    get_repo_by_id,
    create_repo,
    get_repo_weights,
    set_category_weight,
    get_repo_history,
    add_history_point,
    get_pending_queue,
    get_flag_by_id,
    update_flag_status,
    insert_flags,
    create_round
)
from app.learning import (
    COLD_START_PRIORS,
    calculate_weight,
    update_bayesian_weight,
    generate_taste_explanation,
    get_color_token
)
from app.analyzer import (
    parse_diff,
    run_heuristic_analysis,
    call_llm_refinement,
    apply_weights_and_suppression
)
from app.seed_data import seed_database_if_empty
from app.models import (
    RepoSummary,
    RepoDetail,
    CategoryWeight,
    HistoryPoint,
    FlagItem,
    ActionRequest,
    ActionResponse,
    ReviewRequest,
    ReviewResponse,
    ExplainTasteResponse,
    CreateRepoRequest
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema and seed demo repos on boot
    init_db()
    seed_database_if_empty()
    yield


app = FastAPI(
    title="Sentry — Self-Learning Code Review Agent API",
    description="Adaptive code review agent that updates category weights based on human accept/dismiss feedback.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Next.js frontend and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def format_weights(raw_weights: List[Dict[str, Any]]) -> List[CategoryWeight]:
    result = []
    for w in raw_weights:
        cat = w["category"]
        weight_val = w["weight"]
        pct = w["percentage"]
        result.append(CategoryWeight(
            category=cat,
            weight=weight_val,
            percentage=pct,
            alpha=w["alpha"],
            beta=w["beta"],
            accept_count=w["accept_count"],
            dismiss_count=w["dismiss_count"],
            not_relevant_count=w["not_relevant_count"],
            suppressed=(weight_val < 0.28),
            color_token=get_color_token(cat)
        ))
    return sorted(result, key=lambda x: x.weight, reverse=True)


@app.get("/")
def root():
    return {
        "service": "Sentry AI Code Review Agent API",
        "status": "online",
        "docs_url": "/docs",
        "design_spec": "Dashboard-first with Bayesian adaptive category weighting"
    }


@app.get("/api/repos", response_model=List[RepoSummary])
def list_repositories():
    repos = get_all_repos()
    summaries = []
    
    for r in repos:
        r_id = r["id"]
        weights = get_repo_weights(r_id)
        fmt_weights = format_weights(weights)
        history = get_repo_history(r_id)
        
        current_rate = history[-1]["acceptance_rate"] if history else 50
        first_rate = history[0]["acceptance_rate"] if history else 50
        diff_pct = current_rate - first_rate
        trend = f"↑ {diff_pct}% since round 1" if diff_pct > 0 else "Baseline calibrated"
        
        top_cat = fmt_weights[0].category.capitalize() if fmt_weights else "General"
        top_weight = fmt_weights[0].percentage if fmt_weights else 50
        
        summaries.append(RepoSummary(
            id=r_id,
            name=r["name"],
            description=r.get("description", ""),
            created_at=r["created_at"],
            current_acceptance_rate=current_rate,
            trend_text=trend,
            flags_this_week=142 if r_id == "api-gateway" else (96 if r_id == "design-system" else 12),
            top_category=top_cat,
            top_category_weight=top_weight,
            weights=fmt_weights
        ))
        
    return summaries


@app.get("/api/repos/{repo_id}", response_model=RepoDetail)
def get_repository(repo_id: str):
    repo = get_repo_by_id(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
        
    r_id = repo["id"]
    weights = get_repo_weights(r_id)
    fmt_weights = format_weights(weights)
    history_raw = get_repo_history(r_id)
    queue_raw = get_pending_queue(r_id)

    history = [
        HistoryPoint(
            round_number=h["round_number"],
            acceptance_rate=h["acceptance_rate"],
            total_flags=h["total_flags"],
            accepted_flags=h["accepted_flags"],
            dismissed_flags=h["dismissed_flags"],
            created_at=h["created_at"]
        ) for h in history_raw
    ]

    queue = [
        FlagItem(
            id=q["id"],
            repo_id=q["repo_id"],
            round_id=q.get("round_id"),
            file_path=q["file_path"],
            line_number=q["line_number"],
            category=q["category"],
            severity=q["severity"],
            title=q["title"],
            explanation=q["explanation"],
            proposed_fix=q.get("proposed_fix"),
            status=q["status"],
            confidence=q.get("confidence", 0.85),
            suppressed=bool(q.get("suppressed")),
            repo_weight=next((w.percentage for w in fmt_weights if w.category == q["category"]), 50),
            created_at=q["created_at"]
        ) for q in queue_raw
    ]

    current_rate = history[-1].acceptance_rate if history else 50
    first_rate = history[0].acceptance_rate if history else 50
    diff_pct = current_rate - first_rate
    trend = f"↑ {diff_pct}% since round 1" if diff_pct > 0 else "Baseline calibration"

    top_cat = fmt_weights[0].category.capitalize() if fmt_weights else "General"
    top_weight = fmt_weights[0].percentage if fmt_weights else 50

    return RepoDetail(
        id=r_id,
        name=repo["name"],
        description=repo.get("description", ""),
        created_at=repo["created_at"],
        current_acceptance_rate=current_rate,
        trend_text=trend,
        flags_this_week=142 if r_id == "api-gateway" else (96 if r_id == "design-system" else 12),
        top_category=top_cat,
        top_category_weight=top_weight,
        weights=fmt_weights,
        history=history,
        queue=queue
    )


@app.post("/api/repos", response_model=RepoSummary)
def create_new_repository(payload: CreateRepoRequest):
    existing = get_repo_by_id(payload.name)
    if existing:
        raise HTTPException(status_code=400, detail="Repo with this name already exists")

    repo = create_repo(payload.name, payload.description or "")
    r_id = repo["id"]

    # Cold start baseline weights
    for cat, prior in COLD_START_PRIORS.items():
        w, pct = calculate_weight(prior["alpha"], prior["beta"])
        set_category_weight(
            r_id, cat, w, pct,
            alpha=prior["alpha"],
            beta=prior["beta"],
            accept_count=0,
            dismiss_count=0,
            not_relevant_count=0
        )

    # Initial history point
    add_history_point(r_id, 1, 50, 0, 0, 0)

    weights = get_repo_weights(r_id)
    fmt_weights = format_weights(weights)

    return RepoSummary(
        id=r_id,
        name=repo["name"],
        description=repo["description"],
        created_at=repo["created_at"],
        current_acceptance_rate=50,
        trend_text="Cold-start initialized",
        flags_this_week=0,
        top_category=fmt_weights[0].category.capitalize() if fmt_weights else "Security",
        top_category_weight=fmt_weights[0].percentage if fmt_weights else 80,
        weights=fmt_weights
    )


@app.get("/api/repos/{repo_id}/taste")
def explain_repo_taste(repo_id: str):
    """
    Plain-English synthesis of what Sentry has learned about this repo.
    """
    repo = get_repo_by_id(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    weights = get_repo_weights(repo["id"])
    taste = generate_taste_explanation(repo["name"], weights)
    return taste


@app.post("/api/flags/{flag_id}/action", response_model=ActionResponse)
def handle_flag_action(flag_id: str, payload: ActionRequest):
    """
    Core feedback loop: Updates Bayesian weight model immediately on Accept, Dismiss, or Not Relevant.
    Calculates updated rates, pushes history point, and returns updated weights to trigger UI animation.
    """
    action = payload.action.lower()
    if action not in ["accept", "dismiss", "not_relevant"]:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'accept', 'dismiss', or 'not_relevant'.")

    flag = get_flag_by_id(flag_id)
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")

    repo_id = flag["repo_id"]
    category = flag["category"]

    # 1. Update flag status in DB
    updated_flag = update_flag_status(flag_id, action)

    # 2. Retrieve current category weight record
    weights = get_repo_weights(repo_id)
    cat_record = next((w for w in weights if w["category"] == category), None)

    if cat_record:
        cur_alpha = cat_record["alpha"]
        cur_beta = cat_record["beta"]
        accepts = cat_record["accept_count"]
        dismisses = cat_record["dismiss_count"]
        not_relevant = cat_record["not_relevant_count"]
    else:
        prior = COLD_START_PRIORS.get(category, {"alpha": 5.0, "beta": 5.0})
        cur_alpha, cur_beta = prior["alpha"], prior["beta"]
        accepts, dismisses, not_relevant = 0, 0, 0

    if action == "accept":
        accepts += 1
    elif action == "dismiss":
        dismisses += 1
    elif action == "not_relevant":
        not_relevant += 1

    # 3. Compute new Bayesian parameters
    new_alpha, new_beta, new_weight, new_pct = update_bayesian_weight(cur_alpha, cur_beta, action)

    # 4. Save updated weight
    set_category_weight(
        repo_id, category, new_weight, new_pct,
        alpha=new_alpha, beta=new_beta,
        accept_count=accepts,
        dismiss_count=dismisses,
        not_relevant_count=not_relevant
    )

    # 5. Update acceptance rate and append new history point
    all_weights = get_repo_weights(repo_id)
    history = get_repo_history(repo_id)
    
    total_acc = sum(w["accept_count"] for w in all_weights)
    total_dsm = sum(w["dismiss_count"] + w["not_relevant_count"] for w in all_weights)
    total_reviews = total_acc + total_dsm
    
    new_rate = int(round((total_acc / total_reviews) * 100)) if total_reviews > 0 else 50
    next_round = (history[-1]["round_number"] + 1) if history else 1
    
    add_history_point(repo_id, next_round, new_rate, total_reviews, total_acc, total_dsm)

    # 6. Format updated weights and taste explanation
    fmt_weights = format_weights(all_weights)
    taste = generate_taste_explanation(repo_id, all_weights)

    return ActionResponse(
        flag_id=flag_id,
        new_status=action,
        repo_id=repo_id,
        category=category,
        updated_weight=new_weight,
        updated_percentage=new_pct,
        repo_acceptance_rate=new_rate,
        taste_explanation=taste["summary"],
        weights=fmt_weights
    )


@app.post("/api/repos/{repo_id}/review", response_model=ReviewResponse)
async def review_diff(repo_id: str, payload: ReviewRequest):
    """
    Submits a new code diff for review:
    1. Parses diff hunks
    2. Runs static analysis
    3. Runs LLM refinement if API key exists
    4. Evaluates flags against repo's learned category weights
    5. Saves new review round and returns flags
    """
    repo = get_repo_by_id(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    parsed_lines = parse_diff(payload.diff_content)
    heuristic_flags = run_heuristic_analysis(parsed_lines)
    refined_flags = await call_llm_refinement(payload.diff_content, heuristic_flags)

    weights = get_repo_weights(repo_id)
    enriched_flags = apply_weights_and_suppression(refined_flags, weights, repo_id)

    # Create round
    history = get_repo_history(repo_id)
    round_no = (history[-1]["round_number"] + 1) if history else 1
    round_id = create_round(repo_id, round_no, payload.diff_title, payload.diff_content)

    for f in enriched_flags:
        f["round_id"] = round_id

    # Insert into database
    insert_flags(enriched_flags)

    suppressed_count = sum(1 for f in enriched_flags if f.get("suppressed"))

    formatted_flags = [
        FlagItem(
            id=f["id"],
            repo_id=repo_id,
            round_id=round_id,
            file_path=f["file_path"],
            line_number=f["line_number"],
            category=f["category"],
            severity=f["severity"],
            title=f["title"],
            explanation=f["explanation"],
            proposed_fix=f.get("proposed_fix"),
            status="pending",
            confidence=f.get("confidence", 0.85),
            suppressed=bool(f.get("suppressed")),
            repo_weight=f.get("repo_weight", 50)
        )
        for f in enriched_flags
    ]

    return ReviewResponse(
        repo_id=repo_id,
        round_id=round_id,
        diff_title=payload.diff_title,
        flags=formatted_flags,
        filtered_out_count=suppressed_count,
        total_detected=len(enriched_flags)
    )


@app.post("/api/repos/{repo_id}/reset")
def reset_repo(repo_id: str):
    """
    Resets a repository to cold-start defaults for testing and demo repeatability.
    """
    repo = get_repo_by_id(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    for cat, prior in COLD_START_PRIORS.items():
        w, pct = calculate_weight(prior["alpha"], prior["beta"])
        set_category_weight(
            repo_id, cat, w, pct,
            alpha=prior["alpha"],
            beta=prior["beta"],
            accept_count=0,
            dismiss_count=0,
            not_relevant_count=0
        )

    # Reset history
    add_history_point(repo_id, 1, 50, 0, 0, 0)
    weights = get_repo_weights(repo_id)
    fmt_weights = format_weights(weights)

    return {"status": "success", "message": f"Repo {repo_id} reset to cold-start defaults", "weights": fmt_weights}
