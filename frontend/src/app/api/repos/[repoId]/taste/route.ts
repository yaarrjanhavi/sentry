import { NextRequest, NextResponse } from 'next/server';
import { getServerTaste } from '@/lib/serverLearning';

export async function GET(
  request: NextRequest,
  { params }: { params: { repoId: string } }
) {
  const repoId = params.repoId;
  const taste = getServerTaste(repoId);
  return NextResponse.json(taste);
}
