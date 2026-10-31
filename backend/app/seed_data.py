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
    create_round,
    create_reviewer,
    set_reviewer_weight
)
from app.learning import (
    calculate_weight,
    calculate_credible_interval,
    is_cold_start_category,
    generate_why_shown_explanation
)



def seed_reviewer(repo_id: str, reviewer_id: str, name: str, role: str, avatar_color: str, weights_data: list):
    create_reviewer(repo_id, reviewer_id, name, role, avatar_color)
    for cat, a, b, acc, dsm in weights_data:
        w, pct = calculate_weight(a, b)
        set_reviewer_weight(reviewer_id, repo_id, cat, w, pct, a, b, acc, dsm, 0)

def seed_weight(repo_id: str, category: str, alpha: float, beta: float, accepts: int, dismisses: int, not_relevant: int = 0):
    w, pct = calculate_weight(alpha, beta)
    ci_l, ci_u, ci_lp, ci_up = calculate_credible_interval(alpha, beta)
    is_cold = is_cold_start_category(accepts, dismisses, not_relevant)
    set_category_weight(
        repo_id, category, w, pct, alpha, beta, accepts, dismisses, not_relevant,
        ci_lower=ci_l, ci_upper=ci_u, ci_percentage_lower=ci_lp, ci_percentage_upper=ci_up,
        is_cold_start=is_cold
    )


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
    seed_weight(r1_id, "security", 22.0, 3.0, 22, 3, 0)
    seed_weight(r1_id, "complexity", 16.0, 9.0, 16, 9, 0)
    seed_weight(r1_id, "best-practice", 14.0, 10.0, 14, 10, 0)
    seed_weight(r1_id, "duplication", 9.0, 13.0, 9, 13, 1)
    seed_weight(r1_id, "style", 4.0, 14.0, 4, 14, 2)
    # Seed Reviewer Profiles for api-gateway
    seed_reviewer(r1_id, "sarah-chen", "Sarah Chen", "Staff Security Engineer", "#A855F7", [
        ("security", 30.0, 2.0, 30, 2),
        ("complexity", 23.0, 5.0, 23, 5),
        ("best-practice", 14.0, 6.0, 14, 6),
        ("duplication", 8.0, 12.0, 8, 12),
        ("style", 3.0, 17.0, 3, 17),
    ])
    seed_reviewer(r1_id, "alex-rivera", "Alex Rivera", "Frontend & API Platform", "#3DFF6B", [
        ("style", 22.0, 4.0, 22, 4),
        ("best-practice", 18.0, 6.0, 18, 6),
        ("security", 14.0, 6.0, 14, 6),
        ("complexity", 15.0, 8.0, 15, 8),
        ("duplication", 12.0, 8.0, 12, 8),
    ])
    seed_reviewer(r1_id, "david-kim", "David Kim", "Infra & Reliability Lead", "#38BDF8", [
        ("best-practice", 27.0, 3.0, 27, 3),
        ("security", 22.0, 3.0, 22, 3),
        ("complexity", 18.0, 6.0, 18, 6),
        ("duplication", 11.0, 9.0, 11, 9),
        ("style", 6.0, 14.0, 6, 14),
    ])


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
            "suppressed": False,
            "demoted": False,
            "language": "python",
            "diff_patch": "--- a/src/auth/session.py\n+++ b/src/auth/session.py\n@@ -3,1 +3,2 @@\n-SECRET_KEY = \"raw-insecure-hardcoded-secret-key-123456\"\n+import os\n+SECRET_KEY = os.environ.get('APP_SESSION_SECRET') or secrets.token_hex(32)",
            "why_shown": "Critical override: Security weight 0.88 for this repo (90% CI: [81%-94%]), accepted 22 of 25 similar flags."
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
            "suppressed": False,
            "demoted": False,
            "language": "python",
            "diff_patch": "--- a/src/utils/validate.py\n+++ b/src/utils/validate.py\n@@ -6,1 +6,2 @@\n-if is_authenticated == True and not user.is_suspended == False:\n+if is_authenticated and not user.is_suspended:\n+    return True",
            "why_shown": "Complexity weight 0.64 for this repo (90% CI: [53%-74%]), accepted 16 of 25 similar flags (64% accept rate)."
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
            "suppressed": False,
            "demoted": True,
            "suppression_reason": "Category weight below 28% threshold (demoted to low-priority group)",
            "language": "python",
            "diff_patch": "--- a/src/utils/validate.py\n+++ b/src/utils/validate.py\n@@ -12,1 +12,1 @@\n-def fn(d):\n+def validate_route_payload(payload: dict) -> bool:",
            "why_shown": "Demoted to low priority: Style weight 0.22 for this repo (90% CI: [12%-32%]). Non-critical flags are grouped into low priority."
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
            "suppressed": False,
            "why_shown": "Best-practice weight 0.58 for this repo (90% CI: [47%-68%]), accepted 14 of 24 similar flags."
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
    seed_weight(r2_id, "style", 29.0, 3.0, 29, 3, 0)
    seed_weight(r2_id, "duplication", 23.0, 5.0, 23, 5, 0)
    seed_weight(r2_id, "best-practice", 18.0, 6.0, 18, 6, 0)
    seed_weight(r2_id, "security", 10.0, 10.0, 10, 10, 0)
    seed_weight(r2_id, "complexity", 8.0, 13.0, 8, 13, 1)
    # Seed Reviewer Profiles for design-system
    seed_reviewer(r2_id, "alex-rivera", "Alex Rivera", "Design System Architect", "#3DFF6B", [
        ("style", 32.0, 2.0, 32, 2),
        ("duplication", 26.0, 3.0, 26, 3),
        ("best-practice", 20.0, 4.0, 20, 4),
        ("complexity", 8.0, 12.0, 8, 12),
        ("security", 10.0, 10.0, 10, 10),
    ])
    seed_reviewer(r2_id, "elena-rostova", "Elena Rostova", "Accessibility & UX Specialist", "#C084FC", [
        ("best-practice", 28.0, 2.0, 28, 2),
        ("style", 25.0, 4.0, 25, 4),
        ("duplication", 18.0, 6.0, 18, 6),
        ("complexity", 10.0, 10.0, 10, 10),
        ("security", 8.0, 12.0, 8, 12),
    ])


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
            "suppressed": False,
            "demoted": False,
            "language": "typescript",
            "diff_patch": "--- a/packages/ui/src/Button.tsx\n+++ b/packages/ui/src/Button.tsx\n@@ -14,1 +14,1 @@\n-className=\"bg-[#3dff6b] text-black font-semibold px-4 py-2 rounded-lg\"\n+className=\"bg-primary text-black font-semibold px-4 py-2 rounded-lg\"",
            "why_shown": "Style weight 0.91 for this repo (90% CI: [84%-97%]), accepted 29 of 32 similar flags (91% accept rate)."
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
            "suppressed": False,
            "why_shown": "Duplication weight 0.82 for this repo (90% CI: [72%-91%]), accepted 23 of 28 similar flags."
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
            "suppressed": False,
            "why_shown": "Best-practice weight 0.75 for this repo (90% CI: [63%-86%]), accepted 18 of 24 similar flags."
        }
    ]
    insert_flags(flags_ds)

    # ==========================================
    # 3. REPO 3: payment-service (Cold Start)
    # ==========================================
    r3 = create_repo("payment-service", "Newly created payment gateway integration. Cold-start baseline.")
    r3_id = r3["id"]

    # Cold start baseline weights
    seed_weight(r3_id, "security", 8.0, 2.0, 0, 0, 0)
    seed_weight(r3_id, "best-practice", 6.0, 4.0, 0, 0, 0)
    seed_weight(r3_id, "complexity", 5.0, 5.0, 0, 0, 0)
    seed_weight(r3_id, "duplication", 4.0, 6.0, 0, 0, 0)
    seed_weight(r3_id, "style", 3.0, 7.0, 0, 0, 0)

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
            "suppressed": False,
            "why_shown": "Critical override: Cold-start repo, but critical security defect is prioritized immediately."
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
            "suppressed": False,
            "why_shown": "Cold-start calibration: Complexity initialized with neutral prior (50%, 90% CI: [24%-76%])."
        }
    ]
    insert_flags(flags_payment)


def seed_demo_divergence():
    """
    Seeds/resets two showcase demo repositories for recruiters to inspect learning divergence:
    1. 'fintech-core': Backend payment service with 94% security focus and suppressed cosmetic style nits.
    2. 'web-design-system': Frontend UI kit with 94% style focus, high duplication vigilance, and tolerated mock security.
    """
    conn = get_connection()
    c = conn.cursor()
    # Check if fintech-core already exists
    c.execute("SELECT id FROM repos WHERE id = 'fintech-core'")
    has_fintech = c.fetchone()
    conn.close()

    if not has_fintech:
        # Create fintech-core
        create_repo("fintech-core", "Core banking ledger & payment settlement gateway. High-security compliance profile.")
        seed_weight("fintech-core", "security", 28.0, 2.0, 32, 2, 0)
        seed_weight("fintech-core", "best-practice", 19.0, 3.0, 21, 3, 0)
        seed_weight("fintech-core", "complexity", 15.0, 7.0, 15, 7, 0)
        seed_weight("fintech-core", "duplication", 10.0, 14.0, 10, 14, 0)
        seed_weight("fintech-core", "style", 4.0, 18.0, 4, 18, 0)

        # History points showing steady learning gain
        add_history_point("fintech-core", 1, 48, 12, 6, 6)
        add_history_point("fintech-core", 2, 58, 15, 9, 6)
        add_history_point("fintech-core", 3, 67, 18, 12, 6)
        add_history_point("fintech-core", 4, 76, 22, 17, 5)
        add_history_point("fintech-core", 5, 84, 25, 21, 4)
        add_history_point("fintech-core", 6, 88, 28, 25, 3)

        # Seed flags for fintech-core
        flags_fintech = [
            {
                "id": "flag-fc-1",
                "repo_id": "fintech-core",
                "round_id": None,
                "file_path": "ledger/transaction_settlement.py",
                "line_number": 88,
                "category": "security",
                "severity": "critical",
                "title": "Raw SQL concatenation in ledger transaction balance audit",
                "explanation": "Account balance lookup formats unescaped ledger_id string into execute statement.",
                "proposed_fix": "cursor.execute('SELECT balance FROM accounts WHERE ledger_id = %s FOR UPDATE', (ledger_id,))",
                "diff_patch": """--- a/ledger/transaction_settlement.py\n+++ b/ledger/transaction_settlement.py\n@@ -87,2 +87,2 @@\n-    cursor.execute(f"SELECT balance FROM accounts WHERE ledger_id = '{ledger_id}' FOR UPDATE")\n+    cursor.execute("SELECT balance FROM accounts WHERE ledger_id = %s FOR UPDATE", (ledger_id,))""",
                "language": "python",
                "status": "pending",
                "confidence": 0.99,
                "suppressed": False,
                "demoted": False,
                "why_shown": "High priority: Security weight 93% (90% CI: [84%-98%]), accepted 32 of 34 similar flags."
            },
            {
                "id": "flag-fc-2",
                "repo_id": "fintech-core",
                "round_id": None,
                "file_path": "ledger/utils.py",
                "line_number": 14,
                "category": "style",
                "severity": "nit",
                "title": "Variable name length violates PEP 8 recommendation",
                "explanation": "Short variable name 'acc_bal_tmp' could be expanded to 'account_balance_temp'.",
                "proposed_fix": "account_balance_temp = calculate_accrual(balance)",
                "diff_patch": """--- a/ledger/utils.py\n+++ b/ledger/utils.py\n@@ -13,2 +13,2 @@\n-    acc_bal_tmp = calculate_accrual(balance)\n+    account_balance_temp = calculate_accrual(balance)""",
                "language": "python",
                "status": "pending",
                "confidence": 0.81,
                "suppressed": True,
                "demoted": True,
                "suppression_reason": "Style category weight is 18% (below 28% threshold).",
                "why_shown": "Demoted to low priority: Style weight 18% (90% CI: [7%-33%]), rejected 18 of 22 similar flags."
            }
        ]
        insert_flags(flags_fintech)

        # Create web-design-system
        create_repo("web-design-system", "Unified design tokens, React primitives, and component library. High-fidelity UI profile.")
        seed_weight("web-design-system", "style", 29.0, 2.0, 31, 2, 0)
        seed_weight("web-design-system", "best-practice", 22.0, 3.0, 24, 3, 0)
        seed_weight("web-design-system", "duplication", 18.0, 4.0, 19, 4, 0)
        seed_weight("web-design-system", "complexity", 9.0, 13.0, 9, 13, 0)
        seed_weight("web-design-system", "security", 6.0, 14.0, 6, 14, 0)

        # History points
        add_history_point("web-design-system", 1, 45, 10, 4, 6)
        add_history_point("web-design-system", 2, 59, 14, 8, 6)
        add_history_point("web-design-system", 3, 68, 16, 11, 5)
        add_history_point("web-design-system", 4, 79, 21, 17, 4)
        add_history_point("web-design-system", 5, 87, 26, 23, 3)

        # Seed flags for web-design-system
        flags_wds = [
            {
                "id": "flag-wds-1",
                "repo_id": "web-design-system",
                "round_id": None,
                "file_path": "components/Button/Button.tsx",
                "line_number": 42,
                "category": "style",
                "severity": "warning",
                "title": "Hardcoded hex color string breaks design token theme consistency",
                "explanation": "Found `#3DFF6B` literal. Always reference tokens from `@theme/colors`.",
                "proposed_fix": "backgroundColor: tokens.colors.primaryGreen,",
                "diff_patch": """--- a/components/Button/Button.tsx\n+++ b/components/Button/Button.tsx\n@@ -41,2 +41,2 @@\n-    backgroundColor: '#3DFF6B',\n+    backgroundColor: tokens.colors.primaryGreen,""",
                "language": "typescript",
                "status": "pending",
                "confidence": 0.96,
                "suppressed": False,
                "demoted": False,
                "why_shown": "High priority: Style weight 94% (90% CI: [84%-98%]), accepted 31 of 33 similar flags."
            },
            {
                "id": "flag-wds-2",
                "repo_id": "web-design-system",
                "round_id": None,
                "file_path": "stories/MockAuth.ts",
                "line_number": 19,
                "category": "security",
                "severity": "nit",
                "title": "Storybook mock auth uses hardcoded mock bearer token",
                "explanation": "Mock token 'dev_bearer_token_123' in Storybook fixture. Acceptable for pure UI testing.",
                "proposed_fix": "const MOCK_TOKEN = process.env.STORYBOOK_MOCK_TOKEN || 'dev-token';",
                "diff_patch": """--- a/stories/MockAuth.ts\n+++ b/stories/MockAuth.ts\n@@ -18,2 +18,2 @@\n-const MOCK_TOKEN = 'dev_bearer_token_123';\n+const MOCK_TOKEN = process.env.STORYBOOK_MOCK_TOKEN || 'dev-token';""",
                "language": "typescript",
                "status": "pending",
                "confidence": 0.75,
                "suppressed": True,
                "demoted": True,
                "suppression_reason": "Security category weight is 30% for UI token repo.",
                "why_shown": "Demoted to low priority: Security weight 30% (90% CI: [16%-46%]), rejected 14 of 20 similar flags."
            }
        ]
        insert_flags(flags_wds)

    return ["fintech-core", "web-design-system"]
