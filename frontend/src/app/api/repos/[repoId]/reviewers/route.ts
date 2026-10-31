import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: { repoId: string } }
) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/repos/${params.repoId}/reviewers`, {
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    // Fallback simulation
  }

  // Fallback demo reviewers
  const defaultReviewers = [
    {
      id: "sarah-chen",
      repo_id: params.repoId,
      name: "Sarah Chen",
      role: "Staff Security Engineer",
      avatar_color: "#A855F7",
      current_acceptance_rate: 65,
      top_category: "Security",
      top_category_weight: 94,
      weights: [
        { category: "security", weight: 0.94, percentage: 94, alpha: 30, beta: 2, accept_count: 30, dismiss_count: 2, not_relevant_count: 0, suppressed: false, color_token: "accent", ci_percentage_lower: 87, ci_percentage_upper: 98, is_cold_start: false, total_feedback: 32 },
        { category: "complexity", weight: 0.82, percentage: 82, alpha: 23, beta: 5, accept_count: 23, dismiss_count: 5, not_relevant_count: 0, suppressed: false, color_token: "primary", ci_percentage_lower: 70, ci_percentage_upper: 94, is_cold_start: false, total_feedback: 28 },
        { category: "best-practice", weight: 0.70, percentage: 70, alpha: 14, beta: 6, accept_count: 14, dismiss_count: 6, not_relevant_count: 0, suppressed: false, color_token: "accent", ci_percentage_lower: 54, ci_percentage_upper: 86, is_cold_start: false, total_feedback: 20 },
        { category: "duplication", weight: 0.40, percentage: 40, alpha: 8, beta: 12, accept_count: 8, dismiss_count: 12, not_relevant_count: 0, suppressed: false, color_token: "muted", ci_percentage_lower: 22, ci_percentage_upper: 58, is_cold_start: false, total_feedback: 20 },
        { category: "style", weight: 0.15, percentage: 15, alpha: 3, beta: 17, accept_count: 3, dismiss_count: 17, not_relevant_count: 0, suppressed: true, color_token: "dark-muted", ci_percentage_lower: 2, ci_percentage_upper: 28, is_cold_start: false, total_feedback: 20 }
      ],
      total_reviews_count: 120,
      taste_summary: "Sarah Chen prioritizes Security (94%) based on 120 reviews."
    },
    {
      id: "alex-rivera",
      repo_id: params.repoId,
      name: "Alex Rivera",
      role: "Frontend & API Platform",
      avatar_color: "#3DFF6B",
      current_acceptance_rate: 76,
      top_category: "Style",
      top_category_weight: 85,
      weights: [
        { category: "style", weight: 0.85, percentage: 85, alpha: 22, beta: 4, accept_count: 22, dismiss_count: 4, not_relevant_count: 0, suppressed: false, color_token: "dark-muted", ci_percentage_lower: 72, ci_percentage_upper: 95, is_cold_start: false, total_feedback: 26 },
        { category: "best-practice", weight: 0.75, percentage: 75, alpha: 18, beta: 6, accept_count: 18, dismiss_count: 6, not_relevant_count: 0, suppressed: false, color_token: "accent", ci_percentage_lower: 60, ci_percentage_upper: 88, is_cold_start: false, total_feedback: 24 },
        { category: "security", weight: 0.70, percentage: 70, alpha: 14, beta: 6, accept_count: 14, dismiss_count: 6, not_relevant_count: 0, suppressed: false, color_token: "accent", ci_percentage_lower: 54, ci_percentage_upper: 86, is_cold_start: false, total_feedback: 20 },
        { category: "complexity", weight: 0.65, percentage: 65, alpha: 15, beta: 8, accept_count: 15, dismiss_count: 8, not_relevant_count: 0, suppressed: false, color_token: "primary", ci_percentage_lower: 48, ci_percentage_upper: 80, is_cold_start: false, total_feedback: 23 },
        { category: "duplication", weight: 0.60, percentage: 60, alpha: 12, beta: 8, accept_count: 12, dismiss_count: 8, not_relevant_count: 0, suppressed: false, color_token: "muted", ci_percentage_lower: 42, ci_percentage_upper: 76, is_cold_start: false, total_feedback: 20 }
      ],
      total_reviews_count: 113,
      taste_summary: "Alex Rivera prioritizes Style & Architecture (85%) based on 113 reviews."
    },
    {
      id: "david-kim",
      repo_id: params.repoId,
      name: "David Kim",
      role: "Infra & Reliability Lead",
      avatar_color: "#38BDF8",
      current_acceptance_rate: 71,
      top_category: "Best-practice",
      top_category_weight: 90,
      weights: [
        { category: "best-practice", weight: 0.90, percentage: 90, alpha: 27, beta: 3, accept_count: 27, dismiss_count: 3, not_relevant_count: 0, suppressed: false, color_token: "accent", ci_percentage_lower: 81, ci_percentage_upper: 98, is_cold_start: false, total_feedback: 30 },
        { category: "security", weight: 0.88, percentage: 88, alpha: 22, beta: 3, accept_count: 22, dismiss_count: 3, not_relevant_count: 0, suppressed: false, color_token: "accent", ci_percentage_lower: 78, ci_percentage_upper: 98, is_cold_start: false, total_feedback: 25 },
        { category: "complexity", weight: 0.75, percentage: 75, alpha: 18, beta: 6, accept_count: 18, dismiss_count: 6, not_relevant_count: 0, suppressed: false, color_token: "primary", ci_percentage_lower: 61, ci_percentage_upper: 89, is_cold_start: false, total_feedback: 24 },
        { category: "duplication", weight: 0.55, percentage: 55, alpha: 11, beta: 9, accept_count: 11, dismiss_count: 9, not_relevant_count: 0, suppressed: false, color_token: "muted", ci_percentage_lower: 37, ci_percentage_upper: 73, is_cold_start: false, total_feedback: 20 },
        { category: "style", weight: 0.30, percentage: 30, alpha: 6, beta: 14, accept_count: 6, dismiss_count: 14, not_relevant_count: 0, suppressed: false, color_token: "dark-muted", ci_percentage_lower: 14, ci_percentage_upper: 46, is_cold_start: false, total_feedback: 20 }
      ],
      total_reviews_count: 119,
      taste_summary: "David Kim prioritizes Best-practice (90%) based on 119 reviews."
    }
  ];

  return NextResponse.json(defaultReviewers);
}
