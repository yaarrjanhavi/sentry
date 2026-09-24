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
  repo_weight?: number;
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
}

export interface RepoDetail extends RepoSummary {
  history: HistoryPoint[];
  queue: FlagItem[];
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
  weights: CategoryWeight[];
}

export interface TasteExplanation {
  repo_name: string;
  headline: string;
  summary: string;
  priorities: string[];
  suppressed: string[];
  confidence_level: string;
  category_breakdown: Array<{
    category: string;
    percentage: number;
    weight: number;
    accepts: number;
    dismisses: number;
    is_suppressed: boolean;
  }>;
  recommendations: string[];
}
