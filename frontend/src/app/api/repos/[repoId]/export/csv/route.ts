import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: { repoId: string } }
) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/repos/${params.repoId}/export/csv`, {
      cache: 'no-store'
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to export CSV report' }, { status: res.status });
    }
    const csvContent = await res.text();
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=sentry-learning-${params.repoId}.csv`
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Backend connection error' }, { status: 500 });
  }
}
