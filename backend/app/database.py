import sqlite3
import os
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sentry.db")


def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS repos (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS category_weights (
        id TEXT PRIMARY KEY,
        repo_id TEXT NOT NULL,
        category TEXT NOT NULL,
        weight REAL NOT NULL,
        percentage INTEGER NOT NULL,
        alpha REAL NOT NULL,
        beta REAL NOT NULL,
        accept_count INTEGER DEFAULT 0,
        dismiss_count INTEGER DEFAULT 0,
        not_relevant_count INTEGER DEFAULT 0,
        ci_lower REAL DEFAULT 0.0,
        ci_upper REAL DEFAULT 1.0,
        ci_percentage_lower INTEGER DEFAULT 0,
        ci_percentage_upper INTEGER DEFAULT 100,
        is_cold_start INTEGER DEFAULT 0,
        last_updated TEXT NOT NULL,
        FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE,
        UNIQUE(repo_id, category)
    );

    CREATE TABLE IF NOT EXISTS review_rounds (
        id TEXT PRIMARY KEY,
        repo_id TEXT NOT NULL,
        round_number INTEGER NOT NULL,
        diff_title TEXT NOT NULL,
        diff_content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS flags (
        id TEXT PRIMARY KEY,
        repo_id TEXT NOT NULL,
        round_id TEXT,
        file_path TEXT NOT NULL,
        line_number INTEGER NOT NULL,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        explanation TEXT NOT NULL,
        proposed_fix TEXT,
        status TEXT DEFAULT 'pending',
        confidence REAL DEFAULT 0.85,
        suppressed INTEGER DEFAULT 0,
        why_shown TEXT,
        github_comment_id TEXT,
        github_pr_id TEXT,
        created_at TEXT NOT NULL,
        reviewed_at TEXT,
        FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE,
        FOREIGN KEY (round_id) REFERENCES review_rounds(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS history_points (
        id TEXT PRIMARY KEY,
        repo_id TEXT NOT NULL,
        round_number INTEGER NOT NULL,
        acceptance_rate INTEGER NOT NULL,
        total_flags INTEGER NOT NULL,
        accepted_flags INTEGER NOT NULL,
        dismissed_flags INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS github_events (
        id TEXT PRIMARY KEY,
        repo_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        action TEXT,
        pr_number INTEGER,
        summary TEXT,
        payload TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flag_feedbacks (
        id TEXT PRIMARY KEY,
        repo_id TEXT NOT NULL,
        flag_id TEXT NOT NULL,
        category TEXT NOT NULL,
        action TEXT NOT NULL,
        reviewer_id TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviewers (
        id TEXT NOT NULL,
        repo_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        avatar_color TEXT DEFAULT '#3DFF6B',
        created_at TEXT NOT NULL,
        PRIMARY KEY (id, repo_id),
        FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviewer_weights (
        id TEXT PRIMARY KEY,
        reviewer_id TEXT NOT NULL,
        repo_id TEXT NOT NULL,
        category TEXT NOT NULL,
        weight REAL NOT NULL,
        percentage INTEGER NOT NULL,
        alpha REAL NOT NULL,
        beta REAL NOT NULL,
        accept_count INTEGER DEFAULT 0,
        dismiss_count INTEGER DEFAULT 0,
        not_relevant_count INTEGER DEFAULT 0,
        last_updated TEXT NOT NULL,
        FOREIGN KEY (reviewer_id) REFERENCES reviewers(id) ON DELETE CASCADE,
        FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE,
        UNIQUE(reviewer_id, repo_id, category)
    );
    """)

    # Non-destructive migrations for existing SQLite databases
    def add_column_if_missing(table: str, column: str, col_type: str):
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [row[1] for row in cursor.fetchall()]
        if column not in columns:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")

    add_column_if_missing("category_weights", "ci_lower", "REAL DEFAULT 0.0")
    add_column_if_missing("category_weights", "ci_upper", "REAL DEFAULT 1.0")
    add_column_if_missing("category_weights", "ci_percentage_lower", "INTEGER DEFAULT 0")
    add_column_if_missing("category_weights", "ci_percentage_upper", "INTEGER DEFAULT 100")
    add_column_if_missing("category_weights", "is_cold_start", "INTEGER DEFAULT 0")

    add_column_if_missing("flags", "why_shown", "TEXT")
    add_column_if_missing("flags", "github_comment_id", "TEXT")
    add_column_if_missing("flags", "github_pr_id", "TEXT")
    add_column_if_missing("flags", "demoted", "INTEGER DEFAULT 0")
    add_column_if_missing("flags", "suppression_reason", "TEXT")
    add_column_if_missing("flags", "diff_patch", "TEXT")
    add_column_if_missing("flags", "language", "TEXT DEFAULT 'python'")
    add_column_if_missing("flag_feedbacks", "reviewer_id", "TEXT")

    conn.commit()
    conn.close()


def get_all_repos() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM repos ORDER BY name ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_repo_by_id(repo_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM repos WHERE id = ? OR name = ?", (repo_id, repo_id))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def create_repo(name: str, description: str = "") -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    repo_id = name.lower().replace(" ", "-")
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT INTO repos (id, name, description, created_at) VALUES (?, ?, ?, ?)",
        (repo_id, name, description, now)
    )
    conn.commit()
    conn.close()
    return {"id": repo_id, "name": name, "description": description, "created_at": now}


def get_repo_weights(repo_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM category_weights WHERE repo_id = ? ORDER BY weight DESC",
        (repo_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def set_category_weight(
    repo_id: str,
    category: str,
    weight: float,
    percentage: int,
    alpha: float,
    beta: float,
    accept_count: int,
    dismiss_count: int,
    not_relevant_count: int,
    ci_lower: float = 0.0,
    ci_upper: float = 1.0,
    ci_percentage_lower: int = 0,
    ci_percentage_upper: int = 100,
    is_cold_start: bool = False
):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    weight_id = f"{repo_id}-{category}"
    cursor.execute("""
        INSERT INTO category_weights 
        (id, repo_id, category, weight, percentage, alpha, beta, accept_count, dismiss_count, not_relevant_count,
         ci_lower, ci_upper, ci_percentage_lower, ci_percentage_upper, is_cold_start, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(repo_id, category) DO UPDATE SET
            weight = excluded.weight,
            percentage = excluded.percentage,
            alpha = excluded.alpha,
            beta = excluded.beta,
            accept_count = excluded.accept_count,
            dismiss_count = excluded.dismiss_count,
            not_relevant_count = excluded.not_relevant_count,
            ci_lower = excluded.ci_lower,
            ci_upper = excluded.ci_upper,
            ci_percentage_lower = excluded.ci_percentage_lower,
            ci_percentage_upper = excluded.ci_percentage_upper,
            is_cold_start = excluded.is_cold_start,
            last_updated = excluded.last_updated
    """, (
        weight_id, repo_id, category, weight, percentage, alpha, beta,
        accept_count, dismiss_count, not_relevant_count,
        ci_lower, ci_upper, ci_percentage_lower, ci_percentage_upper,
        1 if is_cold_start else 0, now
    ))
    conn.commit()
    conn.close()


def get_repo_history(repo_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM history_points WHERE repo_id = ? ORDER BY round_number ASC",
        (repo_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_history_point(repo_id: str, round_number: int, acceptance_rate: int, total_flags: int, accepted_flags: int, dismissed_flags: int):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO history_points (id, repo_id, round_number, acceptance_rate, total_flags, accepted_flags, dismissed_flags, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (str(uuid.uuid4()), repo_id, round_number, acceptance_rate, total_flags, accepted_flags, dismissed_flags, now))
    conn.commit()
    conn.close()


def get_pending_queue(repo_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM flags 
        WHERE repo_id = ? AND status = 'pending'
        ORDER BY 
            CASE severity 
                WHEN 'critical' THEN 1 
                WHEN 'warning' THEN 2 
                ELSE 3 
            END ASC,
            created_at DESC
    """, (repo_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_flag_by_id(flag_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM flags WHERE id = ?", (flag_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def update_flag_status(flag_id: str, new_status: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "UPDATE flags SET status = ?, reviewed_at = ? WHERE id = ?",
        (new_status, now, flag_id)
    )
    conn.commit()
    cursor.execute("SELECT * FROM flags WHERE id = ?", (flag_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def insert_flags(flags: List[Dict[str, Any]]):
    conn = get_connection()
    cursor = conn.cursor()
    for f in flags:
        cursor.execute("""
            INSERT INTO flags (
                id, repo_id, round_id, file_path, line_number, category, severity,
                title, explanation, proposed_fix, status, confidence, suppressed,
                demoted, suppression_reason, diff_patch, language,
                why_shown, github_comment_id, github_pr_id, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            f.get("id", str(uuid.uuid4())),
            f["repo_id"],
            f.get("round_id"),
            f["file_path"],
            f["line_number"],
            f["category"],
            f["severity"],
            f["title"],
            f["explanation"],
            f.get("proposed_fix", ""),
            f.get("status", "pending"),
            f.get("confidence", 0.85),
            1 if f.get("suppressed") else 0,
            1 if f.get("demoted") else 0,
            f.get("suppression_reason"),
            f.get("diff_patch"),
            f.get("language", "python"),
            f.get("why_shown", ""),
            f.get("github_comment_id"),
            f.get("github_pr_id"),
            f.get("created_at", datetime.utcnow().isoformat())
        ))
    conn.commit()
    conn.close()


def create_round(repo_id: str, round_number: int, diff_title: str, diff_content: str) -> str:
    conn = get_connection()
    cursor = conn.cursor()
    round_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO review_rounds (id, repo_id, round_number, diff_title, diff_content, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (round_id, repo_id, round_number, diff_title, diff_content, now))
    conn.commit()
    conn.close()
    return round_id


def record_feedback_event(repo_id: str, flag_id: str, category: str, action: str, reviewer_id: Optional[str] = None):
    """Logs individual feedback action timestamp for time-decay modeling and audit history"""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO flag_feedbacks (id, repo_id, flag_id, category, action, reviewer_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (str(uuid.uuid4()), repo_id, flag_id, category, action, reviewer_id, now))
    conn.commit()
    conn.close()


def record_github_event(repo_id: str, event_type: str, action: Optional[str], pr_number: Optional[int], summary: str, payload_json: str) -> str:
    """Logs GitHub App / Webhook invocation"""
    conn = get_connection()
    cursor = conn.cursor()
    event_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO github_events (id, repo_id, event_type, action, pr_number, summary, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (event_id, repo_id, event_type, action, pr_number, summary, payload_json, now))
    conn.commit()
    conn.close()
    return event_id


def get_github_events(repo_id: Optional[str] = None, limit: int = 25) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    if repo_id:
        cursor.execute("SELECT * FROM github_events WHERE repo_id = ? ORDER BY created_at DESC LIMIT ?", (repo_id, limit))
    else:
        cursor.execute("SELECT * FROM github_events ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_flag_by_github_comment(comment_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM flags WHERE github_comment_id = ?", (str(comment_id),))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def update_flag_github_comment(flag_id: str, github_comment_id: str, github_pr_id: Optional[str] = None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE flags SET github_comment_id = ?, github_pr_id = ? WHERE id = ?
    """, (str(github_comment_id), str(github_pr_id) if github_pr_id else None, flag_id))
    conn.commit()
    conn.close()



# ----------------- REVIEWER PROFILES & WEIGHTS -----------------

def get_repo_reviewers(repo_id: str) -> List[Dict[str, Any]]:
    """Retrieves all teammate reviewer profiles configured for this repo"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM reviewers WHERE repo_id = ? ORDER BY name ASC
    """, (repo_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_reviewer_by_id(reviewer_id: str, repo_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    if repo_id:
        cursor.execute("""
            SELECT * FROM reviewers WHERE id = ? AND repo_id = ?
        """, (reviewer_id, repo_id))
    else:
        cursor.execute("""
            SELECT * FROM reviewers WHERE id = ? LIMIT 1
        """, (reviewer_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def create_reviewer(repo_id: str, reviewer_id: str, name: str, role: str, avatar_color: str = "#3DFF6B") -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT OR REPLACE INTO reviewers (id, repo_id, name, role, avatar_color, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (reviewer_id, repo_id, name, role, avatar_color, now))
    conn.commit()
    conn.close()
    return {"id": reviewer_id, "repo_id": repo_id, "name": name, "role": role, "avatar_color": avatar_color, "created_at": now}


def get_reviewer_weights(reviewer_id: str, repo_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    if repo_id:
        cursor.execute("""
            SELECT * FROM reviewer_weights WHERE reviewer_id = ? AND repo_id = ? ORDER BY weight DESC
        """, (reviewer_id, repo_id))
    else:
        cursor.execute("""
            SELECT * FROM reviewer_weights WHERE reviewer_id = ? ORDER BY weight DESC
        """, (reviewer_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def set_reviewer_weight(
    reviewer_id: str,
    repo_id: str,
    category: str,
    weight: float,
    percentage: int,
    alpha: float,
    beta: float,
    accept_count: int,
    dismiss_count: int,
    not_relevant_count: int = 0
):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    weight_id = f"{reviewer_id}_{repo_id}_{category}"
    cursor.execute("""
        INSERT INTO reviewer_weights (
            id, reviewer_id, repo_id, category, weight, percentage,
            alpha, beta, accept_count, dismiss_count, not_relevant_count, last_updated
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(reviewer_id, repo_id, category) DO UPDATE SET
            weight = excluded.weight,
            percentage = excluded.percentage,
            alpha = excluded.alpha,
            beta = excluded.beta,
            accept_count = excluded.accept_count,
            dismiss_count = excluded.dismiss_count,
            not_relevant_count = excluded.not_relevant_count,
            last_updated = excluded.last_updated
    """, (
        weight_id, reviewer_id, repo_id, category, weight, percentage,
        alpha, beta, accept_count, dismiss_count, not_relevant_count, now
    ))
    conn.commit()
    conn.close()


def apply_fix_flag(flag_id: str, note: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Marks flag as accepted and creates virtual git branch/commit for one-click patch application"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM flags WHERE id = ?", (flag_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    flag = dict(row)
    now = datetime.utcnow().isoformat()
    cursor.execute("UPDATE flags SET status = 'accepted', reviewed_at = ? WHERE id = ?", (now, flag_id))
    conn.commit()
    conn.close()

    branch_name = f"sentry/fix-{flag['category']}-{flag_id[:8]}"
    commit_sha = f"{uuid.uuid4().hex[:7]}"
    return {
        "flag_id": flag_id,
        "status": "applied",
        "branch_name": branch_name,
        "commit_sha": commit_sha,
        "diff_patch": flag.get("diff_patch") or f"--- a/{flag['file_path']}\n+++ b/{flag['file_path']}\n@@ -{flag['line_number']},1 +{flag['line_number']},1 @@\n+{flag.get('proposed_fix', '')}",
        "file_path": flag["file_path"],
        "message": f"Successfully applied suggested fix to {flag['file_path']}:{flag['line_number']} on branch {branch_name}"
    }
