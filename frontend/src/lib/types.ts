export interface CategoryWeight {
  category: string;
  weight: number;
  percentage: number;
  alpha: number;
  beta: number;
  accept_count: number;
  dismiss_count: number;
  not_relevant_count: number;
  suppressed: boolean;
  color_token: string;
  ci_lower?: number;
  ci_upper?: number;
  ci_percentage_lower?: number;
  ci_percentage_upper?: number;
  is_cold_start?: boolean;
  total_feedback?: number;
  ci_bounds?: [number, number];
  accepts?: number;
  dismisses?: number;
  is_suppressed?: boolean;
}

export interface HistoryPoint {
  round_number: number;
  acceptance_rate: number;
  total_flags: number;
  accepted_flags: number;
  dismissed_flags: number;
  created_at: string;
}

export interface FlagItem {
  id: string;
  repo_id: string;
  round_id?: string;
  file_path: string;
  line_number: number;
  category: 'security' | 'complexity' | 'style' | 'duplication' | 'best-practice' | string;
  severity: 'critical' | 'warning' | 'nit' | string;
  title: string;
  explanation: string;
  proposed_fix?: string;
  status: 'pending' | 'accepted' | 'dismissed' | 'not_relevant' | string;
  confidence: number;
  suppressed: boolean;
  demoted?: boolean;
  suppression_reason?: string;
  diff_patch?: string;
  language?: string;
  repo_weight?: number;
  why_shown?: string;
  ci_bounds?: string;
  github_comment_id?: string;
  github_pr_id?: string;
  created_at?: string;
}

export interface RepoSummary {
  id: string;
  name: string;
  description: string;
  created_at: string;
  current_acceptance_rate: number;
  trend_text: string;
  flags_this_week: number;
  top_category: string;
  top_category_weight: number;
  weights: CategoryWeight[];
  is_cold_start?: boolean;
  total_reviews_count?: number;
}


export interface ReviewerProfile {
  id: string;
  repo_id: string;
  name: string;
  role: string;
  avatar_color?: string;
  current_acceptance_rate: number;
  top_category: string;
  top_category_weight: number;
  weights: CategoryWeight[];
  total_reviews_count: number;
  taste_summary?: string;
}

export interface ApplyFixResponse {
  flag_id: string;
  status: string;
  branch_name: string;
  commit_sha: string;
  diff_patch: string;
  file_path: string;
  message: string;
}

export interface RepoDetail extends RepoSummary {
  history: HistoryPoint[];
  queue: FlagItem[];
  reviewers?: ReviewerProfile[];
}

export interface ActionResponse {
  flag_id: string;
  new_status: string;
  repo_id: string;
  category: string;
  updated_weight: number;
  updated_percentage: number;
  repo_acceptance_rate: number;
  taste_explanation: string;
  why_shown?: string;
  weights: CategoryWeight[];
  reviewer_profile?: ReviewerProfile;
}

export interface TasteExplanation {
  repo_name: string;
  headline: string;
  summary: string;
  priorities: string[];
  suppressed: string[];
  confidence_level: string;
  is_cold_start?: boolean;
  category_breakdown: Array<{
    category: string;
    percentage: number;
    weight: number;
    accepts: number;
    dismisses: number;
    accept_count?: number;
    dismiss_count?: number;
    is_suppressed: boolean;
    suppressed?: boolean;
    ci_lower?: number;
    ci_upper?: number;
    ci_bounds?: [number, number];
    is_cold_start?: boolean;
  }>;
  recommendations: string[];
}

export interface BenchmarkRoundResult {
  round_number: number;
  round_title: string;
  total_flags: number;
  learned_shown: number;
  learned_accepted: number;
  learned_dismissed: number;
  learned_precision: number;
  learned_acceptance_rate: number;
  learned_fpr: number;
  baseline_shown: number;
  baseline_accepted: number;
  baseline_dismissed: number;
  baseline_precision: number;
  baseline_acceptance_rate: number;
  baseline_fpr: number;
}

export interface BenchmarkSummaryResponse {
  repo_name: string;
  scenario_name: string;
  total_rounds: number;
  total_flags_evaluated: number;
  learned_final_precision: number;
  baseline_final_precision: number;
  precision_gain: number;
  learned_final_fpr: number;
  baseline_final_fpr: number;
  noise_reduction_pct: number;
  rounds: BenchmarkRoundResult[];
  category_weights_progression: Record<string, number[]>;
}

export interface GitHubEventItem {
  id: string;
  repo_id: string;
  event_type: string;
  action?: string;
  pr_number?: number;
  summary: string;
  payload?: string;
  created_at: string;
}



export interface CategoryComparisonItem {
  category: string;
  source_percentage: number;
  target_percentage: number;
  difference: number;
  favored_by: string;
}

export interface RepoCompareResponse {
  source_repo_id: string;
  source_repo_name: string;
  target_repo_id: string;
  target_repo_name: string;
  divergence_score: number;
  source_top_category: string;
  target_top_category: string;
  key_differences: string[];
  categories: CategoryComparisonItem[];
}

export interface DemoConvergenceResponse {
  status: string;
  message: string;
  repos_seeded: string[];
}
