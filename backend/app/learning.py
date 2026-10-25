"""
Learning engine for Sentry: Bayesian Beta-Binomial weight model with cold-start priors,
real-time updates on accept/dismiss actions, and natural-language taste explanations.
"""
from typing import Dict, Any, List, Tuple

# Cold-start priors: Alpha (pseudo-accepts) and Beta (pseudo-dismisses)
# Gives explainable default weights before any human feedback is provided.
COLD_START_PRIORS: Dict[str, Dict[str, float]] = {
    "security": {
        "alpha": 8.0,
        "beta": 2.0,
        "description": "Baseline assumption: Security vulnerabilities are critical to catch."
    },
    "best-practice": {
        "alpha": 6.0,
        "beta": 4.0,
        "description": "Baseline assumption: Idiomatic practices and resource cleanup matter."
    },
    "complexity": {
        "alpha": 5.0,
        "beta": 5.0,
        "description": "Baseline assumption: Neutral stance on cyclomatic complexity until team sets preference."
    },
    "duplication": {
        "alpha": 4.0,
        "beta": 6.0,
        "description": "Baseline assumption: Moderate tolerance for localized duplication."
    },
    "style": {
        "alpha": 3.0,
        "beta": 7.0,
        "description": "Baseline assumption: Style is often handled by linters/formatters, lower starting priority."
    }
}

# Suppression threshold: if weight falls below this and severity is not critical, flag is suppressed
SUPPRESSION_THRESHOLD = 0.28


import math

# Cold-start threshold: below 5 feedback events on a category/repo, it is considered cold-start
COLD_START_MIN_FEEDBACK = 5

# Default time decay factor applied to accumulated evidence during feedback steps (recent feedback matters more)
TIME_DECAY_FACTOR = 0.96


def calculate_weight(alpha: float, beta: float) -> Tuple[float, int]:
    """
    Computes posterior mean weight in [0, 1] and percentage [0, 100].
    Mean = alpha / (alpha + beta)
    """
    total = alpha + beta
    if total <= 0:
        return 0.5, 50
    weight = alpha / total
    # Bound between 0.05 and 0.98 for realistic variance
    weight = max(0.05, min(0.98, weight))
    percentage = int(round(weight * 100))
    return round(weight, 3), percentage


def calculate_credible_interval(alpha: float, beta: float, confidence_level: float = 0.90) -> Tuple[float, float, int, int]:
    """
    Computes Bayesian Credible Interval for Beta(alpha, beta).
    Uses Beta distribution variance: Var = (alpha * beta) / ((alpha + beta)^2 * (alpha + beta + 1))
    For 90% CI: z = 1.645; for 95% CI: z = 1.96.
    Returns (lower_bound, upper_bound, lower_pct, upper_pct).
    """
    total = alpha + beta
    if total <= 0:
        return 0.1, 0.9, 10, 90

    mean = alpha / total
    variance = (alpha * beta) / ((total ** 2) * (total + 1))
    std_dev = math.sqrt(max(1e-6, variance))

    # Z-multiplier for chosen confidence level
    z = 1.96 if confidence_level >= 0.95 else 1.645
    margin = z * std_dev

    lower = max(0.02, min(0.95, mean - margin))
    upper = max(lower + 0.02, min(0.98, mean + margin))

    lower_pct = int(round(lower * 100))
    upper_pct = int(round(upper * 100))

    return round(lower, 3), round(upper, 3), lower_pct, upper_pct


def is_cold_start_category(accept_count: int, dismiss_count: int, not_relevant_count: int = 0) -> bool:
    """Returns True if feedback volume is below cold start threshold"""
    return (accept_count + dismiss_count + not_relevant_count) < COLD_START_MIN_FEEDBACK


def get_color_token(category: str) -> str:
    """Return visual color token consistent with design.html"""
    mapping = {
        "security": "accent",      # Purple (#A855F7)
        "complexity": "primary",   # Green (#3DFF6B)
        "best-practice": "accent", # Purple/Cyan
        "duplication": "muted",    # Gray (#888)
        "style": "dark-muted",     # Darker Gray (#555)
    }
    return mapping.get(category.lower(), "muted")


def update_bayesian_weight(
    current_alpha: float,
    current_beta: float,
    action: str,
    prior_alpha: float = 5.0,
    prior_beta: float = 5.0,
    apply_decay: bool = True,
    decay_factor: float = TIME_DECAY_FACTOR
) -> Tuple[float, float, float, int]:
    """
    Updates Beta distribution parameters with optional time decay:
    - 'accept': adds weight to alpha (evidence that team cares about this issue)
    - 'dismiss': adds weight to beta (evidence that team considers this noise)
    - 'not_relevant': adds heavier weight to beta (+1.5, strong noise signal)

    Time decay: Decays existing accumulated empirical evidence (alpha - prior_alpha)
    by decay_factor before adding new feedback, ensuring recent team actions weigh more.
    """
    if apply_decay:
        # Separate empirical evidence from baseline prior
        empirical_alpha = max(0.0, current_alpha - prior_alpha)
        empirical_beta = max(0.0, current_beta - prior_beta)

        # Decay previous empirical feedback
        decayed_alpha = empirical_alpha * decay_factor
        decayed_beta = empirical_beta * decay_factor

        alpha = prior_alpha + decayed_alpha
        beta = prior_beta + decayed_beta
    else:
        alpha = current_alpha
        beta = current_beta

    if action == "accept":
        alpha += 1.0
    elif action == "dismiss":
        beta += 1.0
    elif action == "not_relevant":
        beta += 1.5
    else:
        beta += 0.5

    weight, percentage = calculate_weight(alpha, beta)
    return round(alpha, 3), round(beta, 3), weight, percentage


def should_suppress_flag(category_weight: float, severity: str) -> bool:
    """
    Suppresses flags when repo weight has dropped below threshold,
    unless the issue has 'critical' severity.
    """
    if severity == "critical":
        return False
    return category_weight < SUPPRESSION_THRESHOLD


def generate_why_shown_explanation(
    category: str,
    weight: float,
    percentage: int,
    accept_count: int,
    dismiss_count: int,
    severity: str,
    is_suppressed: bool,
    ci_lower_pct: int = 0,
    ci_upper_pct: int = 100,
    is_cold_start: bool = False
) -> str:
    """
    Generates 'Why was this shown?' transparency explainer.
    Example: 'Security weight 0.88 for this repo, accepted 14 of 16 similar flags'
    """
    cat_title = category.capitalize()
    total_reviewed = accept_count + dismiss_count

    if severity == "critical":
        if is_suppressed:
            return (
                f"Critical override: {cat_title} weight is {percentage}% (below threshold), "
                f"but critical security/reliability defects are always surfaced."
            )
        return (
            f"High priority: {cat_title} weight {weight:.2f} ({percentage}%), "
            f"accepted {accept_count} of {total_reviewed or 1} similar flags."
        )

    if is_cold_start:
        return (
            f"Cold-start calibration: {cat_title} initialized with Bayesian prior ({percentage}%, 90% CI: [{ci_lower_pct}%-{ci_upper_pct}%]). "
            f"Team has {accept_count} accepts on record."
        )

    if is_suppressed:
        return (
            f"Suppressed: {cat_title} weight {weight:.2f} ({percentage}%) fell below "
            f"{int(SUPPRESSION_THRESHOLD * 100)}% suppression threshold after {dismiss_count} dismissals."
        )

    accept_rate = int(round((accept_count / total_reviewed) * 100)) if total_reviewed > 0 else percentage
    return (
        f"{cat_title} weight {weight:.2f} for this repo (90% CI: [{ci_lower_pct}%-{ci_upper_pct}%]), "
        f"accepted {accept_count} of {total_reviewed} similar flags ({accept_rate}% accept rate)."
    )


def generate_taste_explanation(repo_name: str, weights_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generates plain-English 'Explain My Taste' synthesis based on current weights and statistics.
    Directly addresses user requirement: 'Explain my taste — ask the agent what it's learned
    about this repo so far, answered in plain English from current weights.'
    """
    sorted_weights = sorted(weights_data, key=lambda x: x["weight"], reverse=True)
    
    high_priority = [w for w in sorted_weights if w["weight"] >= 0.60]
    moderate_priority = [w for w in sorted_weights if 0.35 <= w["weight"] < 0.60]
    suppressed = [w for w in sorted_weights if w["weight"] < 0.35]

    high_names = [w["category"].capitalize() for w in high_priority]
    suppressed_names = [w["category"].capitalize() for w in suppressed]

    # Generate crisp headline
    if high_names and "Security" in high_names and "Complexity" in high_names:
        headline = "Hardened Backend Profile: High Security & Logic Vigilance"
    elif high_names and "Style" in high_names and "Duplication" in high_names:
        headline = "Design System & UI Profile: Strict Consistency & DRY Standards"
    elif high_names:
        headline = f"Focused Engineering Profile: Prioritizing {', '.join(high_names)}"
    else:
        headline = "Balanced Exploratory Profile: Calibrating to Team Feedback"

    # Generate detailed summary paragraph
    if high_names and suppressed_names:
        summary = (
            f"This repo has learned to prioritize {', '.join(high_names).lower()} issues, "
            f"while {', '.join(suppressed_names).lower()} nits are actively suppressed as noise. "
            f"The team demonstrates clear intolerance for architectural and security defects, "
            f"preferring automated linters or pre-commit hooks to handle surface-level formatting."
        )
    elif high_names:
        summary = (
            f"This repo exhibits strong consensus around {', '.join(high_names).lower()}. "
            f"Flags in these categories receive near-unanimous acceptance, signaling high impact on production safety."
        )
    else:
        summary = (
            f"Sentry is operating with baseline cold-start heuristics for {repo_name}. "
            f"As team members accept or dismiss inline flags, category priorities will dynamically adapt."
        )

    # Detailed recommendations
    recommendations = []
    for w in sorted_weights:
        cat = w["category"]
        pct = w["percentage"]
        acc = w.get("accept_count", 0)
        dsm = w.get("dismiss_count", 0)
        
        if pct >= 75:
            recommendations.append(
                f"High Confidence: {cat.capitalize()} ({pct}%) has {acc} accepts. Sentry surfaces all alerts and proposes automated patch diffs."
            )
        elif pct <= 30:
            recommendations.append(
                f"Suppression Active: {cat.capitalize()} ({pct}%) has {dsm} dismissals. Non-critical warnings are filtered out to keep PR reviews noise-free."
            )

    return {
        "repo_name": repo_name,
        "headline": headline,
        "summary": summary,
        "priorities": high_names,
        "suppressed": suppressed_names,
        "confidence_level": "High (Data-backed)" if sum(w.get("accept_count", 0) + w.get("dismiss_count", 0) for w in weights_data) > 10 else "Cold Start Calibration",
        "category_breakdown": [
            {
                "category": w["category"],
                "percentage": w["percentage"],
                "weight": w["weight"],
                "accepts": w.get("accept_count", 0),
                "dismisses": w.get("dismiss_count", 0),
                "is_suppressed": w["weight"] < SUPPRESSION_THRESHOLD,
                "ci_lower": w.get("ci_percentage_lower", 0),
                "ci_upper": w.get("ci_percentage_upper", 100),
                "is_cold_start": is_cold_start_category(w.get("accept_count", 0), w.get("dismiss_count", 0))
            }
            for w in sorted_weights
        ],
        "recommendations": recommendations
    }
