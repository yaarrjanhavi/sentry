"""
Unit tests for Sentry v2 LRU Cache, Sliding Token Rate Limiter, and Metrics Collector.
"""
import time
import pytest
from app.cache_and_ratelimit import AnalysisCache, TokenBucketRateLimiter, UsageMetricsCollector


class TestAnalysisCache:
    def test_cache_set_and_get(self):
        cache = AnalysisCache(max_size=10, ttl_seconds=60)
        cache.set("api-gateway", "diff +line1", {"flags": [1, 2]})
        cached = cache.get("api-gateway", "diff +line1")
        assert cached == {"flags": [1, 2]}
        assert cache.hits == 1
        assert cache.misses == 0

    def test_cache_miss(self):
        cache = AnalysisCache(max_size=10, ttl_seconds=60)
        res = cache.get("api-gateway", "non-existent diff")
        assert res is None
        assert cache.misses == 1

    def test_cache_ttl_expiration(self):
        cache = AnalysisCache(max_size=10, ttl_seconds=1)
        cache.set("api-gateway", "diff +line1", "value")
        time.sleep(1.1)
        assert cache.get("api-gateway", "diff +line1") is None
        assert cache.misses >= 1

    def test_lru_eviction(self):
        cache = AnalysisCache(max_size=2, ttl_seconds=60)
        cache.set("repo", "diff1", "v1")
        cache.set("repo", "diff2", "v2")
        cache.set("repo", "diff3", "v3")  # Evicts diff1

        assert cache.get("repo", "diff1") is None
        assert cache.get("repo", "diff2") == "v2"
        assert cache.get("repo", "diff3") == "v3"


class TestTokenBucketRateLimiter:
    def test_allowed_under_limit(self):
        limiter = TokenBucketRateLimiter(requests_per_minute=60, burst_limit=5)
        allowed, retry_after = limiter.check_rate_limit("test-client")
        assert allowed is True
        assert retry_after == 0

    def test_blocks_burst_exhaustion(self):
        limiter = TokenBucketRateLimiter(requests_per_minute=60, burst_limit=2)
        # 1st request
        limiter.check_rate_limit("client-a")
        # 2nd request
        limiter.check_rate_limit("client-a")
        # 3rd request should exceed burst
        allowed, retry_after = limiter.check_rate_limit("client-a")
        assert allowed is False
        assert retry_after > 0


class TestUsageMetricsCollector:
    def test_records_reviews_and_feedback(self):
        collector = UsageMetricsCollector()
        collector.record_review(lines_count=50, flags_count=3, duration_ms=45.2)
        collector.record_review(lines_count=80, flags_count=4, duration_ms=55.8)
        collector.record_feedback()
        collector.record_feedback()

        metrics = collector.get_metrics()
        assert metrics["total_diff_reviews"] == 2
        assert metrics["total_lines_analyzed"] == 130
        assert metrics["total_flags_generated"] == 7
        assert metrics["total_feedback_events"] == 2
        assert 45.0 <= metrics["average_review_latency_ms"] <= 56.0
