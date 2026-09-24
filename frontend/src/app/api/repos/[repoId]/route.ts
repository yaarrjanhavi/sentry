import { NextRequest, NextResponse } from 'next/server';
import { getServerRepoDetail } from '@/lib/serverLearning';

export async function GET(
  request: NextRequest,
  { params }: { params: { repoId: string } }
) {
  const repoId = params.repoId;
  const detail = getServerRepoDetail(repoId);
  if (!detail) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }
  return NextResponse.json(detail);
}
