"""
Integration tests for Sentry v2 FastAPI Endpoints.
Covers Repos, Reviewers, Flag Actions, Suggested Fixes, Replay Benchmark, Compare, and Webhook.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.github_integration import generate_github_signature

client = TestClient(app)


class TestRepositoryEndpoints:
    def test_list_repositories(self):
        res = client.get("/api/repos")
        assert res.status_code == 200
        repos = res.json()
        assert len(repos) >= 2
        repo_ids = [r["id"] for r in repos]
        assert "api-gateway" in repo_ids
        assert "design-system" in repo_ids

    def test_get_repository_detail(self):
        res = client.get("/api/repos/api-gateway")
        assert res.status_code == 200
        detail = res.json()
        assert detail["id"] == "api-gateway"
        assert len(detail["weights"]) >= 5
        assert len(detail["reviewers"]) >= 2
        assert "history" in detail
        assert "queue" in detail

    def test_nonexistent_repository_returns_404(self):
        res = client.get("/api/repos/nonexistent-xyz")
        assert res.status_code == 404


class TestFlagActionsAndUtility:
    def test_flag_action_accept_updates_weights(self):
        # 1. Get queue
        res = client.get("/api/repos/api-gateway")
        queue = res.json()["queue"]
        assert len(queue) > 0
        flag = queue[0]

        # 2. Accept flag under Sarah Chen's profile
        action_res = client.post(
            f"/api/flags/{flag['id']}/action",
            json={"action": "accept", "reviewer_id": "sarah-chen"}
        )
        assert action_res.status_code == 200
        data = action_res.json()
        assert data["new_status"] in ["accept", "accepted"]
        assert "updated_percentage" in data
        assert data["reviewer_profile"]["id"] == "sarah-chen"

    def test_apply_suggested_fix(self):
        res = client.get("/api/repos/api-gateway")
        queue = res.json()["queue"]
        flag = queue[0]

        fix_res = client.post(
            f"/api/flags/{flag['id']}/apply-fix",
            json={"note": "Applied via automated test"}
        )
        assert fix_res.status_code == 200
        data = fix_res.json()
        assert data["status"] == "applied"
        assert "sentry/fix-" in data["branch_name"]
        assert len(data["commit_sha"]) == 7


class TestBenchmarkProof:
    def test_run_offline_replay_benchmark(self):
        res = client.post("/api/benchmark/replay")
        assert res.status_code == 200
        data = res.json()
        assert data["rounds_count"] == 10
        assert data["learned_final_precision"] > data["baseline_final_precision"]
        assert data["noise_reduction_pct"] > 50.0
        assert data["learned_final_fpr"] < data["baseline_final_fpr"]
        assert len(data["rounds"]) == 10


class TestProductPolishEndpoints:
    def test_compare_repositories(self):
        res = client.get("/api/repos/api-gateway/compare/design-system")
        assert res.status_code == 200
        data = res.json()
        assert data["divergence_score"] > 0
        assert len(data["categories"]) >= 4
        assert len(data["key_differences"]) >= 1

    def test_export_csv_report(self):
        res = client.get("/api/repos/api-gateway/export/csv")
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        assert "ROUND-BY-ROUND" in res.text
        assert "BAYESIAN CATEGORY" in res.text

    def test_system_metrics_endpoint(self):
        res = client.get("/api/system/metrics")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "operational"
        assert "system" in data
        assert "cache" in data


class TestGitHubWebhookSecurity:
    def test_rejects_missing_or_invalid_signature(self, monkeypatch):
        monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", "test-secret-1234")
        res = client.post(
            "/api/github/webhook",
            json={"action": "opened"},
            headers={"X-GitHub-Event": "pull_request", "X-Hub-Signature-256": "sha256=invalid"}
        )
        assert res.status_code == 401

    def test_accepts_valid_hmac_signature(self):
        import json
        payload_bytes = json.dumps({"action": "opened", "pull_request": {"number": 999, "head": {"sha": "abc1234"}}, "repository": {"name": "api-gateway"}}).encode("utf-8")
        sig = generate_github_signature(payload_bytes)

        res = client.post(
            "/api/github/webhook",
            content=payload_bytes,
            headers={
                "Content-Type": "application/json",
                "X-GitHub-Event": "pull_request",
                "X-Hub-Signature-256": sig
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
