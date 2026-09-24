import { NextRequest, NextResponse } from 'next/server';
import { getServerRepoDetail } from '@/lib/serverLearning';

export async function POST(
  request: NextRequest,
  { params }: { params: { repoId: string } }
) {
  const repoId = params.repoId;
  const repo = getServerRepoDetail(repoId);
  if (!repo) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }

  // Reset weights to cold start defaults
  repo.weights = [
    { category: 'security', weight: 0.80, percentage: 80, alpha: 8, beta: 2, accept_count: 0, dismiss_count: 0, not_relevant_count: 0, suppressed: false, color_token: 'accent' },
    { category: 'best-practice', weight: 0.60, percentage: 60, alpha: 6, beta: 4, accept_count: 0, dismiss_count: 0, not_relevant_count: 0, suppressed: false, color_token: 'accent' },
    { category: 'complexity', weight: 0.50, percentage: 50, alpha: 5, beta: 5, accept_count: 0, dismiss_count: 0, not_relevant_count: 0, suppressed: false, color_token: 'primary' },
    { category: 'duplication', weight: 0.40, percentage: 40, alpha: 4, beta: 6, accept_count: 0, dismiss_count: 0, not_relevant_count: 0, suppressed: false, color_token: 'muted' },
    { category: 'style', weight: 0.30, percentage: 30, alpha: 3, beta: 7, accept_count: 0, dismiss_count: 0, not_relevant_count: 0, suppressed: false, color_token: 'dark-muted' }
  ];
  repo.history = [{ round_number: 1, acceptance_rate: 50, total_flags: 0, accepted_flags: 0, dismissed_flags: 0, created_at: new Date().toISOString() }];

  return NextResponse.json({ status: 'success', message: `Repo ${repoId} reset to cold-start defaults` });
}
