import { NextRequest, NextResponse } from 'next/server';
import { updateServerFlagAction } from '@/lib/serverLearning';

export async function POST(
  request: NextRequest,
  { params }: { params: { flagId: string } }
) {
  try {
    const flagId = params.flagId;
    const body = await request.json();
    const action = body.action;

    const result = updateServerFlagAction(flagId, action);
    if (!result) {
      return NextResponse.json({ error: 'Flag not found or already processed' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to process flag feedback' }, { status: 500 });
  }
}
