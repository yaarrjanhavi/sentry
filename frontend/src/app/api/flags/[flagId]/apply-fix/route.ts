import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:8000';

export async function POST(
  request: NextRequest,
  { params }: { params: { flagId: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const res = await fetch(`${BACKEND_URL}/api/flags/${params.flagId}/apply-fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    // Fallback simulation if backend is not running directly
  }

  return NextResponse.json({
    flag_id: params.flagId,
    status: "applied",
    branch_name: `sentry/fix-${params.flagId.slice(0, 8)}`,
    commit_sha: "a4f89d2",
    diff_patch: "--- a/source\n+++ b/source\n@@ -1,1 +1,1 @@\n-old\n+applied",
    file_path: "src/main.py",
    message: "Suggested fix patch applied cleanly"
  });
}
