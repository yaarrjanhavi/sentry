import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const repoId = searchParams.get('repo_id');
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';

    try {
      const url = repoId ? `${backendUrl}/api/github/events?repo_id=${repoId}` : `${backendUrl}/api/github/events`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (e) {
      // Fallback
    }

    return NextResponse.json([
      {
        id: "evt-sim-1",
        repo_id: repoId || "api-gateway",
        event_type: "pull_request",
        action: "opened",
        pr_number: 342,
        summary: "Auto-reviewed PR #342: Posted 3 inline flags (1 style flag suppressed)",
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: "evt-sim-2",
        repo_id: repoId || "api-gateway",
        event_type: "reaction",
        action: "accept",
        pr_number: 342,
        summary: "Developer reacted 👍 on Security flag: Tuned Security weight to 88%",
        created_at: new Date(Date.now() - 1800000).toISOString()
      }
    ]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch GitHub events' }, { status: 500 });
  }
}
