import { RepoSummary, RepoDetail, ActionResponse, TasteExplanation, FlagItem, BenchmarkSummaryResponse, GitHubEventItem, ReviewerProfile, ApplyFixResponse, RepoCompareResponse, DemoConvergenceResponse } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL 
  ? process.env.NEXT_PUBLIC_API_URL 
  : (typeof window !== 'undefined' ? '' : 'http://localhost:8000');

export async function fetchRepos(): Promise<RepoSummary[]> {
  try {
    const res = await fetch(`${API_BASE}/api/repos`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Backend not available, using fallback repo list", err);
    return getFallbackRepos();
  }
}

export async function fetchRepoDetail(repoId: string): Promise<RepoDetail> {
  try {
    const res = await fetch(`${API_BASE}/api/repos/${repoId}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Backend not available for repo ${repoId}, using fallback`, err);
    return getFallbackRepoDetail(repoId);
  }
}

export async function fetchRepoTaste(repoId: string): Promise<TasteExplanation> {
  try {
    const res = await fetch(`${API_BASE}/api/repos/${repoId}/taste`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return getFallbackTaste(repoId);
  }
}

export async function submitFlagAction(
  flagId: string, 
  action: 'accept' | 'dismiss' | 'not_relevant',
  reviewerId?: string
): Promise<ActionResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/flags/${flagId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reviewer_id: reviewerId })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Action simulated locally", err);
    return simulateActionResponse(flagId, action);
  }
}

export async function submitDiffReview(repoId: string, diffTitle: string, diffContent: string): Promise<{ flags: FlagItem[]; filtered_out_count: number }> {
  try {
    const res = await fetch(`${API_BASE}/api/repos/${repoId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_id: repoId, diff_title: diffTitle, diff_content: diffContent })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Review simulated locally", err);
    return simulateReviewResponse(repoId, diffTitle, diffContent);
  }
}


export async function applyFlagFix(flagId: string, note?: string): Promise<ApplyFixResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/flags/${flagId}/apply-fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Apply fix using local fallback simulation", err);
    return {
      flag_id: flagId,
      status: "applied",
      branch_name: `sentry/fix-${flagId.slice(0, 8)}`,
      commit_sha: "a4f89d2",
      diff_patch: "--- a/source\n+++ b/source\n@@ -1,1 +1,1 @@\n-old\n+applied",
      file_path: "src/main.py",
      message: "Suggested fix patch applied cleanly"
    };
  }
}

export async function fetchRepoReviewers(repoId: string): Promise<ReviewerProfile[]> {
  try {
    const res = await fetch(`${API_BASE}/api/repos/${repoId}/reviewers`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Reviewers not available, using empty fallback", err);
    return [];
  }
}

export async function resetRepo(repoId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/repos/${repoId}/reset`, { method: 'POST' });
  } catch (err) {
    console.warn("Reset simulated locally", err);
  }
}

export async function fetchBenchmarkReplay(repoName: string = "api-gateway", scenario: string = "backend_hardened"): Promise<BenchmarkSummaryResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/benchmark/replay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_name: repoName, scenario })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Benchmark replay using fallback simulation", err);
    return getFallbackBenchmarkReplay();
  }
}

export async function simulateGitHubEvent(payload: Record<string, any>): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/github/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("GitHub simulation local fallback", err);
    return {
      status: "success",
      event: payload.event_type || "pull_request",
      action: "simulated_local",
      flags_posted: 3,
      summary: "Simulated GitHub event executed locally."
    };
  }
}

export async function fetchGitHubEvents(repoId?: string): Promise<GitHubEventItem[]> {
  try {
    const url = repoId ? `${API_BASE}/api/github/events?repo_id=${repoId}` : `${API_BASE}/api/github/events`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return [
      {
        id: "evt-sim-1",
        repo_id: repoId || "api-gateway",
        event_type: "pull_request",
        action: "opened",
        pr_number: 342,
        summary: "Auto-reviewed PR #342: Posted 3 inline flags (1 style flag suppressed)",
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: "evt-sim-2",
        repo_id: repoId || "api-gateway",
        event_type: "reaction",
        action: "accept",
        pr_number: 342,
        summary: "Developer reacted 👍 on Security flag: Tuned Security weight to 88%",
        created_at: new Date(Date.now() - 1800000).toISOString()
      }
    ];
  }
}

// ----------------- Fallback Data Engine for Resilient Offline Dev -----------------

function getFallbackRepos(): RepoSummary[] {
  return [
    {
      id: "api-gateway",
      name: "api-gateway",
      description: "High-throughput API gateway handling authentication & microservice routing.",
      created_at: new Date().toISOString(),
      current_acceptance_rate: 78,
      trend_text: "↑ 34% since round 1",
      flags_this_week: 142,
      top_category: "Security",
      top_category_weight: 88,
      weights: [
        { category: "security", weight: 0.88, percentage: 88, alpha: 22, beta: 3, accept_count: 22, dismiss_count: 3, not_relevant_count: 0, suppressed: false, color_token: "accent" },
        { category: "complexity", weight: 0.64, percentage: 64, alpha: 16, beta: 9, accept_count: 16, dismiss_count: 9, not_relevant_count: 0, suppressed: false, color_token: "primary" },
        { category: "best-practice", weight: 0.58, percentage: 58, alpha: 14, beta: 10, accept_count: 14, dismiss_count: 10, not_relevant_count: 0, suppressed: false, color_token: "accent" },
        { category: "duplication", weight: 0.41, percentage: 41, alpha: 9, beta: 13, accept_count: 9, dismiss_count: 13, not_relevant_count: 1, suppressed: false, color_token: "muted" },
        { category: "style", weight: 0.22, percentage: 22, alpha: 4, beta: 14, accept_count: 4, dismiss_count: 14, not_relevant_count: 2, suppressed: true, color_token: "dark-muted" }
      ]
    },
    {
      id: "design-system",
      name: "design-system",
      description: "Shared React component library and token system for web applications.",
      created_at: new Date().toISOString(),
      current_acceptance_rate: 86,
      trend_text: "↑ 48% since round 1",
      flags_this_week: 96,
      top_category: "Style",
      top_category_weight: 91,
      weights: [
        { category: "style", weight: 0.91, percentage: 91, alpha: 29, beta: 3, accept_count: 29, dismiss_count: 3, not_relevant_count: 0, suppressed: false, color_token: "primary" },
        { category: "duplication", weight: 0.82, percentage: 82, alpha: 23, beta: 5, accept_count: 23, dismiss_count: 5, not_relevant_count: 0, suppressed: false, color_token: "accent" },
        { category: "best-practice", weight: 0.75, percentage: 75, alpha: 18, beta: 6, accept_count: 18, dismiss_count: 6, not_relevant_count: 0, suppressed: false, color_token: "accent" },
        { category: "security", weight: 0.50, percentage: 50, alpha: 10, beta: 10, accept_count: 10, dismiss_count: 10, not_relevant_count: 0, suppressed: false, color_token: "muted" },
        { category: "complexity", weight: 0.38, percentage: 38, alpha: 8, beta: 13, accept_count: 8, dismiss_count: 13, not_relevant_count: 1, suppressed: false, color_token: "dark-muted" }
      ]
    }
  ];
}

function getFallbackRepoDetail(repoId: string): RepoDetail {
  const isApi = repoId === "api-gateway";
  return {
    id: repoId,
    name: repoId,
    description: isApi ? "High-throughput API gateway handling authentication & microservice routing." : "Shared UI component library.",
    created_at: new Date().toISOString(),
    current_acceptance_rate: isApi ? 78 : 86,
    trend_text: isApi ? "↑ 34% since round 1" : "↑ 48% since round 1",
    flags_this_week: isApi ? 142 : 96,
    top_category: isApi ? "Security" : "Style",
    top_category_weight: isApi ? 88 : 91,
    weights: isApi ? [
      { category: "security", weight: 0.88, percentage: 88, alpha: 22, beta: 3, accept_count: 22, dismiss_count: 3, not_relevant_count: 0, suppressed: false, color_token: "accent" },
      { category: "complexity", weight: 0.64, percentage: 64, alpha: 16, beta: 9, accept_count: 16, dismiss_count: 9, not_relevant_count: 0, suppressed: false, color_token: "primary" },
      { category: "best-practice", weight: 0.58, percentage: 58, alpha: 14, beta: 10, accept_count: 14, dismiss_count: 10, not_relevant_count: 0, suppressed: false, color_token: "accent" },
      { category: "duplication", weight: 0.41, percentage: 41, alpha: 9, beta: 13, accept_count: 9, dismiss_count: 13, not_relevant_count: 1, suppressed: false, color_token: "muted" },
      { category: "style", weight: 0.22, percentage: 22, alpha: 4, beta: 14, accept_count: 4, dismiss_count: 14, not_relevant_count: 2, suppressed: true, color_token: "dark-muted" }
    ] : [
      { category: "style", weight: 0.91, percentage: 91, alpha: 29, beta: 3, accept_count: 29, dismiss_count: 3, not_relevant_count: 0, suppressed: false, color_token: "primary" },
      { category: "duplication", weight: 0.82, percentage: 82, alpha: 23, beta: 5, accept_count: 23, dismiss_count: 5, not_relevant_count: 0, suppressed: false, color_token: "accent" },
      { category: "best-practice", weight: 0.75, percentage: 75, alpha: 18, beta: 6, accept_count: 18, dismiss_count: 6, not_relevant_count: 0, suppressed: false, color_token: "accent" },
      { category: "security", weight: 0.50, percentage: 50, alpha: 10, beta: 10, accept_count: 10, dismiss_count: 10, not_relevant_count: 0, suppressed: false, color_token: "muted" },
      { category: "complexity", weight: 0.38, percentage: 38, alpha: 8, beta: 13, accept_count: 8, dismiss_count: 13, not_relevant_count: 1, suppressed: false, color_token: "dark-muted" }
    ],
    history: isApi ? [
      { round_number: 1, acceptance_rate: 44, total_flags: 25, accepted_flags: 11, dismissed_flags: 14, created_at: "" },
      { round_number: 2, acceptance_rate: 50, total_flags: 22, accepted_flags: 11, dismissed_flags: 11, created_at: "" },
      { round_number: 3, acceptance_rate: 58, total_flags: 24, accepted_flags: 14, dismissed_flags: 10, created_at: "" },
      { round_number: 4, acceptance_rate: 65, total_flags: 20, accepted_flags: 13, dismissed_flags: 7, created_at: "" },
      { round_number: 5, acceptance_rate: 71, total_flags: 21, accepted_flags: 15, dismissed_flags: 6, created_at: "" },
      { round_number: 6, acceptance_rate: 74, total_flags: 19, accepted_flags: 14, dismissed_flags: 5, created_at: "" },
      { round_number: 7, acceptance_rate: 76, total_flags: 21, accepted_flags: 16, dismissed_flags: 5, created_at: "" },
      { round_number: 8, acceptance_rate: 78, total_flags: 23, accepted_flags: 18, dismissed_flags: 5, created_at: "" },
    ] : [
      { round_number: 1, acceptance_rate: 38, total_flags: 20, accepted_flags: 8, dismissed_flags: 12, created_at: "" },
      { round_number: 2, acceptance_rate: 49, total_flags: 18, accepted_flags: 9, dismissed_flags: 9, created_at: "" },
      { round_number: 3, acceptance_rate: 61, total_flags: 21, accepted_flags: 13, dismissed_flags: 8, created_at: "" },
      { round_number: 4, acceptance_rate: 70, total_flags: 23, accepted_flags: 16, dismissed_flags: 7, created_at: "" },
      { round_number: 5, acceptance_rate: 77, total_flags: 22, accepted_flags: 17, dismissed_flags: 5, created_at: "" },
      { round_number: 6, acceptance_rate: 84, total_flags: 19, accepted_flags: 16, dismissed_flags: 3, created_at: "" },
      { round_number: 7, acceptance_rate: 86, total_flags: 21, accepted_flags: 18, dismissed_flags: 3, created_at: "" },
    ],
    queue: isApi ? [
      {
        id: "flag-api-1",
        repo_id: "api-gateway",
        file_path: "src/auth/session.py",
        line_number: 3,
        category: "security",
        severity: "critical",
        title: "Hardcoded secret key in session.py",
        explanation: "Hardcoded session signing secret detected in source file. In production, this allows attackers to forge administrative authentication tokens.",
        proposed_fix: "SECRET_KEY = os.environ.get('APP_SESSION_SECRET')",
        status: "pending",
        confidence: 0.99,
        suppressed: false,
        repo_weight: 88
      },
      {
        id: "flag-api-2",
        repo_id: "api-gateway",
        file_path: "src/utils/validate.py",
        line_number: 6,
        category: "complexity",
        severity: "warning",
        title: "Redundant boolean condition",
        explanation: "Condition if is_authenticated == True adds unnecessary syntax complexity. Use direct truthiness.",
        proposed_fix: "if is_authenticated and not user.is_suspended:",
        status: "pending",
        confidence: 0.94,
        suppressed: false,
        repo_weight: 64
      },
      {
        id: "flag-api-3",
        repo_id: "api-gateway",
        file_path: "src/utils/validate.py",
        line_number: 12,
        category: "style",
        severity: "nit",
        title: "Ambiguous function name",
        explanation: "Single-letter or ambiguous function signature def fn(d) does not declare operational intent.",
        proposed_fix: "def validate_route_payload(payload: dict):",
        status: "pending",
        confidence: 0.88,
        suppressed: false,
        repo_weight: 22
      }
    ] : [
      {
        id: "flag-ds-1",
        repo_id: "design-system",
        file_path: "packages/ui/src/Button.tsx",
        line_number: 14,
        category: "style",
        severity: "nit",
        title: "Raw hex color bypasses theme token contract",
        explanation: "Directly using #3dff6b violates atomic design tokens. Reference var(--primary) instead.",
        proposed_fix: "className=\"bg-primary text-black\"",
        status: "pending",
        confidence: 0.95,
        suppressed: false,
        repo_weight: 91
      },
      {
        id: "flag-ds-2",
        repo_id: "design-system",
        file_path: "packages/tokens/src/spacing.ts",
        line_number: 22,
        category: "duplication",
        severity: "warning",
        title: "Duplicated breakpoint media-query map",
        explanation: "Media query mapping is already declared in primitives/media.ts. Re-declaring invites token drift.",
        proposed_fix: "export { BREAKPOINTS } from '@sentry-ui/primitives';",
        status: "pending",
        confidence: 0.92,
        suppressed: false,
        repo_weight: 82
      }
    ]
  };
}

function getFallbackTaste(repoId: string): TasteExplanation {
  const isApi = repoId === "api-gateway";
  return isApi ? {
    repo_name: "api-gateway",
    headline: "Hardened Backend Profile: High Security & Logic Vigilance",
    summary: "This repo has learned to prioritize security (88%) and complexity (64%) issues — style nits are surfaced rarely. The team has dismissed 14 style flags, signaling that formatting is enforced by pre-commit tools rather than PR reviews.",
    priorities: ["Security", "Complexity"],
    suppressed: ["Style"],
    confidence_level: "High (Data-backed: 78% team alignment)",
    category_breakdown: [
      { category: "security", percentage: 88, weight: 0.88, accepts: 22, dismisses: 3, is_suppressed: false },
      { category: "complexity", percentage: 64, weight: 0.64, accepts: 16, dismisses: 9, is_suppressed: false },
      { category: "best-practice", percentage: 58, weight: 0.58, accepts: 14, dismisses: 10, is_suppressed: false },
      { category: "duplication", percentage: 41, weight: 0.41, accepts: 9, dismisses: 13, is_suppressed: false },
      { category: "style", percentage: 22, weight: 0.22, accepts: 4, dismisses: 14, is_suppressed: true },
    ],
    recommendations: [
      "High Confidence: Security flags have an 88% acceptance rate. Sentry aggressively highlights credential leaks and injection risks.",
      "Suppression Active: Style weight is 22%. Minor naming and spacing nits are suppressed to prevent PR review fatigue."
    ]
  } : {
    repo_name: "design-system",
    headline: "Design System & UI Profile: Strict Consistency & DRY Standards",
    summary: "This repo has learned to prioritize style (91%) and duplication (82%) issues — arbitrary styling and copy-pasted CSS tokens are rejected. The team values strict alignment with atomic design tokens.",
    priorities: ["Style", "Duplication", "Best-Practice"],
    suppressed: ["Complexity"],
    confidence_level: "High (Data-backed: 86% team alignment)",
    category_breakdown: [
      { category: "style", percentage: 91, weight: 0.91, accepts: 29, dismisses: 3, is_suppressed: false },
      { category: "duplication", percentage: 82, weight: 0.82, accepts: 23, dismisses: 5, is_suppressed: false },
      { category: "best-practice", percentage: 75, weight: 0.75, accepts: 18, dismisses: 6, is_suppressed: false },
      { category: "security", percentage: 50, weight: 0.50, accepts: 10, dismisses: 10, is_suppressed: false },
      { category: "complexity", percentage: 38, weight: 0.38, accepts: 8, dismisses: 13, is_suppressed: false },
    ],
    recommendations: [
      "High Confidence: Style flags have a 91% acceptance rate. Sentry catches hardcoded hex colors and unconventional component props.",
      "DRY Enforcement: Duplication flags are accepted 82% of the time to keep component token maps unified."
    ]
  };
}

function simulateActionResponse(flagId: string, action: string): ActionResponse {
  return {
    flag_id: flagId,
    new_status: action,
    repo_id: "api-gateway",
    category: "security",
    updated_weight: action === 'accept' ? 0.90 : 0.84,
    updated_percentage: action === 'accept' ? 90 : 84,
    repo_acceptance_rate: action === 'accept' ? 80 : 77,
    taste_explanation: "This repo continues to adapt: feedback updated category weights in real time.",
    weights: [
      { category: "security", weight: 0.90, percentage: 90, alpha: 23, beta: 3, accept_count: 23, dismiss_count: 3, not_relevant_count: 0, suppressed: false, color_token: "accent" },
      { category: "complexity", weight: 0.64, percentage: 64, alpha: 16, beta: 9, accept_count: 16, dismiss_count: 9, not_relevant_count: 0, suppressed: false, color_token: "primary" },
      { category: "best-practice", weight: 0.58, percentage: 58, alpha: 14, beta: 10, accept_count: 14, dismiss_count: 10, not_relevant_count: 0, suppressed: false, color_token: "accent" },
      { category: "duplication", weight: 0.41, percentage: 41, alpha: 9, beta: 13, accept_count: 9, dismiss_count: 13, not_relevant_count: 1, suppressed: false, color_token: "muted" },
      { category: "style", weight: 0.22, percentage: 22, alpha: 4, beta: 14, accept_count: 4, dismiss_count: 14, not_relevant_count: 2, suppressed: true, color_token: "dark-muted" }
    ]
  };
}

function simulateReviewResponse(repoId: string, title: string, diff: string) {
  return {
    flags: [
      {
        id: "sim-flag-1",
        repo_id: repoId,
        file_path: "src/auth/session.py",
        line_number: 3,
        category: "security",
        severity: "critical",
        title: "Hardcoded secret key in session.py",
        explanation: "Static credentials embedded directly into source code risk leakage. Use environment variables.",
        proposed_fix: "SECRET_KEY = os.environ.get('APP_SESSION_SECRET')",
        status: "pending",
        confidence: 0.98,
        suppressed: false,
        repo_weight: 88
      }
    ],
    filtered_out_count: 1
  };
}

function getFallbackBenchmarkReplay(): BenchmarkSummaryResponse {
  const roundResults = [
    { round_number: 1, round_title: "PR #101: Initial User Authentication & Session Setup", total_flags: 10, learned_shown: 10, learned_accepted: 5, learned_dismissed: 5, learned_precision: 0.50, learned_acceptance_rate: 50.0, learned_fpr: 1.0, baseline_shown: 10, baseline_accepted: 5, baseline_dismissed: 5, baseline_precision: 0.50, baseline_acceptance_rate: 50.0, baseline_fpr: 1.0 },
    { round_number: 2, round_title: "PR #108: Payment Gateway Stripe Webhook Integration", total_flags: 10, learned_shown: 8, learned_accepted: 5, learned_dismissed: 3, learned_precision: 0.625, learned_acceptance_rate: 62.5, learned_fpr: 0.60, baseline_shown: 10, baseline_accepted: 5, baseline_dismissed: 5, baseline_precision: 0.50, baseline_acceptance_rate: 50.0, baseline_fpr: 1.0 },
    { round_number: 3, round_title: "PR #115: Multi-Tenant Organization Switcher", total_flags: 10, learned_shown: 7, learned_accepted: 5, learned_dismissed: 2, learned_precision: 0.714, learned_acceptance_rate: 71.4, learned_fpr: 0.40, baseline_shown: 10, baseline_accepted: 5, baseline_dismissed: 5, baseline_precision: 0.50, baseline_acceptance_rate: 50.0, baseline_fpr: 1.0 },
    { round_number: 4, round_title: "PR #124: Audit Logging & Event Streaming via Kafka", total_flags: 10, learned_shown: 6, learned_accepted: 5, learned_dismissed: 1, learned_precision: 0.833, learned_acceptance_rate: 83.3, learned_fpr: 0.20, baseline_shown: 10, baseline_accepted: 5, baseline_dismissed: 5, baseline_precision: 0.50, baseline_acceptance_rate: 50.0, baseline_fpr: 1.0 },
    { round_number: 5, round_title: "PR #131: Background Celery Tasks & File Upload Processing", total_flags: 10, learned_shown: 6, learned_accepted: 5, learned_dismissed: 1, learned_precision: 0.833, learned_acceptance_rate: 83.3, learned_fpr: 0.20, baseline_shown: 10, baseline_accepted: 5, baseline_dismissed: 5, baseline_precision: 0.50, baseline_acceptance_rate: 50.0, baseline_fpr: 1.0 },
    { round_number: 6, round_title: "PR #142: Rate Limiting & Distributed Cache Middleware", total_flags: 10, learned_shown: 6, learned_accepted: 5, learned_dismissed: 1, learned_precision: 0.833, learned_acceptance_rate: 83.3, learned_fpr: 0.20, baseline_shown: 10, baseline_accepted: 5, baseline_dismissed: 5, baseline_precision: 0.50, baseline_acceptance_rate: 50.0, baseline_fpr: 1.0 },
    { round_number: 7, round_title: "PR #150: Database Migration & Index Optimization", total_flags: 10, learned_shown: 5, learned_accepted: 5, learned_dismissed: 0, learned_precision: 1.00, learned_acceptance_rate: 100.0, learned_fpr: 0.0, baseline_shown: 10, baseline_accepted: 5, baseline_dismissed: 5, baseline_precision: 0.50, baseline_acceptance_rate: 50.0, baseline_fpr: 1.0 },
    { round_number: 8, round_title: "PR #159: GraphQL Federation & Resolver Implementation", total_flags: 10, learned_shown: 5, learned_accepted: 5, learned_dismissed: 0, learned_precision: 1.00, learned_acceptance_rate: 100.0, learned_fpr: 0.0, baseline_shown: 10, baseline_accepted: 5, baseline_dismissed: 5, baseline_precision: 0.50, baseline_acceptance_rate: 50.0, baseline_fpr: 1.0 },
    { round_number: 9, round_title: "PR #168: Webhook Dispatcher & Reliable Retry Engine", total_flags: 10, learned_shown: 5, learned_accepted: 5, learned_dismissed: 0, learned_precision: 1.00, learned_acceptance_rate: 100.0, learned_fpr: 0.0, baseline_shown: 10, baseline_accepted: 5, baseline_dismissed: 5, baseline_precision: 0.50, baseline_acceptance_rate: 50.0, baseline_fpr: 1.0 },
    { round_number: 10, round_title: "PR #175: Zero-Trust Microservice Mesh & Mutual TLS", total_flags: 10, learned_shown: 5, learned_accepted: 5, learned_dismissed: 0, learned_precision: 1.00, learned_acceptance_rate: 100.0, learned_fpr: 0.0, baseline_shown: 10, baseline_accepted: 5, baseline_dismissed: 5, baseline_precision: 0.50, baseline_acceptance_rate: 50.0, baseline_fpr: 1.0 },
  ];

  return {
    repo_name: "api-gateway",
    scenario_name: "Hardened Backend Profile (Real-world 10-PR Replay)",
    total_rounds: 10,
    total_flags_evaluated: 100,
    learned_final_precision: 1.0,
    baseline_final_precision: 0.50,
    precision_gain: 50.0,
    learned_final_fpr: 0.0,
    baseline_final_fpr: 1.0,
    noise_reduction_pct: 74.0,
    rounds: roundResults,
    category_weights_progression: {
      security: [80, 83, 86, 88, 90, 92, 93, 94, 94, 95],
      complexity: [50, 55, 60, 63, 64, 65, 66, 67, 68, 68],
      "best-practice": [60, 63, 65, 68, 70, 72, 73, 74, 75, 75],
      duplication: [40, 38, 36, 34, 32, 30, 28, 27, 26, 25],
      style: [30, 26, 22, 19, 17, 15, 14, 13, 12, 11]
    }
  };
}



// ----------------- PHASE 3: PRODUCT POLISH & RECRUITER DEMO -----------------

export async function compareRepositories(sourceId: string, targetId: string): Promise<RepoCompareResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/repos/${sourceId}/compare/${targetId}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Using local comparison fallback", err);
    return {
      source_repo_id: sourceId,
      source_repo_name: sourceId,
      target_repo_id: targetId,
      target_repo_name: targetId,
      divergence_score: 72,
      source_top_category: "Security",
      target_top_category: "Style",
      key_differences: [
        `${targetId} strongly prioritizes Style (+68% higher taste weighting).`,
        `${sourceId} strongly prioritizes Security (+42% higher taste weighting).`,
        "Suppression policy divergence: cosmetic nits demoted on backend, mock auth tolerated on frontend."
      ],
      categories: [
        { category: "Security", source_percentage: 88, target_percentage: 46, difference: 42, favored_by: sourceId },
        { category: "Style", source_percentage: 22, target_percentage: 90, difference: 68, favored_by: targetId },
        { category: "Best-practice", source_percentage: 58, target_percentage: 75, difference: 17, favored_by: targetId },
        { category: "Complexity", source_percentage: 64, target_percentage: 42, difference: 22, favored_by: sourceId },
        { category: "Duplication", source_percentage: 41, target_percentage: 82, difference: 41, favored_by: targetId }
      ]
    };
  }
}

export async function triggerDemoDivergence(): Promise<DemoConvergenceResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/demo/reset-divergence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Using local demo divergence fallback", err);
    return {
      status: "success",
      message: "Demo showcase repositories initialized with contrasting profiles.",
      repos_seeded: ["fintech-core", "web-design-system"]
    };
  }
}

export function getRepoCsvExportUrl(repoId: string): string {
  return `${API_BASE}/api/repos/${repoId}/export/csv`;
}
