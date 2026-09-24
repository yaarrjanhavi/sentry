import { NextRequest, NextResponse } from 'next/server';
import { getServerRepoDetail } from '@/lib/serverLearning';
import { FlagItem } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { repoId: string } }
) {
  try {
    const repoId = params.repoId;
    const body = await request.json();
    const diff = body.diff_content || '';
    const title = body.diff_title || 'PR Review';

    const repo = getServerRepoDetail(repoId);
    const weightMap = new Map((repo?.weights || []).map(w => [w.category.toLowerCase(), w]));

    const detectedFlags: FlagItem[] = [];
    const lines = diff.split('\n');

    lines.forEach((line: string, index: number) => {
      const lineNo = index + 1;
      const stripped = line.trim();

      // Security: hardcoded secret / API key
      if (/(secret_key|api_key|password|jwt_secret)\s*=\s*['"][A-Za-z0-9_\-\.]{8,}['"]/i.test(stripped)) {
        detectedFlags.push({
          id: `flag-rev-${lineNo}-${Date.now()}`,
          repo_id: repoId,
          file_path: 'src/auth/session.py',
          line_number: lineNo,
          category: 'security',
          severity: 'critical',
          title: 'Hardcoded secret key in session.py',
          explanation: 'Credentials hardcoded directly in source control risk severe token compromise. Use environment variables.',
          proposed_fix: 'SECRET_KEY = os.environ.get("APP_SESSION_SECRET")',
          status: 'pending',
          confidence: 0.98,
          suppressed: false,
          repo_weight: weightMap.get('security')?.percentage || 80
        });
      }

      // Security: SQL injection
      if (/(execute|query|raw)\s*\(.*(SELECT|INSERT|UPDATE|DELETE).*\{.*\}|f['"].*(SELECT|INSERT)/i.test(stripped)) {
        detectedFlags.push({
          id: `flag-rev-sql-${lineNo}`,
          repo_id: repoId,
          file_path: 'src/utils/validate.py',
          line_number: lineNo,
          category: 'security',
          severity: 'critical',
          title: 'Unescaped string interpolation in SQL query',
          explanation: 'Directly interpolating variables into raw queries allows SQL injection attacks. Use parameterized queries.',
          proposed_fix: 'cursor.execute("SELECT * FROM accounts WHERE id = :id", {"id": user_id})',
          status: 'pending',
          confidence: 0.95,
          suppressed: false,
          repo_weight: weightMap.get('security')?.percentage || 80
        });
      }

      // Complexity: Redundant boolean condition
      if (/if\s+.*(==\s*True|==\s*False)/i.test(stripped)) {
        detectedFlags.push({
          id: `flag-rev-bool-${lineNo}`,
          repo_id: repoId,
          file_path: 'src/utils/validate.py',
          line_number: lineNo,
          category: 'complexity',
          severity: 'warning',
          title: 'Redundant boolean condition',
          explanation: 'Explicit comparison with == True or == False adds visual noise. Rely on boolean evaluation directly.',
          proposed_fix: 'if is_authenticated and not user.is_suspended:\n    return True',
          status: 'pending',
          confidence: 0.94,
          suppressed: (weightMap.get('complexity')?.percentage || 50) < 28,
          repo_weight: weightMap.get('complexity')?.percentage || 50
        });
      }

      // Style: Ambiguous function name
      if (/def\s+(fn|proc|do_stuff|temp|foo|d)\s*\(/i.test(stripped)) {
        detectedFlags.push({
          id: `flag-rev-style-${lineNo}`,
          repo_id: repoId,
          file_path: 'src/utils/validate.py',
          line_number: lineNo,
          category: 'style',
          severity: 'nit',
          title: 'Ambiguous function name',
          explanation: 'Short, non-descriptive identifiers obscure intent and degrade maintainability.',
          proposed_fix: 'def validate_user_payload(payload: dict):',
          status: 'pending',
          confidence: 0.88,
          suppressed: (weightMap.get('style')?.percentage || 30) < 28,
          repo_weight: weightMap.get('style')?.percentage || 30
        });
      }

      // Style: Raw hex color
      if (/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/.test(stripped) && !stripped.includes('//')) {
        detectedFlags.push({
          id: `flag-rev-hex-${lineNo}`,
          repo_id: repoId,
          file_path: 'packages/ui/src/Button.tsx',
          line_number: lineNo,
          category: 'style',
          severity: 'nit',
          title: 'Raw hex color bypasses theme token contract',
          explanation: 'Direct hex styling violates atomic design tokens. Reference theme token instead.',
          proposed_fix: 'className="bg-primary text-black font-semibold px-4 py-2 rounded-lg"',
          status: 'pending',
          confidence: 0.92,
          suppressed: (weightMap.get('style')?.percentage || 30) < 28,
          repo_weight: weightMap.get('style')?.percentage || 30
        });
      }

      // Duplication: duplicated token map
      if (/BREAKPOINTS\s*=/.test(stripped)) {
        detectedFlags.push({
          id: `flag-rev-dup-${lineNo}`,
          repo_id: repoId,
          file_path: 'packages/tokens/src/spacing.ts',
          line_number: lineNo,
          category: 'duplication',
          severity: 'warning',
          title: 'Duplicated breakpoint media-query map',
          explanation: 'Media query mapping is already declared in primitives/media.ts. Re-declaring invites token drift.',
          proposed_fix: 'export { BREAKPOINTS } from "@sentry-ui/primitives";',
          status: 'pending',
          confidence: 0.90,
          suppressed: (weightMap.get('duplication')?.percentage || 40) < 28,
          repo_weight: weightMap.get('duplication')?.percentage || 40
        });
      }
    });

    const suppressedCount = detectedFlags.filter(f => f.suppressed).length;

    return NextResponse.json({
      repo_id: repoId,
      diff_title: title,
      flags: detectedFlags,
      filtered_out_count: suppressedCount,
      total_detected: detectedFlags.length
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to review diff' }, { status: 500 });
  }
}
