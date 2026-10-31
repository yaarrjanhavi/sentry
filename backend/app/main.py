import os
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Request, Header
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
    create_round,
    record_feedback_event,
    record_github_event,
    get_github_events,
    get_repo_reviewers,
    get_reviewer_by_id,
    create_reviewer,
    get_reviewer_weights,
    set_reviewer_weight,
    apply_fix_flag
)
from app.learning import (
    COLD_START_PRIORS,
    calculate_weight,
    update_bayesian_weight,
    generate_taste_explanation,
    get_color_token,
    calculate_credible_interval,
    is_cold_start_category,
    generate_why_shown_explanation,
    TIME_DECAY_FACTOR
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
    CreateRepoRequest,
    BenchmarkSummaryResponse,
    GitHubWebhookResponse,
    ReviewerProfile,
    ApplyFixRequest,
    ApplyFixResponse
)
from app.benchmark import run_benchmark_replay
from app.github_integration import (
    verify_github_signature,
    handle_github_pull_request_event,
    handle_github_feedback_event
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
    version="2.0.0",
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


def format_reviewer_profiles(repo_id: str) -> List[ReviewerProfile]:
    """Formats all teammate reviewer profiles with their Bayesian weights"""
    raw_reviewers = get_repo_reviewers(repo_id)
    profiles = []
    for r in raw_reviewers:
        r_id = r["id"]
        raw_weights = get_reviewer_weights(r_id)
        fmt_weights = []
        for w in raw_weights:
            cat = w["category"]
            w_val = w["weight"]
            pct = w["percentage"]
            alpha = w["alpha"]
            beta = w["beta"]
            ci_l, ci_u, ci_lp, ci_up = calculate_credible_interval(alpha, beta)
            fmt_weights.append(CategoryWeight(
                category=cat,
                weight=w_val,
                percentage=pct,
                alpha=alpha,
                beta=beta,
                accept_count=w.get("accept_count", 0),
                dismiss_count=w.get("dismiss_count", 0),
                not_relevant_count=w.get("not_relevant_count", 0),
                suppressed=(w_val < 0.28),
                color_token=get_color_token(cat),
                ci_lower=ci_l,
                ci_upper=ci_u,
                ci_percentage_lower=ci_lp,
                ci_percentage_upper=ci_up,
                is_cold_start=is_cold_start_category(w.get("accept_count", 0), w.get("dismiss_count", 0)),
                total_feedback=w.get("accept_count", 0) + w.get("dismiss_count", 0)
            ))
        sorted_weights = sorted(fmt_weights, key=lambda x: x.weight, reverse=True)
        top_cat = sorted_weights[0].category.capitalize() if sorted_weights else "Security"
        top_weight = sorted_weights[0].percentage if sorted_weights else 50
        total_acc = sum(w.accept_count for w in sorted_weights)
        total_dsm = sum(w.dismiss_count for w in sorted_weights)
        total_reviews = total_acc + total_dsm
        acc_rate = int(round((total_acc / max(1, total_reviews)) * 100)) if total_reviews > 0 else 50

        profiles.append(ReviewerProfile(
            id=r_id,
            repo_id=repo_id,
            name=r["name"],
            role=r["role"],
            avatar_color=r.get("avatar_color", "#3DFF6B"),
            current_acceptance_rate=acc_rate,
            top_category=top_cat,
            top_category_weight=top_weight,
            weights=sorted_weights,
            total_reviews_count=total_reviews,
            taste_summary=f"{r['name']} prioritizes {top_cat} ({top_weight}%) based on {total_reviews} reviews."
        ))
    return profiles


def format_weights(raw_weights: List[Dict[str, Any]]) -> List[CategoryWeight]:
    result = []
    for w in raw_weights:
        cat = w["category"]
        weight_val = w["weight"]
        pct = w["percentage"]
        alpha = w["alpha"]
        beta = w["beta"]
        accepts = w["accept_count"]
        dismisses = w["dismiss_count"]
        not_relevant = w["not_relevant_count"]

        ci_l = w.get("ci_lower")
        ci_u = w.get("ci_upper")
        ci_lp = w.get("ci_percentage_lower")
        ci_up = w.get("ci_percentage_upper")

        if ci_l is None or ci_u is None or ci_lp == 0 and ci_up == 100:
            ci_l, ci_u, ci_lp, ci_up = calculate_credible_interval(alpha, beta)

        is_cold = bool(w.get("is_cold_start")) or is_cold_start_category(accepts, dismisses, not_relevant)

        result.append(CategoryWeight(
            category=cat,
            weight=weight_val,
            percentage=pct,
            alpha=alpha,
            beta=beta,
            accept_count=accepts,
            dismiss_count=dismisses,
            not_relevant_count=not_relevant,
            suppressed=(weight_val < 0.28),
            color_token=get_color_token(cat),
            ci_lower=ci_l,
            ci_upper=ci_u,
            ci_percentage_lower=ci_lp,
            ci_percentage_upper=ci_up,
            is_cold_start=is_cold,
            total_feedback=accepts + dismisses + not_relevant
        ))
    return sorted(result, key=lambda x: x.weight, reverse=True)


@app.get("/")
def root():
    return {
        "service": "Sentry AI Code Review Agent API",
        "version": "2.0.0",
        "status": "online",
        "features": [
            "Bayesian Beta-Binomial posterior with time decay",
            "Credible interval uncertainty bounds & cold-start badges",
            "Why was this shown transparency explainers",
            "Offline replay benchmark proof engine",
            "GitHub App & webhook automated PR review feedback loop"
        ],
        "docs_url": "/docs"
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

        total_feedback = sum(w.total_feedback for w in fmt_weights)
        is_repo_cold = total_feedback < 10
        
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
            weights=fmt_weights,
            is_cold_start=is_repo_cold,
            total_reviews_count=total_feedback
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

    queue = []
    for q in queue_raw:
        cat = q["category"]
        w_obj = next((w for w in fmt_weights if w.category == cat), None)
        pct = w_obj.percentage if w_obj else 50
        ci_bounds = f"[{w_obj.ci_percentage_lower}% - {w_obj.ci_percentage_upper}%]" if w_obj else "[30% - 70%]"
        why = q.get("why_shown")
        if not why and w_obj:
            why = generate_why_shown_explanation(
                category=cat,
                weight=w_obj.weight,
                percentage=pct,
                accept_count=w_obj.accept_count,
                dismiss_count=w_obj.dismiss_count,
                severity=q["severity"],
                is_suppressed=bool(q.get("suppressed")),
                ci_lower_pct=w_obj.ci_percentage_lower,
                ci_upper_pct=w_obj.ci_percentage_upper,
                is_cold_start=w_obj.is_cold_start
            )
        queue.append(FlagItem(
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
            demoted=bool(q.get("demoted")),
            suppression_reason=q.get("suppression_reason"),
            diff_patch=q.get("diff_patch"),
            language=q.get("language") or "python",
            repo_weight=pct,
            why_shown=why,
            ci_bounds=ci_bounds,
            github_comment_id=q.get("github_comment_id"),
            github_pr_id=q.get("github_pr_id"),
            created_at=q["created_at"]
        ))

    current_rate = history[-1].acceptance_rate if history else 50
    first_rate = history[0].acceptance_rate if history else 50
    diff_pct = current_rate - first_rate
    trend = f"↑ {diff_pct}% since round 1" if diff_pct > 0 else "Baseline calibration"

    top_cat = fmt_weights[0].category.capitalize() if fmt_weights else "General"
    top_weight = fmt_weights[0].percentage if fmt_weights else 50
    total_feedback = sum(w.total_feedback for w in fmt_weights)

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
        queue=queue,
        reviewers=format_reviewer_profiles(r_id),
        is_cold_start=(total_feedback < 10),
        total_reviews_count=total_feedback
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
        ci_l, ci_u, ci_lp, ci_up = calculate_credible_interval(prior["alpha"], prior["beta"])
        set_category_weight(
            r_id, cat, w, pct,
            alpha=prior["alpha"],
            beta=prior["beta"],
            accept_count=0,
            dismiss_count=0,
            not_relevant_count=0,
            ci_lower=ci_l,
            ci_upper=ci_u,
            ci_percentage_lower=ci_lp,
            ci_percentage_upper=ci_up,
            is_cold_start=True
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
        weights=fmt_weights,
        is_cold_start=True,
        total_reviews_count=0
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
    Calculates updated rates, pushes history point, applies exponential time decay, and returns updated weights.
    """
    action = payload.action.lower()
    if action not in ["accept", "dismiss", "not_relevant"]:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'accept', 'dismiss', or 'not_relevant'.")

    flag = get_flag_by_id(flag_id)
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")

    repo_id = flag["repo_id"]
    category = flag["category"]

    # 1. Update flag status in DB and log feedback event
    updated_flag = update_flag_status(flag_id, action)
    record_feedback_event(repo_id, flag_id, category, action, payload.reviewer_id)

    # 2. Retrieve current category weight record
    weights = get_repo_weights(repo_id)
    cat_record = next((w for w in weights if w["category"] == category), None)
    prior = COLD_START_PRIORS.get(category, {"alpha": 5.0, "beta": 5.0})

    if cat_record:
        cur_alpha = cat_record["alpha"]
        cur_beta = cat_record["beta"]
        accepts = cat_record["accept_count"]
        dismisses = cat_record["dismiss_count"]
        not_relevant = cat_record["not_relevant_count"]
    else:
        cur_alpha, cur_beta = prior["alpha"], prior["beta"]
        accepts, dismisses, not_relevant = 0, 0, 0

    if action == "accept":
        accepts += 1
    elif action == "dismiss":
        dismisses += 1
    elif action == "not_relevant":
        not_relevant += 1

    # 3. Compute new Bayesian parameters with time decay
    new_alpha, new_beta, new_weight, new_pct = update_bayesian_weight(
        cur_alpha, cur_beta, action,
        prior_alpha=prior["alpha"],
        prior_beta=prior["beta"],
        apply_decay=True,
        decay_factor=TIME_DECAY_FACTOR
    )

    ci_l, ci_u, ci_lp, ci_up = calculate_credible_interval(new_alpha, new_beta)
    is_cold = is_cold_start_category(accepts, dismisses, not_relevant)

    # 4. Save updated weight
    set_category_weight(
        repo_id, category, new_weight, new_pct,
        alpha=new_alpha, beta=new_beta,
        accept_count=accepts,
        dismiss_count=dismisses,
        not_relevant_count=not_relevant,
        ci_lower=ci_l,
        ci_upper=ci_u,
        ci_percentage_lower=ci_lp,
        ci_percentage_upper=ci_up,
        is_cold_start=is_cold
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

    why_shown = generate_why_shown_explanation(
        category=category,
        weight=new_weight,
        percentage=new_pct,
        accept_count=accepts,
        dismiss_count=dismisses,
        severity=flag["severity"],
        is_suppressed=(new_weight < 0.28),
        ci_lower_pct=ci_lp,
        ci_upper_pct=ci_up,
        is_cold_start=is_cold
    )

    # If reviewer_id is provided, update reviewer-specific Bayesian model
    rev_profile = None
    if payload.reviewer_id:
        rev_weights = get_reviewer_weights(payload.reviewer_id)
        r_rec = next((w for w in rev_weights if w["category"] == category), None)
        if r_rec:
            r_alpha = r_rec["alpha"]
            r_beta = r_rec["beta"]
            r_acc = r_rec["accept_count"]
            r_dsm = r_rec["dismiss_count"]
            r_nr = r_rec["not_relevant_count"]
        else:
            r_alpha, r_beta = 5.0, 5.0
            r_acc, r_dsm, r_nr = 0, 0, 0

        if action == "accept":
            r_acc += 1
        elif action == "dismiss":
            r_dsm += 1
        elif action == "not_relevant":
            r_nr += 1

        new_ra, new_rb, new_rw, new_rp = update_bayesian_weight(
            r_alpha, r_beta, action,
            prior_alpha=5.0, prior_beta=5.0,
            apply_decay=True,
            decay_factor=TIME_DECAY_FACTOR
        )
        set_reviewer_weight(
            payload.reviewer_id, repo_id, category,
            new_rw, new_rp, new_ra, new_rb,
            r_acc, r_dsm, r_nr
        )
        all_rev_profs = format_reviewer_profiles(repo_id)
        rev_profile = next((p for p in all_rev_profs if p.id == payload.reviewer_id), None)

    return ActionResponse(
        flag_id=flag_id,
        new_status=action,
        repo_id=repo_id,
        category=category,
        updated_weight=new_weight,
        updated_percentage=new_pct,
        repo_acceptance_rate=new_rate,
        taste_explanation=taste["summary"],
        why_shown=why_shown,
        weights=fmt_weights,
        reviewer_profile=rev_profile
    )


@app.post("/api/repos/{repo_id}/review", response_model=ReviewResponse)
async def review_diff(repo_id: str, payload: ReviewRequest):
    """
    Submits a new code diff for review:
    1. Parses diff hunks
    2. Runs static analysis
    3. Runs LLM refinement if API key exists
    4. Evaluates flags against repo's learned category weights
    5. Saves new review round and returns flags with explainability metadata
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
            demoted=bool(f.get("demoted")),
            suppression_reason=f.get("suppression_reason"),
            diff_patch=f.get("diff_patch"),
            language=f.get("language") or "python",
            repo_weight=f.get("repo_weight", 50),
            why_shown=f.get("why_shown"),
            ci_bounds=f.get("ci_bounds")
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
        ci_l, ci_u, ci_lp, ci_up = calculate_credible_interval(prior["alpha"], prior["beta"])
        set_category_weight(
            repo_id, cat, w, pct,
            alpha=prior["alpha"],
            beta=prior["beta"],
            accept_count=0,
            dismiss_count=0,
            not_relevant_count=0,
            ci_lower=ci_l,
            ci_upper=ci_u,
            ci_percentage_lower=ci_lp,
            ci_percentage_upper=ci_up,
            is_cold_start=True
        )

    # Reset history
    add_history_point(repo_id, 1, 50, 0, 0, 0)
    weights = get_repo_weights(repo_id)
    fmt_weights = format_weights(weights)

    return {"status": "success", "message": f"Repo {repo_id} reset to cold-start defaults", "weights": fmt_weights}


# -----------------------------------------------------------------------------
# Phase 1: Benchmark & Proof Endpoints
# -----------------------------------------------------------------------------

@app.post("/api/benchmark/replay", response_model=BenchmarkSummaryResponse)
def execute_benchmark_replay(payload: Optional[Dict[str, Any]] = None):
    """
    Learning proof benchmark: runs an offline replay comparing the Bayesian
    learned model against a static-weights baseline over 10 rounds.
    """
    repo = (payload or {}).get("repo_name", "api-gateway")
    scenario = (payload or {}).get("scenario", "backend_hardened")
    decay = float((payload or {}).get("decay_factor", TIME_DECAY_FACTOR))
    return run_benchmark_replay(repo_name=repo, scenario=scenario, decay_factor=decay)


# -----------------------------------------------------------------------------
# Phase 1: GitHub App & Webhook Integration Endpoints
# -----------------------------------------------------------------------------

@app.post("/api/github/webhook", response_model=GitHubWebhookResponse)
async def github_webhook_endpoint(
    request: Request,
    x_github_event: Optional[str] = Header(None, alias="X-GitHub-Event"),
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256")
):
    """
    GitHub App & OAuth Webhook receiver.
    Verifies HMAC-SHA256 signature and handles pull_request and reaction/comment events.
    """
    body_bytes = await request.body()
    if not verify_github_signature(body_bytes, x_hub_signature_256):
        raise HTTPException(status_code=401, detail="Invalid HMAC-SHA256 webhook signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_name = x_github_event or payload.get("event") or "pull_request"

    if event_name == "pull_request":
        res = await handle_github_pull_request_event(payload)
        return GitHubWebhookResponse(
            status=res.get("status", "success"),
            event=event_name,
            action_taken=res.get("action", "reviewed"),
            flags_generated=res.get("flags_posted", 0),
            details=f"PR #{res.get('pr_number')} processed. {res.get('flags_posted', 0)} flags posted."
        )
    elif event_name in ["pull_request_review_comment", "reaction"]:
        res = await handle_github_feedback_event(payload, event_name)
        return GitHubWebhookResponse(
            status=res.get("status", "success"),
            event=event_name,
            action_taken=res.get("action", "feedback_recorded"),
            feedback_recorded=res.get("summary"),
            details=res.get("summary")
        )
    else:
        return GitHubWebhookResponse(
            status="ignored",
            event=event_name,
            action_taken="none",
            details=f"Event '{event_name}' not configured for automatic review."
        )


@app.post("/api/github/simulate")
async def simulate_github_event(payload: Dict[str, Any]):
    """
    Simulates a GitHub PR opened or reaction feedback event for local dev and interactive UI testing.
    """
    event_type = payload.get("event_type", "pull_request")
    if event_type == "pull_request":
        res = await handle_github_pull_request_event(payload)
        return res
    else:
        res = await handle_github_feedback_event(payload, event_type)
        return res


@app.get("/api/github/events")
def list_github_events(repo_id: Optional[str] = None, limit: int = 25):
    """
    Retrieves recent GitHub App webhook event executions.
    """
    return get_github_events(repo_id, limit)


# ----------------- ONE-CLICK SUGGESTED FIXES & REVIEWERS (PHASE 2) -----------------

@app.post("/api/flags/{flag_id}/apply-fix", response_model=ApplyFixResponse)
def apply_suggested_fix(flag_id: str, payload: Optional[ApplyFixRequest] = None):
    """
    One-click Apply Fix:
    1. Validates and marks flag as accepted.
    2. Constructs/applies git patch into a dedicated fix branch.
    3. Returns commit sha, branch name, and unified patch details.
    """
    res = apply_fix_flag(flag_id, payload.note if payload else None)
    if not res:
        raise HTTPException(status_code=404, detail="Flag not found")
    return ApplyFixResponse(**res)


@app.get("/api/repos/{repo_id}/reviewers", response_model=List[ReviewerProfile])
def get_repository_reviewers(repo_id: str):
    """Retrieves all teammate reviewer profiles and their personalized category weights"""
    repo = get_repo_by_id(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return format_reviewer_profiles(repo_id)


@app.get("/api/repos/{repo_id}/reviewers/{reviewer_id}", response_model=ReviewerProfile)
def get_single_reviewer(repo_id: str, reviewer_id: str):
    """Retrieves an individual reviewer's learned profile"""
    profs = format_reviewer_profiles(repo_id)
    prof = next((p for p in profs if p.id == reviewer_id), None)
    if not prof:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    return prof


# ----------------- PHASE 3: PRODUCT POLISH & RECRUITER DEMO -----------------
from datetime import datetime

from fastapi.responses import Response
from app.models import RepoCompareResponse, CategoryComparisonItem, DemoConvergenceResponse
from app.seed_data import seed_demo_divergence


@app.get("/api/repos/{repo_id}/export/csv")
def export_repo_learning_csv(repo_id: str):
    """
    Generates and downloads an executive CSV learning report for a repository.
    Includes round-by-round acceptance history, Bayesian category weights, and precision metrics.
    """
    repo = get_repo_by_id(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    history = get_repo_history(repo_id)
    weights = get_repo_weights(repo_id)

    lines = [
        f"# Sentry Learning & Taste Audit Report: {repo['name']}",
        f"# Generated at: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%SZ')}",
        f"# Repository ID: {repo_id}",
        "",
        "--- SECTION 1: ROUND-BY-ROUND LEARNING CONVERGENCE ---",
        "Round Number,Acceptance Rate (%),Total Flags,Accepted Flags,Dismissed Flags,Created At"
    ]

    for h in history:
        lines.append(f"{h['round_number']},{h['acceptance_rate']},{h['total_flags']},{h['accepted_flags']},{h['dismissed_flags']},{h['created_at']}")

    lines.extend([
        "",
        "--- SECTION 2: BAYESIAN CATEGORY TASTE BREAKDOWN ---",
        "Category,Weight (%),Alpha (Priors),Beta (Priors),Accept Count,Dismiss Count,90% CI Lower,90% CI Upper,Status"
    ])

    for w in weights:
        pct = w["percentage"]
        ci_l = w.get("ci_percentage_lower", max(0, pct - 15))
        ci_u = w.get("ci_percentage_upper", min(100, pct + 15))
        status = "Cold-Start" if w.get("is_cold_start") else ("Demoted" if w.get("suppressed") else "Active")
        lines.append(f"{w['category'].capitalize()},{pct}%,{w['alpha']},{w['beta']},{w['accept_count']},{w['dismiss_count']},{ci_l}%,{ci_u}%,{status}")

    csv_content = "\n".join(lines)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=sentry-learning-{repo_id}.csv",
            "Cache-Control": "no-cache"
        }
    )


@app.get("/api/repos/{repo_id}/compare/{target_repo_id}", response_model=RepoCompareResponse)
def compare_repositories(repo_id: str, target_repo_id: str):
    """
    Computes side-by-side Bayesian taste divergence between two repositories.
    Calculates normalized divergence score and plain-English differences.
    """
    r1 = get_repo_by_id(repo_id)
    r2 = get_repo_by_id(target_repo_id)
    if not r1 or not r2:
        raise HTTPException(status_code=404, detail="One or both repositories not found")

    w1 = {w["category"]: w["percentage"] for w in get_repo_weights(repo_id)}
    w2 = {w["category"]: w["percentage"] for w in get_repo_weights(target_repo_id)}

    all_cats = sorted(list(set(list(w1.keys()) + list(w2.keys()))))
    category_items = []
    total_delta = 0

    for cat in all_cats:
        p1 = w1.get(cat, 50)
        p2 = w2.get(cat, 50)
        diff = p1 - p2
        total_delta += abs(diff)
        favored = r1["name"] if diff > 0 else (r2["name"] if diff < 0 else "Equal")
        category_items.append(CategoryComparisonItem(
            category=cat.capitalize(),
            source_percentage=p1,
            target_percentage=p2,
            difference=abs(diff),
            favored_by=favored
        ))

    # Normalized divergence score 0-100%
    divergence_score = min(100, int((total_delta / (len(all_cats) * 100)) * 100 * 2))

    top1 = max(w1.items(), key=lambda x: x[1])[0] if w1 else "General"
    top2 = max(w2.items(), key=lambda x: x[1])[0] if w2 else "General"

    # Generate plain-English bullets
    key_diffs = []
    # Find most diverging categories
    sorted_diffs = sorted(category_items, key=lambda x: x.difference, reverse=True)
    for item in sorted_diffs[:3]:
        if item.difference >= 15:
            key_diffs.append(
                f"{item.favored_by} strongly favors {item.category} ({item.difference}% higher taste weighting)."
            )
    if not key_diffs:
        key_diffs.append("Both repositories currently share aligned baseline priorities.")

    return RepoCompareResponse(
        source_repo_id=repo_id,
        source_repo_name=r1["name"],
        target_repo_id=target_repo_id,
        target_repo_name=r2["name"],
        divergence_score=divergence_score,
        source_top_category=top1.capitalize(),
        target_top_category=top2.capitalize(),
        key_differences=key_diffs,
        categories=category_items
    )


@app.post("/api/demo/reset-divergence", response_model=DemoConvergenceResponse)
def trigger_demo_divergence():
    """
    Initializes or resets the two recruiter showcase demo repositories:
    1. 'fintech-core' (Hardened Backend)
    2. 'web-design-system' (UI / Style System)
    """
    seeded = seed_demo_divergence()
    return DemoConvergenceResponse(
        status="success",
        message="Demo showcase repositories initialized with contrasting Bayesian profiles.",
        repos_seeded=seeded
    )
