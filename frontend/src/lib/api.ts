import { RepoSummary, RepoDetail, ActionResponse, TasteExplanation, FlagItem } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

export async function submitFlagAction(flagId: string, action: 'accept' | 'dismiss' | 'not_relevant'): Promise<ActionResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/flags/${flagId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
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

export async function resetRepo(repoId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/repos/${repoId}/reset`, { method: 'POST' });
  } catch (err) {
    console.warn("Reset simulated locally", err);
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
