"""
Unit tests for Sentry v2 Multi-Language Analyzer and Heuristics.
Tests Python, JS/TS AST heuristic rules, unified diff patching, and severity-aware suppression.
"""
import pytest
from app.analyzer import (
    detect_language,
    parse_diff,
    run_heuristic_analysis,
    run_js_ts_heuristic_analysis,
    build_diff_patch,
    apply_weights_and_suppression
)


class TestLanguageDetection:
    def test_detect_python(self):
        assert detect_language("backend/auth.py") == "python"
        assert detect_language("diff --git a/test.py b/test.py") == "python"

    def test_detect_typescript(self):
        assert detect_language("components/UserProfile.tsx") == "typescript"
        assert detect_language("lib/session.ts") == "typescript"

    def test_detect_javascript(self):
        assert detect_language("routes/api.js") == "javascript"
        assert detect_language("legacy/helper.jsx") == "javascript"
        assert detect_language("server.mjs") == "javascript"


class TestJavaScriptTypeScriptHeuristics:
    def test_detects_dangerously_set_inner_html(self):
        diff = """--- a/components/Profile.tsx
+++ b/components/Profile.tsx
@@ -20,1 +20,1 @@
+  return <div dangerouslySetInnerHTML={{ __html: userBio }} />;
"""
        parsed = parse_diff(diff)
        flags = run_heuristic_analysis(parsed)
        security_flags = [f for f in flags if f["category"] == "security"]
        assert len(security_flags) >= 1
        assert "dangerouslySetInnerHTML" in security_flags[0]["title"]
        assert security_flags[0]["severity"] == "critical"

    def test_detects_unsound_any_cast(self):
        diff = """--- a/types/user.ts
+++ b/types/user.ts
@@ -10,1 +10,1 @@
+  const rawPayload: any = JSON.parse(req.body);
"""
        parsed = parse_diff(diff)
        flags = run_heuristic_analysis(parsed)
        any_flags = [f for f in flags if "Unsound TypeScript 'any'" in f["title"]]
        assert len(any_flags) >= 1
        assert any_flags[0]["category"] == "best-practice"

    def test_detects_loose_equality(self):
        diff = """--- a/services/auth.js
+++ b/services/auth.js
@@ -15,1 +15,1 @@
+  if (userRole == 'admin') {
"""
        parsed = parse_diff(diff)
        flags = run_heuristic_analysis(parsed)
        eq_flags = [f for f in flags if "Loose equality" in f["title"]]
        assert len(eq_flags) >= 1
        assert "===" in eq_flags[0]["proposed_fix"]

    def test_detects_local_storage_auth_token(self):
        diff = """--- a/services/auth.ts
+++ b/services/auth.ts
@@ -40,1 +40,1 @@
+  localStorage.setItem('auth_token', token);
"""
        parsed = parse_diff(diff)
        flags = run_heuristic_analysis(parsed)
        token_flags = [f for f in flags if "localStorage" in f["title"]]
        assert len(token_flags) >= 1
        assert token_flags[0]["category"] == "security"


class TestPythonHeuristics:
    def test_detects_sql_concatenation(self):
        diff = """--- a/db.py
+++ b/db.py
@@ -15,1 +15,1 @@
+  cursor.execute(f"SELECT * FROM users WHERE username = '{username}'")
"""
        parsed = parse_diff(diff)
        flags = run_heuristic_analysis(parsed)
        sql_flags = [f for f in flags if "SQL" in f["title"]]
        assert len(sql_flags) >= 1
        assert sql_flags[0]["severity"] == "critical"

    def test_detects_bare_except(self):
        diff = """--- a/worker.py
+++ b/worker.py
@@ -30,2 +30,2 @@
+  except:
+      pass
"""
        parsed = parse_diff(diff)
        flags = run_heuristic_analysis(parsed)
        except_flags = [f for f in flags if "Bare except" in f["title"]]
        assert len(except_flags) >= 1


class TestSeverityAwareSuppression:
    def test_critical_defect_never_suppressed_or_demoted(self):
        """Even if security weight is 10%, a critical vulnerability must NOT be demoted or hidden"""
        low_weights = [
            {"category": "security", "percentage": 10, "weight": 0.10, "accept_count": 1, "dismiss_count": 9, "suppressed": True},
            {"category": "style", "percentage": 20, "weight": 0.20, "accept_count": 2, "dismiss_count": 8, "suppressed": True}
        ]
        flags = [
            {
                "id": "crit-1",
                "category": "security",
                "severity": "critical",
                "title": "SQL Injection",
                "explanation": "Dangerous",
                "line_number": 10,
                "file_path": "auth.py"
            },
            {
                "id": "nit-1",
                "category": "style",
                "severity": "nit",
                "title": "Unused import",
                "explanation": "Nit",
                "line_number": 1,
                "file_path": "auth.py"
            }
        ]
        enriched = apply_weights_and_suppression(flags, low_weights, "api-gateway")

        crit_flag = next(f for f in enriched if f["id"] == "crit-1")
        assert crit_flag["suppressed"] is False
        assert crit_flag["demoted"] is False
        assert crit_flag["demoted"] is False

        nit_flag = next(f for f in enriched if f["id"] == "nit-1")
        assert nit_flag["demoted"] is True
        assert nit_flag["demoted"] is True
        assert "Demoted to low priority" in nit_flag["why_shown"]


class TestPatchBuilder:
    def test_builds_valid_unified_diff_header(self):
        patch = build_diff_patch("src/User.tsx", 15, "export const User = () => {};", "-const User = 1;\\n+export const User = () => {};")
        assert "--- a/src/User.tsx" in patch
        assert "+++ b/src/User.tsx" in patch
        assert "@@" in patch
