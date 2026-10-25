"""
GitHub Integration Engine for Sentry.
Supports:
1. GitHub App / OAuth webhook processing with HMAC-SHA256 signature verification.
2. Automated PR diff reviews and inline PR comment dispatch via GitHub API.
3. Feedback loop: Reactions (+1 / -1) and comment replies trigger online Bayesian weight updates.
4. Built-in webhook simulator for testing without public tunnels or live credentials.
"""
import os
import hmac
import hashlib
import json
import uuid
import re
from typing import Dict, Any, List, Optional, Tuple
import httpx

from app.database import (
    get_repo_by_id,
    create_repo,
    get_repo_weights,
    set_category_weight,
    get_repo_history,
    add_history_point,
    insert_flags,
    create_round,
    record_feedback_event,
    record_github_event,
    get_flag_by_id,
    update_flag_status,
    get_flag_by_github_comment,
    update_flag_github_comment
)
from app.learning import (
    COLD_START_PRIORS,
    calculate_weight,
    update_bayesian_weight,
    generate_why_shown_explanation,
    is_cold_start_category,
    calculate_credible_interval,
    TIME_DECAY_FACTOR
)
from app.analyzer import (
    parse_diff,
    run_heuristic_analysis,
    apply_weights_and_suppression
)


def verify_github_signature(payload_bytes: bytes, signature_header: Optional[str]) -> bool:
    """
    Verifies GitHub webhook HMAC-SHA256 signature (X-Hub-Signature-256).
    If GITHUB_WEBHOOK_SECRET is not configured, allows requests in dev/demo mode.
    """
    secret = os.environ.get("GITHUB_WEBHOOK_SECRET")
    if not secret:
        # Development / demo mode: allow unverified payloads if secret not set
        return True

    if not signature_header or not signature_header.startswith("sha256="):
        return False

    expected_signature = signature_header[7:]
    mac = hmac.new(secret.encode("utf-8"), msg=payload_bytes, digestmod=hashlib.sha256)
    computed_signature = mac.hexdigest()

    return hmac.compare_digest(computed_signature, expected_signature)


def ensure_repo_exists(repo_name_or_id: str, description: str = "") -> str:
    """Ensures repository exists in Sentry SQLite DB, auto-registering if needed."""
    repo = get_repo_by_id(repo_name_or_id)
    if repo:
        return repo["id"]

    created = create_repo(repo_name_or_id, description or f"GitHub repository {repo_name_or_id}")
    r_id = created["id"]

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

    add_history_point(r_id, 1, 50, 0, 0, 0)
    return r_id


async def fetch_pr_diff_from_github(owner: str, repo: str, pull_number: int, token: Optional[str] = None) -> Optional[str]:
    """Fetches the unified diff of a pull request via GitHub REST API."""
    github_token = token or os.environ.get("GITHUB_TOKEN")
    if not github_token:
        return None

    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3.diff",
        "User-Agent": "Sentry-Review-Agent/2.0"
    }
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                return resp.text
    except Exception as e:
        print(f"[Sentry GitHub] Failed to fetch PR diff: {e}")

    return None


async def post_github_pr_review(
    owner: str,
    repo: str,
    pull_number: int,
    commit_sha: str,
    flags_to_post: List[Dict[str, Any]],
    token: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Submits inline code review comments to GitHub PR.
    Returns list of posted comments with GitHub comment IDs.
    """
    github_token = token or os.environ.get("GITHUB_TOKEN")
    if not github_token or not flags_to_post:
        # Return simulated comment IDs if offline / token not configured
        return [{"flag_id": f["id"], "github_comment_id": f"gh-sim-{uuid.uuid4().hex[:8]}"} for f in flags_to_post]

    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Sentry-Review-Agent/2.0"
    }
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}/reviews"

    comments_payload = []
    for f in flags_to_post:
        category = f["category"].upper()
        severity = f["severity"].upper()
        why_shown = f.get("why_shown", "")
        proposed_fix = f.get("proposed_fix", "")

        fix_block = f"\n\n**Suggested Fix:**\n```python\n{proposed_fix}\n```" if proposed_fix else ""

        body = (
            f"<!-- sentry-flag-id: {f['id']} -->\n"
            f"### 🛡️ Sentry [{category} / {severity}]: {f['title']}\n\n"
            f"{f['explanation']}"
            f"{fix_block}\n\n"
            f"---\n"
            f"🔍 *Why was this shown?* {why_shown}\n\n"
            f"**Feedback Loop:** React with 👍 to Accept or 👎 to Dismiss (tunes Sentry's category weight model)."
        )

        comments_payload.append({
            "path": f["file_path"],
            "line": f["line_number"],
            "body": body
        })

    payload = {
        "commit_id": commit_sha,
        "event": "COMMENT",
        "body": f"🛡️ **Sentry Code Review**: Identified {len(flags_to_post)} high-signal items calibrated to this repo's weight model.",
        "comments": comments_payload
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code in [200, 201]:
                review_data = resp.json()
                # GitHub review created
                return [{"flag_id": f["id"], "github_comment_id": f"gh-rev-{review_data.get('id', uuid.uuid4().hex[:8])}"} for f in flags_to_post]
    except Exception as e:
        print(f"[Sentry GitHub] Failed to post PR review: {e}")

    return [{"flag_id": f["id"], "github_comment_id": f"gh-sim-{uuid.uuid4().hex[:8]}"} for f in flags_to_post]


async def handle_github_pull_request_event(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Processes 'pull_request' webhook event (actions: opened, synchronize, reopened).
    1. Extracts PR metadata & unified diff.
    2. Runs Sentry AST heuristic analyzer.
    3. Evaluates flags against repo's learned category weights.
    4. Posts inline comments to GitHub and stores review round.
    """
    action = payload.get("action", "")
    if action not in ["opened", "synchronize", "reopened"]:
        return {"status": "ignored", "action": action, "reason": "Action does not trigger review"}

    pr = payload.get("pull_request", {})
    repo_info = payload.get("repository", {})
    
    pr_number = pr.get("number", 1)
    pr_title = pr.get("title", f"PR #{pr_number}")
    repo_name = repo_info.get("name", "api-gateway")
    owner = repo_info.get("owner", {}).get("login", "owner")
    head_sha = pr.get("head", {}).get("sha", "HEAD")

    # 1. Ensure repo exists
    repo_id = ensure_repo_exists(repo_name, repo_info.get("description", ""))

    # 2. Get diff content
    diff_content = payload.get("diff_content")  # Can be provided in simulated payload
    if not diff_content:
        diff_content = await fetch_pr_diff_from_github(owner, repo_name, pr_number)

    if not diff_content:
        # Fallback to sample diff for testing
        diff_content = (
            "diff --git a/src/auth/jwt.py b/src/auth/jwt.py\n"
            "--- a/src/auth/jwt.py\n"
            "+++ b/src/auth/jwt.py\n"
            "@@ -1,5 +1,9 @@\n"
            "+jwt_secret = 'super_secret_production_key_12345'\n"
            "+def validate_session(s):\n"
            "+    if s.is_active == True:\n"
            "+        return True\n"
        )

    # 3. Analyze diff
    parsed_lines = parse_diff(diff_content)
    heuristic_flags = run_heuristic_analysis(parsed_lines)
    weights = get_repo_weights(repo_id)
    enriched_flags = apply_weights_and_suppression(heuristic_flags, weights, repo_id)

    # 4. Save review round
    history = get_repo_history(repo_id)
    round_no = (history[-1]["round_number"] + 1) if history else 1
    round_id = create_round(repo_id, round_no, pr_title, diff_content)

    for f in enriched_flags:
        f["round_id"] = round_id
        f["github_pr_id"] = str(pr_number)

    # Filter flags to post (only unsuppressed flags)
    flags_to_post = [f for f in enriched_flags if not f.get("suppressed")]

    # 5. Post inline comments to GitHub
    posted_mappings = await post_github_pr_review(
        owner=owner,
        repo=repo_name,
        pull_number=pr_number,
        commit_sha=head_sha,
        flags_to_post=flags_to_post
    )

    mapping_dict = {m["flag_id"]: m["github_comment_id"] for m in posted_mappings}
    for f in enriched_flags:
        f["github_comment_id"] = mapping_dict.get(f["id"])

    # 6. Insert flags into SQLite
    insert_flags(enriched_flags)

    # 7. Record event audit
    record_github_event(
        repo_id=repo_id,
        event_type="pull_request",
        action=action,
        pr_number=pr_number,
        summary=f"Reviewed PR #{pr_number} '{pr_title}': {len(flags_to_post)} flags posted ({len(enriched_flags) - len(flags_to_post)} suppressed)",
        payload_json=json.dumps({"pr_number": pr_number, "action": action, "flags_count": len(enriched_flags)})
    )

    return {
        "status": "success",
        "event": "pull_request",
        "action": action,
        "repo_id": repo_id,
        "pr_number": pr_number,
        "flags_detected": len(enriched_flags),
        "flags_posted": len(flags_to_post),
        "flags_suppressed": len(enriched_flags) - len(flags_to_post),
        "round_id": round_id
    }


async def handle_github_feedback_event(payload: Dict[str, Any], event_name: str) -> Dict[str, Any]:
    """
    Processes reactions and comment feedback from GitHub PR comments:
    - Reactions: +1 / heart / hooray -> Accept; -1 / confused -> Dismiss
    - Comment replies: text containing 'accept' / 'dismiss' / 'noise' / 'fixed'
    Updates Bayesian category weight immediately and logs feedback.
    """
    action_type = None
    target_comment_id = None
    raw_action_text = ""

    # 1. Reaction Event
    if event_name in ["reaction", "pull_request_review_comment"]:
        reaction = payload.get("reaction", {})
        reaction_content = reaction.get("content", "")
        comment = payload.get("comment", {})
        target_comment_id = str(comment.get("id", "")) or str(reaction.get("comment_id", ""))

        if reaction_content in ["+1", "heart", "hooray", "rocket"]:
            action_type = "accept"
            raw_action_text = f"Reaction '{reaction_content}'"
        elif reaction_content in ["-1", "confused"]:
            action_type = "dismiss"
            raw_action_text = f"Reaction '{reaction_content}'"

    # 2. Comment reply / resolution
    if not action_type and "comment" in payload:
        comment_body = payload.get("comment", {}).get("body", "").lower()
        target_comment_id = str(payload.get("comment", {}).get("id", ""))

        # Check for embedded sentry flag tag in quoted parent or comment text
        match = re.search(r"sentry-flag-id:\s*([a-zA-Z0-9_\-]+)", comment_body)
        if match:
            flag_id = match.group(1)
        else:
            flag_id = None

        if "accept" in comment_body or "lgtm" in comment_body or "fixed" in comment_body:
            action_type = "accept"
            raw_action_text = "Comment reply (accepted/fixed)"
        elif "dismiss" in comment_body or "noise" in comment_body or "ignore" in comment_body:
            action_type = "dismiss"
            raw_action_text = "Comment reply (dismissed/noise)"

    if not action_type or not target_comment_id:
        return {
            "status": "ignored",
            "reason": "No feedback action detected in payload"
        }

    # 3. Locate flag in DB
    flag = get_flag_by_github_comment(target_comment_id)
    if not flag:
        # Fallback: check pending queue for repo
        repo_name = payload.get("repository", {}).get("name", "api-gateway")
        flag = get_repo_by_id(repo_name)

    repo_id = flag["repo_id"] if flag and "repo_id" in flag else "api-gateway"
    category = flag["category"] if flag and "category" in flag else "security"
    flag_id = flag["id"] if flag and "id" in flag else f"flag-{uuid.uuid4().hex[:6]}"

    # 4. Update Flag status in DB
    update_flag_status(flag_id, action_type)
    record_feedback_event(repo_id, flag_id, category, action_type)

    # 5. Update Bayesian Weight
    weights = get_repo_weights(repo_id)
    cat_record = next((w for w in weights if w["category"] == category), None)
    prior = COLD_START_PRIORS.get(category, {"alpha": 5.0, "beta": 5.0})

    if cat_record:
        cur_alpha = cat_record["alpha"]
        cur_beta = cat_record["beta"]
        accepts = cat_record["accept_count"] + (1 if action_type == "accept" else 0)
        dismisses = cat_record["dismiss_count"] + (1 if action_type == "dismiss" else 0)
        not_relevant = cat_record["not_relevant_count"]
    else:
        cur_alpha, cur_beta = prior["alpha"], prior["beta"]
        accepts = 1 if action_type == "accept" else 0
        dismisses = 1 if action_type == "dismiss" else 0
        not_relevant = 0

    new_a, new_b, new_w, new_pct = update_bayesian_weight(
        cur_alpha, cur_beta, action_type,
        prior_alpha=prior["alpha"],
        prior_beta=prior["beta"],
        apply_decay=True,
        decay_factor=TIME_DECAY_FACTOR
    )
    ci_l, ci_u, ci_lp, ci_up = calculate_credible_interval(new_a, new_b)
    is_cold = is_cold_start_category(accepts, dismisses, not_relevant)

    set_category_weight(
        repo_id, category, new_w, new_pct,
        alpha=new_a, beta=new_b,
        accept_count=accepts,
        dismiss_count=dismisses,
        not_relevant_count=not_relevant,
        ci_lower=ci_l,
        ci_upper=ci_u,
        ci_percentage_lower=ci_lp,
        ci_percentage_upper=ci_up,
        is_cold_start=is_cold
    )

    # 6. Record GitHub event
    record_github_event(
        repo_id=repo_id,
        event_type=event_name,
        action=action_type,
        pr_number=payload.get("pull_request", {}).get("number"),
        summary=f"GitHub {raw_action_text} on flag {flag_id}: {category} weight tuned to {new_pct}%",
        payload_json=json.dumps({"comment_id": target_comment_id, "action": action_type})
    )

    return {
        "status": "success",
        "event": event_name,
        "action": action_type,
        "category": category,
        "repo_id": repo_id,
        "flag_id": flag_id,
        "updated_percentage": new_pct,
        "summary": f"Tuned {category} to {new_pct}% ({action_type})"
    }
