"""
Seeds database with two distinct demo repos (api-gateway and design-system)
plus a cold-start repo (payment-service) to demonstrate adaptive learning.
"""
from app.database import (
    get_connection,
    create_repo,
    set_category_weight,
    add_history_point,
    insert_flags,
    create_round
)
from app.learning import calculate_weight


def seed_database_if_empty():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM repos")
    count = cursor.fetchone()["count"]
    conn.close()

    if count > 0:
        return

    # ==========================================
    # 1. REPO 1: api-gateway (Backend / Security Focused)
    # ==========================================
    r1 = create_repo("api-gateway", "High-throughput API gateway handling authentication & microservice routing.")
    r1_id = r1["id"]

    # Category Weights matching design.html:
    # Security: 88%, Complexity: 64%, Duplication: 41%, Style: 22%, Best-Practice: 58%
    set_category_weight(r1_id, "security", 0.88, 88, alpha=22.0, beta=3.0, accept_count=22, dismiss_count=3, not_relevant_count=0)
    set_category_weight(r1_id, "complexity", 0.64, 64, alpha=16.0, beta=9.0, accept_count=16, dismiss_count=9, not_relevant_count=0)
    set_category_weight(r1_id, "best-practice", 0.58, 58, alpha=14.0, beta=10.0, accept_count=14, dismiss_count=10, not_relevant_count=0)
    set_category_weight(r1_id, "duplication", 0.41, 41, alpha=9.0, beta=13.0, accept_count=9, dismiss_count=13, not_relevant_count=1)
    set_category_weight(r1_id, "style", 0.22, 22, alpha=4.0, beta=14.0, accept_count=4, dismiss_count=14, not_relevant_count=2)

    # Historical rounds showing upward learning curve: 42% -> 78%
    history_api = [
        (1, 44, 25, 11, 14),
        (2, 50, 22, 11, 11),
        (3, 58, 24, 14, 10),
        (4, 65, 20, 13, 7),
        (5, 71, 21, 15, 6),
        (6, 74, 19, 14, 5),
        (7, 76, 21, 16, 5),
        (8, 78, 23, 18, 5),
    ]
    for r_num, rate, total, acc, dsm in history_api:
        add_history_point(r1_id, r_num, rate, total, acc, dsm)

    # Active review queue matching design.html items exactly
    round_id1 = create_round(r1_id, 9, "PR #342: Refactor session authentication and route validation", "")
    flags_api = [
        {
            "id": "flag-api-1",
            "repo_id": r1_id,
            "round_id": round_id1,
            "file_path": "src/auth/session.py",
            "line_number": 3,
            "category": "security",
            "severity": "critical",
            "title": "Hardcoded secret key in session.py",
            "explanation": "Hardcoded session signing secret detected in source file. In production, this allows attackers to forge administrative authentication tokens.",
            "proposed_fix": "import os\nSECRET_KEY = os.environ.get('APP_SESSION_SECRET') or secrets.token_hex(32)",
            "status": "pending",
            "confidence": 0.99,
            "suppressed": False
        },
        {
            "id": "flag-api-2",
            "repo_id": r1_id,
            "round_id": round_id1,
            "file_path": "src/utils/validate.py",
            "line_number": 6,
            "category": "complexity",
            "severity": "warning",
            "title": "Redundant boolean condition",
            "explanation": "Condition `if is_authenticated == True:` adds unnecessary syntax complexity. Use direct truthiness `if is_authenticated:`.",
            "proposed_fix": "if is_authenticated and not user.is_suspended:\n    return True",
            "status": "pending",
            "confidence": 0.94,
            "suppressed": False
        },
        {
            "id": "flag-api-3",
            "repo_id": r1_id,
            "round_id": round_id1,
            "file_path": "src/utils/validate.py",
            "line_number": 12,
            "category": "style",
            "severity": "nit",
            "title": "Ambiguous function name",
            "explanation": "Single-letter or ambiguous function signature `def fn(d):` does not declare operational intent. Rename to `validate_route_payload`.",
            "proposed_fix": "def validate_route_payload(payload: dict) -> bool:",
            "status": "pending",
            "confidence": 0.88,
            "suppressed": False
        },
        {
            "id": "flag-api-4",
            "repo_id": r1_id,
            "round_id": round_id1,
            "file_path": "src/routes/proxy.py",
            "line_number": 28,
            "category": "best-practice",
            "severity": "warning",
            "title": "Unclosed HTTP client connection session",
            "explanation": "HTTP client initialized without async context manager. This can leak sockets under high concurrency.",
            "proposed_fix": "async with httpx.AsyncClient() as client:\n    response = await client.get(upstream_url)",
            "status": "pending",
            "confidence": 0.91,
            "suppressed": False
        }
    ]
    insert_flags(flags_api)

    # ==========================================
    # 2. REPO 2: design-system (Frontend / Style & DRY Focused)
    # ==========================================
    r2 = create_repo("design-system", "Shared React component library and token system for web applications.")
    r2_id = r2["id"]

    # Category Weights inverted profile:
    # Style: 91%, Duplication: 82%, Best-Practice: 75%, Complexity: 38%, Security: 50%
    set_category_weight(r2_id, "style", 0.91, 91, alpha=29.0, beta=3.0, accept_count=29, dismiss_count=3, not_relevant_count=0)
    set_category_weight(r2_id, "duplication", 0.82, 82, alpha=23.0, beta=5.0, accept_count=23, dismiss_count=5, not_relevant_count=0)
    set_category_weight(r2_id, "best-practice", 0.75, 75, alpha=18.0, beta=6.0, accept_count=18, dismiss_count=6, not_relevant_count=0)
    set_category_weight(r2_id, "security", 0.50, 50, alpha=10.0, beta=10.0, accept_count=10, dismiss_count=10, not_relevant_count=0)
    set_category_weight(r2_id, "complexity", 0.38, 38, alpha=8.0, beta=13.0, accept_count=8, dismiss_count=13, not_relevant_count=1)

    # Historical rounds showing upward learning curve: 38% -> 86%
    history_ds = [
        (1, 38, 20, 8, 12),
        (2, 49, 18, 9, 9),
        (3, 61, 21, 13, 8),
        (4, 70, 23, 16, 7),
        (5, 77, 22, 17, 5),
        (6, 84, 19, 16, 3),
        (7, 86, 21, 18, 3),
    ]
    for r_num, rate, total, acc, dsm in history_ds:
        add_history_point(r2_id, r_num, rate, total, acc, dsm)

    round_id2 = create_round(r2_id, 8, "PR #119: Add Dialog and Tooltip primitives with Tailwind tokens", "")
    flags_ds = [
        {
            "id": "flag-ds-1",
            "repo_id": r2_id,
            "round_id": round_id2,
            "file_path": "packages/ui/src/Button.tsx",
            "line_number": 14,
            "category": "style",
            "severity": "nit",
            "title": "Raw hex color bypasses theme token contract",
            "explanation": "Directly using `#3dff6b` violates atomic design tokens. Reference `var(--primary)` or Tailwind `text-primary` token instead.",
            "proposed_fix": "className=\"bg-primary text-black font-semibold px-4 py-2 rounded-lg\"",
            "status": "pending",
            "confidence": 0.95,
            "suppressed": False
        },
        {
            "id": "flag-ds-2",
            "repo_id": r2_id,
            "round_id": round_id2,
            "file_path": "packages/tokens/src/spacing.ts",
            "line_number": 22,
            "category": "duplication",
            "severity": "warning",
            "title": "Duplicated breakpoint media-query map",
            "explanation": "Media query mapping is already declared in `primitives/media.ts`. Re-declaring invites token drift.",
            "proposed_fix": "export { BREAKPOINTS } from '@sentry-ui/primitives';",
            "status": "pending",
            "confidence": 0.92,
            "suppressed": False
        },
        {
            "id": "flag-ds-3",
            "repo_id": r2_id,
            "round_id": round_id2,
            "file_path": "packages/ui/src/Modal.tsx",
            "line_number": 38,
            "category": "best-practice",
            "severity": "warning",
            "title": "Modal dialog missing aria-modal and role attributes",
            "explanation": "Accessibility audit requirement: modals must declare `role=\"dialog\"` and `aria-modal=\"true\"` for screen readers.",
            "proposed_fix": "<div role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"modal-title\">",
            "status": "pending",
            "confidence": 0.89,
            "suppressed": False
        }
    ]
    insert_flags(flags_ds)

    # ==========================================
    # 3. REPO 3: payment-service (Cold Start)
    # ==========================================
    r3 = create_repo("payment-service", "Newly created payment gateway integration. Cold-start baseline.")
    r3_id = r3["id"]

    # Cold start baseline weights
    set_category_weight(r3_id, "security", 0.80, 80, alpha=8.0, beta=2.0, accept_count=0, dismiss_count=0, not_relevant_count=0)
    set_category_weight(r3_id, "best-practice", 0.60, 60, alpha=6.0, beta=4.0, accept_count=0, dismiss_count=0, not_relevant_count=0)
    set_category_weight(r3_id, "complexity", 0.50, 50, alpha=5.0, beta=5.0, accept_count=0, dismiss_count=0, not_relevant_count=0)
    set_category_weight(r3_id, "duplication", 0.40, 40, alpha=4.0, beta=6.0, accept_count=0, dismiss_count=0, not_relevant_count=0)
    set_category_weight(r3_id, "style", 0.30, 30, alpha=3.0, beta=7.0, accept_count=0, dismiss_count=0, not_relevant_count=0)

    # Baseline round 1 point
    add_history_point(r3_id, 1, 50, 10, 5, 5)

    flags_payment = [
        {
            "id": "flag-pay-1",
            "repo_id": r3_id,
            "round_id": None,
            "file_path": "services/stripe_webhook.py",
            "line_number": 19,
            "category": "security",
            "severity": "critical",
            "title": "Webhook signature verification missing",
            "explanation": "Stripe webhook endpoint executes payment fulfillment without validating `stripe-signature` header.",
            "proposed_fix": "stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)",
            "status": "pending",
            "confidence": 0.98,
            "suppressed": False
        },
        {
            "id": "flag-pay-2",
            "repo_id": r3_id,
            "round_id": None,
            "file_path": "services/stripe_webhook.py",
            "line_number": 34,
            "category": "complexity",
            "severity": "warning",
            "title": "Nested payment state branching",
            "explanation": "5 nested if statements handle refund status. Extract into a state transition strategy.",
            "proposed_fix": "return handle_payment_intent_status(event['data']['object'])",
            "status": "pending",
            "confidence": 0.86,
            "suppressed": False
        }
    ]
    insert_flags(flags_payment)
