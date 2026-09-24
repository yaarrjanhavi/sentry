import { CategoryWeight, HistoryPoint, FlagItem, RepoDetail, RepoSummary, TasteExplanation } from './types';

// In-memory persistent state for serverless Next.js API routes
interface ServerRepoState {
  id: string;
  name: string;
  description: string;
  created_at: string;
  weights: CategoryWeight[];
  history: HistoryPoint[];
  queue: FlagItem[];
}

const GLOBAL_STATE: Record<string, ServerRepoState> = {
  'api-gateway': {
    id: 'api-gateway',
    name: 'api-gateway',
    description: 'High-throughput API gateway handling authentication & microservice routing.',
    created_at: new Date().toISOString(),
    weights: [
      { category: 'security', weight: 0.88, percentage: 88, alpha: 22, beta: 3, accept_count: 22, dismiss_count: 3, not_relevant_count: 0, suppressed: false, color_token: 'accent' },
      { category: 'complexity', weight: 0.64, percentage: 64, alpha: 16, beta: 9, accept_count: 16, dismiss_count: 9, not_relevant_count: 0, suppressed: false, color_token: 'primary' },
      { category: 'best-practice', weight: 0.58, percentage: 58, alpha: 14, beta: 10, accept_count: 14, dismiss_count: 10, not_relevant_count: 0, suppressed: false, color_token: 'accent' },
      { category: 'duplication', weight: 0.41, percentage: 41, alpha: 9, beta: 13, accept_count: 9, dismiss_count: 13, not_relevant_count: 1, suppressed: false, color_token: 'muted' },
      { category: 'style', weight: 0.22, percentage: 22, alpha: 4, beta: 14, accept_count: 4, dismiss_count: 14, not_relevant_count: 2, suppressed: true, color_token: 'dark-muted' }
    ],
    history: [
      { round_number: 1, acceptance_rate: 44, total_flags: 25, accepted_flags: 11, dismissed_flags: 14, created_at: '' },
      { round_number: 2, acceptance_rate: 50, total_flags: 22, accepted_flags: 11, dismissed_flags: 11, created_at: '' },
      { round_number: 3, acceptance_rate: 58, total_flags: 24, accepted_flags: 14, dismissed_flags: 10, created_at: '' },
      { round_number: 4, acceptance_rate: 65, total_flags: 20, accepted_flags: 13, dismissed_flags: 7, created_at: '' },
      { round_number: 5, acceptance_rate: 71, total_flags: 21, accepted_flags: 15, dismissed_flags: 6, created_at: '' },
      { round_number: 6, acceptance_rate: 74, total_flags: 19, accepted_flags: 14, dismissed_flags: 5, created_at: '' },
      { round_number: 7, acceptance_rate: 76, total_flags: 21, accepted_flags: 16, dismissed_flags: 5, created_at: '' },
      { round_number: 8, acceptance_rate: 78, total_flags: 23, accepted_flags: 18, dismissed_flags: 5, created_at: '' },
    ],
    queue: [
      {
        id: 'flag-api-1',
        repo_id: 'api-gateway',
        file_path: 'src/auth/session.py',
        line_number: 3,
        category: 'security',
        severity: 'critical',
        title: 'Hardcoded secret key in session.py',
        explanation: 'Hardcoded session signing secret detected in source file. In production, this allows attackers to forge administrative authentication tokens.',
        proposed_fix: 'SECRET_KEY = os.environ.get("APP_SESSION_SECRET")',
        status: 'pending',
        confidence: 0.99,
        suppressed: false,
        repo_weight: 88
      },
      {
        id: 'flag-api-2',
        repo_id: 'api-gateway',
        file_path: 'src/utils/validate.py',
        line_number: 6,
        category: 'complexity',
        severity: 'warning',
        title: 'Redundant boolean condition',
        explanation: 'Condition `if is_authenticated == True:` adds unnecessary syntax complexity. Use direct truthiness `if is_authenticated:`.',
        proposed_fix: 'if is_authenticated and not user.is_suspended:\n    return True',
        status: 'pending',
        confidence: 0.94,
        suppressed: false,
        repo_weight: 64
      },
      {
        id: 'flag-api-3',
        repo_id: 'api-gateway',
        file_path: 'src/utils/validate.py',
        line_number: 12,
        category: 'style',
        severity: 'nit',
        title: 'Ambiguous function name',
        explanation: 'Single-letter or ambiguous function signature `def fn(d):` does not declare operational intent.',
        proposed_fix: 'def validate_route_payload(payload: dict) -> bool:',
        status: 'pending',
        confidence: 0.88,
        suppressed: false,
        repo_weight: 22
      }
    ]
  },
  'design-system': {
    id: 'design-system',
    name: 'design-system',
    description: 'Shared React component library and token system for web applications.',
    created_at: new Date().toISOString(),
    weights: [
      { category: 'style', weight: 0.91, percentage: 91, alpha: 29, beta: 3, accept_count: 29, dismiss_count: 3, not_relevant_count: 0, suppressed: false, color_token: 'primary' },
      { category: 'duplication', weight: 0.82, percentage: 82, alpha: 23, beta: 5, accept_count: 23, dismiss_count: 5, not_relevant_count: 0, suppressed: false, color_token: 'accent' },
      { category: 'best-practice', weight: 0.75, percentage: 75, alpha: 18, beta: 6, accept_count: 18, dismiss_count: 6, not_relevant_count: 0, suppressed: false, color_token: 'accent' },
      { category: 'security', weight: 0.50, percentage: 50, alpha: 10, beta: 10, accept_count: 10, dismiss_count: 10, not_relevant_count: 0, suppressed: false, color_token: 'muted' },
      { category: 'complexity', weight: 0.38, percentage: 38, alpha: 8, beta: 13, accept_count: 8, dismiss_count: 13, not_relevant_count: 1, suppressed: false, color_token: 'dark-muted' }
    ],
    history: [
      { round_number: 1, acceptance_rate: 38, total_flags: 20, accepted_flags: 8, dismissed_flags: 12, created_at: '' },
      { round_number: 2, acceptance_rate: 49, total_flags: 18, accepted_flags: 9, dismissed_flags: 9, created_at: '' },
      { round_number: 3, acceptance_rate: 61, total_flags: 21, accepted_flags: 13, dismissed_flags: 8, created_at: '' },
      { round_number: 4, acceptance_rate: 70, total_flags: 23, accepted_flags: 16, dismissed_flags: 7, created_at: '' },
      { round_number: 5, acceptance_rate: 77, total_flags: 22, accepted_flags: 17, dismissed_flags: 5, created_at: '' },
      { round_number: 6, acceptance_rate: 84, total_flags: 19, accepted_flags: 16, dismissed_flags: 3, created_at: '' },
      { round_number: 7, acceptance_rate: 86, total_flags: 21, accepted_flags: 18, dismissed_flags: 3, created_at: '' },
    ],
    queue: [
      {
        id: 'flag-ds-1',
        repo_id: 'design-system',
        file_path: 'packages/ui/src/Button.tsx',
        line_number: 14,
        category: 'style',
        severity: 'nit',
        title: 'Raw hex color bypasses theme token contract',
        explanation: 'Directly using `#3dff6b` violates atomic design tokens. Reference `var(--primary)` or Tailwind token instead.',
        proposed_fix: 'className="bg-primary text-black font-semibold px-4 py-2 rounded-lg"',
        status: 'pending',
        confidence: 0.95,
        suppressed: false,
        repo_weight: 91
      },
      {
        id: 'flag-ds-2',
        repo_id: 'design-system',
        file_path: 'packages/tokens/src/spacing.ts',
        line_number: 22,
        category: 'duplication',
        severity: 'warning',
        title: 'Duplicated breakpoint media-query map',
        explanation: 'Media query mapping is already declared in `primitives/media.ts`. Re-declaring invites token drift.',
        proposed_fix: 'export { BREAKPOINTS } from "@sentry-ui/primitives";',
        status: 'pending',
        confidence: 0.92,
        suppressed: false,
        repo_weight: 82
      }
    ]
  },
  'payment-service': {
    id: 'payment-service',
    name: 'payment-service',
    description: 'Newly created payment gateway integration. Cold-start baseline.',
    created_at: new Date().toISOString(),
    weights: [
      { category: 'security', weight: 0.80, percentage: 80, alpha: 8, beta: 2, accept_count: 0, dismiss_count: 0, not_relevant_count: 0, suppressed: false, color_token: 'accent' },
      { category: 'best-practice', weight: 0.60, percentage: 60, alpha: 6, beta: 4, accept_count: 0, dismiss_count: 0, not_relevant_count: 0, suppressed: false, color_token: 'accent' },
      { category: 'complexity', weight: 0.50, percentage: 50, alpha: 5, beta: 5, accept_count: 0, dismiss_count: 0, not_relevant_count: 0, suppressed: false, color_token: 'primary' },
      { category: 'duplication', weight: 0.40, percentage: 40, alpha: 4, beta: 6, accept_count: 0, dismiss_count: 0, not_relevant_count: 0, suppressed: false, color_token: 'muted' },
      { category: 'style', weight: 0.30, percentage: 30, alpha: 3, beta: 7, accept_count: 0, dismiss_count: 0, not_relevant_count: 0, suppressed: false, color_token: 'dark-muted' }
    ],
    history: [
      { round_number: 1, acceptance_rate: 50, total_flags: 10, accepted_flags: 5, dismissed_flags: 5, created_at: '' }
    ],
    queue: [
      {
        id: 'flag-pay-1',
        repo_id: 'payment-service',
        file_path: 'services/stripe_webhook.py',
        line_number: 19,
        category: 'security',
        severity: 'critical',
        title: 'Webhook signature verification missing',
        explanation: 'Stripe webhook endpoint executes payment fulfillment without validating `stripe-signature` header.',
        proposed_fix: 'stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)',
        status: 'pending',
        confidence: 0.98,
        suppressed: false,
        repo_weight: 80
      }
    ]
  }
};

export function getServerRepos(): RepoSummary[] {
  return Object.values(GLOBAL_STATE).map(r => {
    const curRate = r.history[r.history.length - 1]?.acceptance_rate ?? 50;
    const baseRate = r.history[0]?.acceptance_rate ?? 50;
    const diff = curRate - baseRate;
    const top = r.weights[0] || { category: 'Security', percentage: 80 };

    return {
      id: r.id,
      name: r.name,
      description: r.description,
      created_at: r.created_at,
      current_acceptance_rate: curRate,
      trend_text: diff > 0 ? `↑ ${diff}% since round 1` : 'Baseline calibrated',
      flags_this_week: r.id === 'api-gateway' ? 142 : (r.id === 'design-system' ? 96 : 12),
      top_category: top.category.charAt(0).toUpperCase() + top.category.slice(1),
      top_category_weight: top.percentage,
      weights: r.weights
    };
  });
}

export function getServerRepoDetail(repoId: string): RepoDetail | null {
  const r = GLOBAL_STATE[repoId];
  if (!r) return null;

  const curRate = r.history[r.history.length - 1]?.acceptance_rate ?? 50;
  const baseRate = r.history[0]?.acceptance_rate ?? 50;
  const diff = curRate - baseRate;
  const top = r.weights[0] || { category: 'Security', percentage: 80 };

  return {
    id: r.id,
    name: r.name,
    description: r.description,
    created_at: r.created_at,
    current_acceptance_rate: curRate,
    trend_text: diff > 0 ? `↑ ${diff}% since round 1` : 'Baseline calibrated',
    flags_this_week: r.id === 'api-gateway' ? 142 : (r.id === 'design-system' ? 96 : 12),
    top_category: top.category.charAt(0).toUpperCase() + top.category.slice(1),
    top_category_weight: top.percentage,
    weights: r.weights,
    history: r.history,
    queue: r.queue
  };
}

export function updateServerFlagAction(flagId: string, action: string) {
  // Find flag across all repos
  for (const repoId of Object.keys(GLOBAL_STATE)) {
    const repo = GLOBAL_STATE[repoId];
    const flagIndex = repo.queue.findIndex(f => f.id === flagId);

    if (flagIndex !== -1) {
      const flag = repo.queue[flagIndex];
      flag.status = action;

      const catWeight = repo.weights.find(w => w.category.toLowerCase() === flag.category.toLowerCase());
      if (catWeight) {
        if (action === 'accept') {
          catWeight.alpha += 1;
          catWeight.accept_count += 1;
        } else if (action === 'dismiss') {
          catWeight.beta += 1;
          catWeight.dismiss_count += 1;
        } else {
          catWeight.beta += 1.5;
          catWeight.not_relevant_count += 1;
        }

        const total = catWeight.alpha + catWeight.beta;
        catWeight.weight = Math.max(0.05, Math.min(0.98, catWeight.alpha / total));
        catWeight.percentage = Math.round(catWeight.weight * 100);
        catWeight.suppressed = catWeight.weight < 0.28;
      }

      // Re-sort weights
      repo.weights.sort((a, b) => b.weight - a.weight);

      // Recalculate repo acceptance rate
      const totalAcc = repo.weights.reduce((sum, w) => sum + w.accept_count, 0);
      const totalDsm = repo.weights.reduce((sum, w) => sum + w.dismiss_count + w.not_relevant_count, 0);
      const totalActions = totalAcc + totalDsm;
      const newRate = totalActions > 0 ? Math.round((totalAcc / totalActions) * 100) : 50;

      const nextRound = (repo.history[repo.history.length - 1]?.round_number || 1) + 1;
      repo.history.push({
        round_number: nextRound,
        acceptance_rate: newRate,
        total_flags: totalActions,
        accepted_flags: totalAcc,
        dismissed_flags: totalDsm,
        created_at: new Date().toISOString()
      });

      // Remove from pending queue
      repo.queue.splice(flagIndex, 1);

      return {
        flag_id: flagId,
        new_status: action,
        repo_id: repoId,
        category: flag.category,
        updated_weight: catWeight?.weight || 0.5,
        updated_percentage: catWeight?.percentage || 50,
        repo_acceptance_rate: newRate,
        taste_explanation: `Updated ${flag.category} priority to ${catWeight?.percentage}% based on team action.`,
        weights: repo.weights
      };
    }
  }

  return null;
}

export function getServerTaste(repoId: string): TasteExplanation {
  const repo = GLOBAL_STATE[repoId] || GLOBAL_STATE['api-gateway'];
  const isApi = repo.id === 'api-gateway';

  return isApi ? {
    repo_name: 'api-gateway',
    headline: 'Hardened Backend Profile: High Security & Logic Vigilance',
    summary: 'This repo has learned to prioritize security (88%) and complexity (64%) issues — style nits are surfaced rarely. The team has dismissed 14 style flags, signaling that formatting is enforced by pre-commit tools rather than PR reviews.',
    priorities: ['Security', 'Complexity'],
    suppressed: ['Style'],
    confidence_level: 'High (Data-backed: 78% team alignment)',
    category_breakdown: repo.weights.map(w => ({
      category: w.category,
      percentage: w.percentage,
      weight: w.weight,
      accepts: w.accept_count,
      dismisses: w.dismiss_count,
      is_suppressed: w.suppressed
    })),
    recommendations: [
      'High Confidence: Security flags have an 88% acceptance rate. Sentry aggressively highlights credential leaks and injection risks.',
      'Suppression Active: Style weight is 22%. Minor naming and spacing nits are suppressed to prevent PR review fatigue.'
    ]
  } : {
    repo_name: repo.name,
    headline: 'Design System & UI Profile: Strict Consistency & DRY Standards',
    summary: 'This repo has learned to prioritize style (91%) and duplication (82%) issues — arbitrary styling and copy-pasted CSS tokens are rejected. The team values strict alignment with atomic design tokens.',
    priorities: ['Style', 'Duplication'],
    suppressed: ['Complexity'],
    confidence_level: 'High (Data-backed: 86% team alignment)',
    category_breakdown: repo.weights.map(w => ({
      category: w.category,
      percentage: w.percentage,
      weight: w.weight,
      accepts: w.accept_count,
      dismisses: w.dismiss_count,
      is_suppressed: w.suppressed
    })),
    recommendations: [
      'High Confidence: Style flags have a 91% acceptance rate. Sentry catches hardcoded hex colors and unconventional component props.',
      'DRY Enforcement: Duplication flags are accepted 82% of the time to keep component token maps unified.'
    ]
  };
}
