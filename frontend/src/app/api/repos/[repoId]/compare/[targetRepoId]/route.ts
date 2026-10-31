import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: { repoId: string; targetRepoId: string } }
) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/repos/${params.repoId}/compare/${params.targetRepoId}`, {
      cache: 'no-store'
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to compare repositories' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Backend connection error' }, { status: 500 });
  }
}
