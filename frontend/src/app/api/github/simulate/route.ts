import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';

    try {
      const res = await fetch(`${backendUrl}/api/github/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (e) {
      // Fallback
    }

    const eventType = body.event_type || 'pull_request';
    if (eventType === 'pull_request') {
      return NextResponse.json({
        status: 'success',
        event: 'pull_request',
        action: body.action || 'opened',
        repo_id: body.repository?.name || 'api-gateway',
        pr_number: body.pull_request?.number || 42,
        flags_detected: 4,
        flags_posted: 3,
        flags_suppressed: 1,
        round_id: 'gh-sim-round-' + Math.random().toString(36).substring(7)
      });
    } else {
      return NextResponse.json({
        status: 'success',
        event: 'reaction',
        action: 'accept',
        category: 'security',
        repo_id: body.repository?.name || 'api-gateway',
        flag_id: 'flag-api-1',
        updated_percentage: 90,
        summary: 'Tuned security to 90% via GitHub reaction (+1)'
      });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to simulate GitHub event' }, { status: 500 });
  }
}
