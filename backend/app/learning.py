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
    action: str
) -> Tuple[float, float, float, int]:
    """
    Updates the Beta distribution parameters based on user action:
    - 'accept': adds weight to alpha (evidence that team cares about this issue)
    - 'dismiss': adds weight to beta (evidence that team considers this noise)
    - 'not_relevant': adds heavier weight to beta (+1.5, strong noise signal)
    """
    alpha = current_alpha
    beta = current_beta

    if action == "accept":
        alpha += 1.0
    elif action == "dismiss":
        beta += 1.0
    elif action == "not_relevant":
        beta += 1.5
    else:
        # Fallback
        beta += 0.5

    weight, percentage = calculate_weight(alpha, beta)
    return alpha, beta, weight, percentage


def should_suppress_flag(category_weight: float, severity: str) -> bool:
    """
    Suppresses flags when repo weight has dropped below threshold,
    unless the issue has 'critical' severity.
    """
    if severity == "critical":
        return False
    return category_weight < SUPPRESSION_THRESHOLD


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
                "is_suppressed": w["weight"] < SUPPRESSION_THRESHOLD
            }
            for w in sorted_weights
        ],
        "recommendations": recommendations
    }
