"""
Rate Limiting, In-Memory Caching, and Usage Telemetry for Sentry v2.
Ensures scalable, deterministic diff analysis with zero redundant computation.
"""
import time
import hashlib
from typing import Dict, Any, Optional, Tuple, List
from collections import OrderedDict
import threading


class AnalysisCache:
    """
    LRU In-Memory Cache with TTL expiration for code diff reviews.
    Eliminates redundant AST parses and LLM/heuristic reviews on repeated PR pushes.
    """
    def __init__(self, max_size: int = 500, ttl_seconds: int = 1800):
        self.max_size = max_size
        self.ttl = ttl_seconds
        self.cache: OrderedDict[str, Tuple[float, Any]] = OrderedDict()
        self.lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def _hash_key(self, repo_id: str, diff_content: str, reviewer_id: Optional[str] = None) -> str:
        raw = f"{repo_id}:{reviewer_id or ''}:{diff_content.strip()}"
        return hashlib.sha256(raw.encode('utf-8')).hexdigest()

    def get(self, repo_id: str, diff_content: str, reviewer_id: Optional[str] = None) -> Optional[Any]:
        key = self._hash_key(repo_id, diff_content, reviewer_id)
        with self.lock:
            if key not in self.cache:
                self.misses += 1
                return None

            timestamp, value = self.cache[key]
            if time.time() - timestamp > self.ttl:
                del self.cache[key]
                self.misses += 1
                return None

            # Move to end (most recently used)
            self.cache.move_to_end(key)
            self.hits += 1
            return value

    def set(self, repo_id: str, diff_content: str, value: Any, reviewer_id: Optional[str] = None):
        key = self._hash_key(repo_id, diff_content, reviewer_id)
        with self.lock:
            if key in self.cache:
                self.cache.move_to_end(key)
            self.cache[key] = (time.time(), value)

            if len(self.cache) > self.max_size:
                self.cache.popitem(last=False)  # Evict least recently used

    def get_stats(self) -> Dict[str, Any]:
        with self.lock:
            total = self.hits + self.misses
            hit_rate = round((self.hits / total * 100), 1) if total > 0 else 0.0
            return {
                "cached_items_count": len(self.cache),
                "total_lookups": total,
                "hits": self.hits,
                "misses": self.misses,
                "hit_rate_pct": hit_rate
            }

    def clear(self):
        with self.lock:
            self.cache.clear()
            self.hits = 0
            self.misses = 0


class TokenBucketRateLimiter:
    """
    Sliding window token-bucket rate limiter.
    Prevents API denial-of-service and protects downstream review resources.
    """
    def __init__(self, requests_per_minute: int = 60, burst_limit: int = 15):
        self.rate = requests_per_minute / 60.0  # tokens per second
        self.capacity = burst_limit
        self.buckets: Dict[str, Tuple[float, float]] = {}  # key -> (tokens, last_time)
        self.lock = threading.Lock()

    def check_rate_limit(self, client_id: str = "default") -> Tuple[bool, int]:
        """
        Returns (is_allowed, retry_after_seconds)
        """
        now = time.time()
        with self.lock:
            if client_id not in self.buckets:
                self.buckets[client_id] = (self.capacity - 1, now)
                return True, 0

            tokens, last_time = self.buckets[client_id]
            elapsed = now - last_time
            tokens = min(self.capacity, tokens + elapsed * self.rate)

            if tokens >= 1.0:
                self.buckets[client_id] = (tokens - 1.0, now)
                return True, 0
            else:
                retry_after = int((1.0 - tokens) / self.rate) + 1
                self.buckets[client_id] = (tokens, now)
                return False, retry_after


class UsageMetricsCollector:
    """
    Tracks structured throughput, latency, and flag telemetry.
    """
    def __init__(self):
        self.start_time = time.time()
        self.total_diff_reviews = 0
        self.total_lines_analyzed = 0
        self.total_flags_generated = 0
        self.total_feedback_events = 0
        self.latencies: List[float] = []
        self.lock = threading.Lock()

    def record_review(self, lines_count: int, flags_count: int, duration_ms: float):
        with self.lock:
            self.total_diff_reviews += 1
            self.total_lines_analyzed += lines_count
            self.total_flags_generated += flags_count
            self.latencies.append(duration_ms)
            if len(self.latencies) > 200:
                self.latencies.pop(0)

    def record_feedback(self):
        with self.lock:
            self.total_feedback_events += 1

    def get_metrics(self) -> Dict[str, Any]:
        with self.lock:
            uptime = int(time.time() - self.start_time)
            avg_latency = round(sum(self.latencies) / len(self.latencies), 1) if self.latencies else 0.0
            return {
                "uptime_seconds": uptime,
                "total_diff_reviews": self.total_diff_reviews,
                "total_lines_analyzed": self.total_lines_analyzed,
                "total_flags_generated": self.total_flags_generated,
                "total_feedback_events": self.total_feedback_events,
                "average_review_latency_ms": avg_latency
            }


# Global Singletons
analysis_cache = AnalysisCache(max_size=500, ttl_seconds=1800)
rate_limiter = TokenBucketRateLimiter(requests_per_minute=120, burst_limit=30)
usage_metrics = UsageMetricsCollector()
