import { NextResponse } from 'next/server';
import { getServerRepos } from '@/lib/serverLearning';

export async function GET() {
  const repos = getServerRepos();
  return NextResponse.json(repos);
}
