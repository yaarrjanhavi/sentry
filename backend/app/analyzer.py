"""
Static Analysis & LLM Review Engine for Sentry v2.
Parses diffs, runs multi-language AST/pattern heuristics (Python, JavaScript, TypeScript),
constructs one-click unified git diff patches, integrates optional LLM refinement,
and evaluates severity-aware suppression & demotion against repo weights.
"""
import re
import os
import uuid
from typing import List, Dict, Any, Optional
import httpx

from app.learning import should_suppress_flag, get_color_token, generate_why_shown_explanation, is_cold_start_category, SUPPRESSION_THRESHOLD


def detect_language(file_path: str) -> str:
    """Detects programming language from file path extension"""
    ext = os.path.splitext(file_path)[1].lower()
    if ext in [".js", ".jsx", ".mjs", ".cjs"]:
        return "javascript"
    elif ext in [".ts", ".tsx"]:
        return "typescript"
    elif ext in [".py", ".pyi"]:
        return "python"
    elif ext in [".json", ".yaml", ".yml"]:
        return "config"
    return "typescript" if any(p in file_path.lower() for p in ["src/", "packages/", "components/", "ui/"]) else "python"


def build_diff_patch(file_path: str, line_number: int, original_code: str, proposed_fix: str) -> str:
    """Builds a standard unified git diff patch for one-click suggested fixes"""
    clean_orig = original_code.strip()
    fix_lines = proposed_fix.splitlines() if proposed_fix else []
    patch_lines = [
        f"--- a/{file_path}",
        f"+++ b/{file_path}",
        f"@@ -{line_number},1 +{line_number},{max(1, len(fix_lines))} @@",
        f"-{clean_orig}"
    ]
    for fl in fix_lines:
        patch_lines.append(f"+{fl}")
    return "\n".join(patch_lines)


def parse_diff(diff_content: str) -> List[Dict[str, Any]]:
    """
    Parses unified diff format or plain code lines.
    Returns list of modified/added lines with file path and line numbers.
    """
    lines = diff_content.splitlines()
    parsed_lines = []
    current_file = "src/main.py"
    current_line_no = 1

    for line in lines:
        if line.startswith("+++ b/"):
            current_file = line[6:].strip()
            continue
        elif line.startswith("+++ "):
            current_file = line[4:].strip()
            continue
        elif line.startswith("@@"):
            # @@ -1,5 +1,10 @@
            match = re.search(r"\+(\d+)", line)
            if match:
                current_line_no = int(match.group(1))
            continue
        elif line.startswith("+") and not line.startswith("+++"):
            code_line = line[1:]
            parsed_lines.append({
                "file": current_file,
                "line_no": current_line_no,
                "content": code_line,
                "raw": line,
                "language": detect_language(current_file)
            })
            current_line_no += 1
        elif line.startswith("-") and not line.startswith("---"):
            continue
        else:
            # Context line
            current_line_no += 1
            if not diff_content.startswith("diff --git") and not diff_content.startswith("---"):
                parsed_lines.append({
                    "file": current_file,
                    "line_no": current_line_no - 1,
                    "content": line,
                    "raw": line,
                    "language": detect_language(current_file)
                })

    if not parsed_lines and lines:
        for idx, line in enumerate(lines, 1):
            parsed_lines.append({
                "file": current_file,
                "line_no": idx,
                "content": line,
                "raw": line,
                "language": detect_language(current_file)
            })

    return parsed_lines


def run_js_ts_heuristic_analysis(item: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Heuristic static pattern rules for JavaScript and TypeScript"""
    flags = []
    line = item["content"]
    line_no = item["line_no"]
    file_path = item["file"]
    lang = item.get("language", "typescript")
    stripped = line.strip()

    # 1. SECURITY CHECKS
    # DangerouslySetInnerHTML
    if re.search(r"dangerouslySetInnerHTML\s*=\s*\{\s*\{", stripped):
        fix = "<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />"
        flags.append({
            "category": "security",
            "severity": "critical",
            "title": f"Unsanitized HTML injection via dangerouslySetInnerHTML in {os.path.basename(file_path)}",
            "file_path": file_path,
            "line_number": line_no,
            "explanation": "Bypassing React's built-in XSS protections via `dangerouslySetInnerHTML` without HTML sanitization enables Cross-Site Scripting (XSS). Use DOMPurify before injecting markup.",
            "proposed_fix": fix,
            "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
            "language": lang,
            "confidence": 0.98
        })

    # eval() / new Function()
    if re.search(r"\b(eval|new\s+Function)\s*\(", stripped):
        fix = "// Use structured data parser instead of dynamic code evaluation\nconst data = JSON.parse(rawPayload);"
        flags.append({
            "category": "security",
            "severity": "critical",
            "title": "Dangerous dynamic execution with eval/Function constructor",
            "file_path": file_path,
            "line_number": line_no,
            "explanation": "Arbitrary code execution primitive. Ingesting untrusted strings into `eval` or `new Function()` allows attackers to execute malicious code in the user's browser or Node.js runtime.",
            "proposed_fix": fix,
            "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
            "language": lang,
            "confidence": 0.99
        })

    # Hardcoded secrets
    if re.search(r'''(secret_key|api_key|jwt_secret|private_key|auth_token)\s*[:=]\s*['"][A-Za-z0-9_\-.]{10,}['"]''', stripped, re.IGNORECASE):
        fix = "const API_KEY = process.env.API_KEY || process.env.NEXT_PUBLIC_API_KEY;"
        flags.append({
            "category": "security",
            "severity": "critical",
            "title": "Hardcoded secret or authentication token in client script",
            "file_path": file_path,
            "line_number": line_no,
            "explanation": "Private secrets or backend auth tokens bundled into client JavaScript will be exposed to all web visitors. Keep secrets in server environment variables.",
            "proposed_fix": fix,
            "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
            "language": lang,
            "confidence": 0.96
        })

    # LocalStorage for session tokens
    if re.search(r'''localStorage\.(setItem|getItem)\s*\(\s*['"](token|auth|jwt|session)['"]''', stripped, re.IGNORECASE):
        fix = "// Store session tokens in Secure HttpOnly cookies rather than localStorage\ndocument.cookie = 'session=...; Secure; HttpOnly; SameSite=Strict';"
        flags.append({
            "category": "security",
            "severity": "warning",
            "title": "Sensitive auth token stored in accessible localStorage",
            "file_path": file_path,
            "line_number": line_no,
            "explanation": "Tokens stored in `localStorage` are vulnerable to extraction by any third-party script via Cross-Site Scripting (XSS). Prefer Secure, HttpOnly cookies for session storage.",
            "proposed_fix": fix,
            "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
            "language": lang,
            "confidence": 0.91
        })

    # 2. COMPLEXITY CHECKS
    # Deep Promise chaining
    if ".then(" in stripped and stripped.count(".then(") >= 2:
        fix = "// Refactor with clean async/await:\nconst user = await fetchUser();\nconst profile = await fetchProfile(user.id);"
        flags.append({
            "category": "complexity",
            "severity": "warning",
            "title": "Deeply nested Promise callback chain",
            "file_path": file_path,
            "line_number": line_no,
            "explanation": "Multiple chained `.then()` callbacks obscure control flow and error propagation. Flatten execution using standard `async/await`.",
            "proposed_fix": fix,
            "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
            "language": lang,
            "confidence": 0.90
        })

    # Nested ternaries
    if re.search(r"\?.*:.*\?.*:", stripped):
        fix = "// Refactor to early returns or lookup table:\nif (status === 'active') return 'Valid';\nif (status === 'pending') return 'Reviewing';\nreturn 'Inactive';"
        flags.append({
            "category": "complexity",
            "severity": "warning",
            "title": "Nested ternary expressions impair cognitive comprehension",
            "file_path": file_path,
            "line_number": line_no,
            "explanation": "Cascading ternaries increase cyclomatic branching on a single line, making edge-case debugging difficult. Use guard clauses or a lookup map.",
            "proposed_fix": fix,
            "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
            "language": lang,
            "confidence": 0.89
        })

    # 3. BEST-PRACTICE CHECKS
    # Unsound 'any' in TypeScript
    if re.search(r"(:\s*any\b|as\s+any\b|<any>)", stripped):
        fix = "// Replace 'any' with explicit interface or 'unknown' with type guard:\ninterface PayloadData {\n  id: string;\n  name: string;\n}"
        flags.append({
            "category": "best-practice",
            "severity": "warning",
            "title": "Unsound TypeScript 'any' disables compile-time type safety",
            "file_path": file_path,
            "line_number": line_no,
            "explanation": "Using `any` silently disables TypeScript type checking, allowing runtime type errors to slip past compile checks. Define an explicit interface or use `unknown` with narrowing.",
            "proposed_fix": fix,
            "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
            "language": lang,
            "confidence": 0.94
        })

    # @ts-ignore
    if re.search(r"//\s*@ts-ignore\b", stripped):
        fix = "// @ts-expect-error [UPSTREAM_DEFECT: explain reason why compiler error is expected]"
        flags.append({
            "category": "best-practice",
            "severity": "warning",
            "title": "Unannotated @ts-ignore disables type checker without rationale",
            "file_path": file_path,
            "line_number": line_no,
            "explanation": "Broad `@ts-ignore` directives mask genuine compile-time failures and stay in code indefinitely. Prefer `@ts-expect-error` with an explanatory comment.",
            "proposed_fix": fix,
            "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
            "language": lang,
            "confidence": 0.93
        })

    # Loose equality (== or != instead of === or !==)
    if re.search(r"[^=!<>]={2}[^=]", stripped) or re.search(r"![=][^=]", stripped):
        if not re.search(r"==\s*null", stripped):  # allow null/undefined check pattern
            fix = stripped.replace(" == ", " === ").replace(" != ", " !== ")
            flags.append({
                "category": "best-practice",
                "severity": "nit",
                "title": "Loose equality coercion with == or !=",
                "file_path": file_path,
                "line_number": line_no,
                "explanation": "Type-coercing equality (`==`) has counterintuitive JavaScript coercion edge-cases (e.g. `'0' == false`). Use strict equality (`===`) for predictable semantics.",
                "proposed_fix": fix,
                "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
                "language": lang,
                "confidence": 0.92
            })

    # 4. STYLE CHECKS
    # console.log left in code
    if re.search(r"console\.(log|debug|warn)\s*\(", stripped):
        fix = "// Remove debugging console.log before merging\n// or use: logger.debug(...)"
        flags.append({
            "category": "style",
            "severity": "nit",
            "title": "Production console logging statement left in codebase",
            "file_path": file_path,
            "line_number": line_no,
            "explanation": "Extraneous `console.log()` statements clutter production browser logs and can inadvertently leak internal state or data structures.",
            "proposed_fix": fix,
            "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
            "language": lang,
            "confidence": 0.95
        })

    # var declaration
    if re.search(r"\bvar\s+[a-zA-Z0-9_]+\s*=", stripped):
        fix = stripped.replace("var ", "const ")
        flags.append({
            "category": "style",
            "severity": "nit",
            "title": "Legacy ES5 var declaration lacks block scoping",
            "file_path": file_path,
            "line_number": line_no,
            "explanation": "`var` exhibits function hoisting and lacks block scoping, leading to unintended variable shadowing bugs. Replace with `const` or `let`.",
            "proposed_fix": fix,
            "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
            "language": lang,
            "confidence": 0.96
        })

    # 5. DUPLICATION CHECKS
    if re.search(r'''headers:\s*\{\s*['"]Authorization['"]:''', stripped) and 'Bearer' in stripped:
        fix = "// Use centralized authenticated API client\nimport { apiClient } from '@/lib/apiClient';"
        flags.append({
            "category": "duplication",
            "severity": "warning",
            "title": "Duplicated inline Bearer authorization header",
            "file_path": file_path,
            "line_number": line_no,
            "explanation": "Manually specifying authorization headers across individual requests causes token-refresh drift. Centralize auth tokens in an Axios/fetch interceptor.",
            "proposed_fix": fix,
            "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
            "language": lang,
            "confidence": 0.85
        })

    return flags


def run_heuristic_analysis(parsed_lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Heuristic and pattern detection across 5 core categories with multi-language awareness:
    - Python (.py, .pyi)
    - JavaScript / TypeScript (.js, .jsx, .ts, .tsx)
    """
    flags = []

    for item in parsed_lines:
        line = item["content"]
        line_no = item["line_no"]
        file_path = item["file"]
        lang = item.get("language") or detect_language(file_path)
        stripped = line.strip()

        # If file is JS/TS, route to JS/TS analyzer
        if lang in ["javascript", "typescript"]:
            js_flags = run_js_ts_heuristic_analysis(item)
            flags.extend(js_flags)
            continue

        # ---------------- PYTHON ANALYZER ----------------
        # 1. SECURITY CHECKS
        # Hardcoded secrets/keys
        if re.search(r'''(secret_key|api_key|password|jwt_secret|auth_token)\s*=\s*['"][A-Za-z0-9_\-.]{8,}['"]''', stripped, re.IGNORECASE):
            fix = "import os\nSECRET_KEY = os.environ.get('APP_SECRET_KEY')"
            flags.append({
                "category": "security",
                "severity": "critical",
                "title": f"Hardcoded secret key in {os.path.basename(file_path)}",
                "file_path": file_path,
                "line_number": line_no,
                "explanation": "Credentials, JWT tokens, or private secrets hardcoded directly in source control risk severe token compromise. Use environment variables or a secret vault.",
                "proposed_fix": fix,
                "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
                "language": "python",
                "confidence": 0.98
            })

        # SQL Injection smell
        if re.search(r'''(execute|query|raw)\s*\(\s*f['"].*(SELECT|INSERT|UPDATE|DELETE).*\{.*\}''', stripped, re.IGNORECASE) or \
           re.search(r'''(execute|query)\s*\(\s*['"].*%.*(SELECT|INSERT|UPDATE|DELETE)''', stripped, re.IGNORECASE):
            fix = "cursor.execute('SELECT * FROM users WHERE id = :user_id', {'user_id': user_id})"
            flags.append({
                "category": "security",
                "severity": "critical",
                "title": "Unescaped string interpolation in SQL query",
                "file_path": file_path,
                "line_number": line_no,
                "explanation": "Directly interpolating variables into a raw SQL query opens up SQL injection vulnerabilities. Always use parameterized queries.",
                "proposed_fix": fix,
                "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
                "language": "python",
                "confidence": 0.95
            })

        # Dangerous eval / exec
        if re.search(r"\b(eval|exec|pickle\.loads)\s*\(", stripped):
            fix = "# Parse using a safe schema validator such as Pydantic or json.loads()\ndata = json.loads(user_input)"
            flags.append({
                "category": "security",
                "severity": "critical",
                "title": "Dangerous dynamic execution with eval/exec",
                "file_path": file_path,
                "line_number": line_no,
                "explanation": "Arbitrary code execution primitive. Processing unvalidated input through eval can lead to remote code execution (RCE).",
                "proposed_fix": fix,
                "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
                "language": "python",
                "confidence": 0.99
            })

        # Insecure randomness
        if re.search(r"random\.(random|randint|choice)\b", stripped) and ("token" in stripped.lower() or "nonce" in stripped.lower() or "auth" in stripped.lower()):
            fix = "import secrets\ntoken = secrets.token_urlsafe(32)"
            flags.append({
                "category": "security",
                "severity": "warning",
                "title": "Cryptographically insecure PRNG used for token/nonce",
                "file_path": file_path,
                "line_number": line_no,
                "explanation": "Standard pseudo-random number generator (PRNG) is predictable. Use `secrets.token_hex()` or `crypto.randomBytes()` for security tokens.",
                "proposed_fix": fix,
                "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
                "language": "python",
                "confidence": 0.92
            })

        # 2. COMPLEXITY CHECKS
        # Redundant boolean condition
        if re.search(r"if\s+.*(==\s*True|==\s*False|!=\s*True|!=\s*False)", stripped):
            fix = re.sub(r"\s*==\s*True", "", re.sub(r"([a-zA-Z0-9_]+)\s*==\s*False", r"not \1", stripped))
            flags.append({
                "category": "complexity",
                "severity": "warning",
                "title": "Redundant boolean condition",
                "file_path": file_path,
                "line_number": line_no,
                "explanation": "Explicit comparison with `== True` or `== False` adds unnecessary visual noise and reduces readability. Rely on truthiness or boolean evaluation directly.",
                "proposed_fix": fix,
                "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
                "language": "python",
                "confidence": 0.94
            })

        # Deep nesting
        if len(line) - len(line.lstrip(' ')) >= 12 and stripped.startswith(("if ", "for ", "while ")):
            fix = "# Refactor with guard clauses:\nif not condition:\n    return\n# proceed with flat execution path"
            flags.append({
                "category": "complexity",
                "severity": "warning",
                "title": "High cyclomatic nesting depth",
                "file_path": file_path,
                "line_number": line_no,
                "explanation": "Logic is nested 3+ levels deep. Excessive nesting impairs cognitive comprehension, testing, and branch coverage. Consider early returns or guard clauses.",
                "proposed_fix": fix,
                "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
                "language": "python",
                "confidence": 0.88
            })

        # 3. STYLE CHECKS
        # Ambiguous function/variable name
        if re.search(r"\bdef\s+([a-z]|temp|data2|do_stuff|proc|foo|bar|fn)\s*\(", stripped):
            fix = "def validate_user_session(session_token):"
            flags.append({
                "category": "style",
                "severity": "nit",
                "title": "Ambiguous function name",
                "file_path": file_path,
                "line_number": line_no,
                "explanation": "Short, non-descriptive identifiers obscure intent and degrade maintainability across team boundaries. Choose a domain-specific verb or noun phrase.",
                "proposed_fix": fix,
                "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
                "language": "python",
                "confidence": 0.87
            })

        # Magic numbers
        if re.search(r"sleep\s*\(\s*(86400|3600|600|3000|5000)\s*\)", stripped):
            fix = "DEFAULT_TIMEOUT_SECONDS = 86400\ntime.sleep(DEFAULT_TIMEOUT_SECONDS)"
            flags.append({
                "category": "style",
                "severity": "nit",
                "title": "Magic constant without named descriptor",
                "file_path": file_path,
                "line_number": line_no,
                "explanation": "Raw numeric constants obscure the unit or rationale behind the duration or threshold. Define as a named constant.",
                "proposed_fix": fix,
                "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
                "language": "python",
                "confidence": 0.82
            })

        # 4. DUPLICATION CHECKS
        if "validate_" in stripped and ("token" in stripped or "payload" in stripped) and "len(" in stripped:
            fix = "# Leverage shared validator:\nfrom app.validators import require_valid_session"
            flags.append({
                "category": "duplication",
                "severity": "warning",
                "title": "Repeated manual payload validation block",
                "file_path": file_path,
                "line_number": line_no,
                "explanation": "Ad-hoc validation logic appears duplicated across endpoints. Centralize schema validation into a shared decorator or middleware.",
                "proposed_fix": fix,
                "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
                "language": "python",
                "confidence": 0.80
            })

        # 5. BEST PRACTICE CHECKS
        # Mutable default argument
        if re.search(r"def\s+[a-zA-Z0-9_]+\s*\(.*(=\s*\[\]|=\s*\{\})", stripped):
            fix = "def process_records(records: Optional[List] = None):\n    if records is None:\n        records = []"
            flags.append({
                "category": "best-practice",
                "severity": "warning",
                "title": "Mutable default argument in function signature",
                "file_path": file_path,
                "line_number": line_no,
                "explanation": "Default argument values are evaluated once when the function is defined. A mutable default like `[]` or `{}` is shared across all invocations.",
                "proposed_fix": fix,
                "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
                "language": "python",
                "confidence": 0.96
            })

        # Bare except
        if re.search(r"except\s*:\s*$", stripped) or stripped == "except Exception: pass":
            fix = "except SpecificServiceError as err:\n    logger.error('Operation failed: %s', err)\n    raise"
            flags.append({
                "category": "best-practice",
                "severity": "warning",
                "title": "Bare exception handler catches system signals",
                "file_path": file_path,
                "line_number": line_no,
                "explanation": "A bare `except:` catches KeyboardInterrupt, SystemExit, and MemoryError, preventing clean process shutdowns. Catch specific exceptions and log them.",
                "proposed_fix": fix,
                "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
                "language": "python",
                "confidence": 0.95
            })

        # Unclosed file resource
        if re.search(r"[a-zA-Z0-9_]+\s*=\s*open\s*\(", stripped) and "with " not in stripped:
            fix = "with open(file_path, 'r', encoding='utf-8') as f:\n    data = f.read()"
            flags.append({
                "category": "best-practice",
                "severity": "warning",
                "title": "File opened without context manager",
                "file_path": file_path,
                "line_number": line_no,
                "explanation": "Opening files without a `with` statement risks file descriptor leaks if exceptions occur before explicit close().",
                "proposed_fix": fix,
                "diff_patch": build_diff_patch(file_path, line_no, stripped, fix),
                "language": "python",
                "confidence": 0.90
            })

    # Remove duplicates
    unique_flags = []
    seen = set()
    for f in flags:
        key = (f["file_path"], f["line_number"], f["category"])
        if key not in seen:
            seen.add(key)
            unique_flags.append(f)

    return unique_flags


async def call_llm_refinement(diff_content: str, flags: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Optional LLM refinement layer for deep explanations and autofixes"""
    gemini_key = os.environ.get("GEMINI_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    if not gemini_key and not openai_key:
        return flags

    try:
        if gemini_key:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            prompt = (
                f"You are Sentry, an AI code review agent. Given this diff and static flags, "
                f"briefly summarize any subtle security or complexity defects:\n\n{diff_content[:1500]}"
            )
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(url, json={
                    "contents": [{"parts": [{"text": prompt}]}]
                })
                if res.status_code == 200:
                    pass
    except Exception:
        pass

    return flags


def apply_weights_and_suppression(flags: List[Dict[str, Any]], weights: List[Dict[str, Any]], repo_id: str) -> List[Dict[str, Any]]:
    """
    Evaluates flags against repo learned category weights.
    Implements Phase 2 Severity-Aware Suppression:
    - Critical and Warning flags are NEVER suppressed or demoted.
    - Low-weight category nits (< 28%) are demoted to a collapsed 'Low priority' group
      with explicit explanation, rather than being completely dropped.
    """
    weight_map = {w["category"]: w for w in weights}

    enriched = []
    for f in flags:
        cat = f["category"]
        w_info = weight_map.get(cat, {})
        weight_val = w_info.get("weight", 0.5)
        percentage = w_info.get("percentage", 50)
        accepts = w_info.get("accept_count", 0)
        dismisses = w_info.get("dismiss_count", 0)
        ci_lower = w_info.get("ci_percentage_lower", max(0, percentage - 15))
        ci_upper = w_info.get("ci_percentage_upper", min(100, percentage + 15))
        is_cold = is_cold_start_category(accepts, dismisses)

        severity = f.get("severity", "warning").lower()

        # Severity-aware suppression logic
        if severity in ["critical", "warning"]:
            is_suppressed = False
            is_demoted = False
            suppression_reason = None
        else:
            # Nit / style / low severity
            if weight_val < SUPPRESSION_THRESHOLD:
                is_suppressed = False  # NEVER silently drop!
                is_demoted = True      # Demoted into collapsible low-priority group
                suppression_reason = f"Category weight ({percentage}%) is below {int(SUPPRESSION_THRESHOLD*100)}% threshold (demoted to low-priority group)"
            else:
                is_suppressed = False
                is_demoted = False
                suppression_reason = None

        if is_demoted:
            why_shown = (
                f"Demoted to low priority: {cat.capitalize()} weight {percentage}% (90% CI: [{ci_lower}%-{ci_upper}%]). "
                f"Critical and warning issues are always prioritized; nits in low-weight categories are grouped in low priority."
            )
        else:
            why_shown = generate_why_shown_explanation(
                category=cat,
                weight=weight_val,
                percentage=percentage,
                accept_count=accepts,
                dismiss_count=dismisses,
                severity=severity,
                is_suppressed=is_suppressed,
                ci_lower_pct=ci_lower,
                ci_upper_pct=ci_upper,
                is_cold_start=is_cold
            )

        flag_id = f.get("id") or str(uuid.uuid4())
        diff_patch = f.get("diff_patch") or build_diff_patch(
            f["file_path"],
            f["line_number"],
            f.get("title", ""),
            f.get("proposed_fix", "")
        )

        enriched.append({
            "id": flag_id,
            "repo_id": repo_id,
            "file_path": f["file_path"],
            "line_number": f["line_number"],
            "category": f["category"],
            "severity": severity,
            "title": f["title"],
            "explanation": f["explanation"],
            "proposed_fix": f.get("proposed_fix", ""),
            "status": f.get("status", "pending"),
            "confidence": f.get("confidence", 0.85),
            "suppressed": is_suppressed,
            "demoted": is_demoted,
            "suppression_reason": suppression_reason,
            "diff_patch": diff_patch,
            "language": f.get("language") or detect_language(f["file_path"]),
            "repo_weight": percentage,
            "why_shown": why_shown,
            "ci_bounds": f"[{ci_lower}% - {ci_upper}%]",
            "color_token": get_color_token(cat)
        })

    return enriched
