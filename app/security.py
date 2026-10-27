import os
import secrets
import time
from collections import defaultdict, deque

from fastapi import Header, HTTPException, Query, Request, status

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def require_admin_for_writes(request: Request, x_api_key: str | None = Header(default=None)):
    # Applied router-wide: reads stay public, every write needs X-API-Key to
    # match ADMIN_API_KEY. Without ADMIN_API_KEY set, writes are closed.
    if request.method in _SAFE_METHODS:
        return
    admin_key = os.getenv("ADMIN_API_KEY")
    if not admin_key or not x_api_key or not secrets.compare_digest(x_api_key, admin_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This demo is read-only. Write operations require an admin API key."
        )


class Pagination:
    def __init__(self, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=100)):
        self.skip = skip
        self.limit = limit

    def apply(self, query, order_column):
        return query.order_by(order_column).offset(self.skip).limit(self.limit)


def client_ip(request: Request) -> str:
    # Railway's edge overwrites X-Real-IP with the caller's address on every
    # request, so clients cannot spoof it. X-Forwarded-For ends in a rotating
    # internal proxy IP, which would split one visitor across many buckets.
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


class RateLimiter:
    """In-memory sliding-window limiter: per client IP plus a global cap.

    Single-process only, which matches the one-worker Railway deployment.
    State resets on restart, so the Anthropic spend cap is the final backstop.
    Usable directly as a route dependency: Depends(limiter).
    """

    def __init__(self, per_ip: int, per_ip_window: int, global_max: int, global_window: int):
        self.per_ip = per_ip
        self.per_ip_window = per_ip_window
        self.global_max = global_max
        self.global_window = global_window
        self._hits: dict[str, deque] = defaultdict(deque)
        self._global: deque = deque()
        self._last_sweep = time.monotonic()

    @staticmethod
    def _prune(hits: deque, window: int, now: float):
        while hits and now - hits[0] > window:
            hits.popleft()

    def _sweep(self, now: float):
        # Drop IPs with no hits inside the window, at most once per window.
        if now - self._last_sweep < self.per_ip_window:
            return
        self._hits = defaultdict(deque, {
            ip: hits for ip, hits in self._hits.items() if now - hits[-1] <= self.per_ip_window
        })
        self._last_sweep = now

    def __call__(self, request: Request):
        now = time.monotonic()
        self._sweep(now)
        self._prune(self._global, self.global_window, now)
        ip = client_ip(request)
        hits = self._hits.get(ip, deque())
        self._prune(hits, self.per_ip_window, now)
        if len(hits) >= self.per_ip or len(self._global) >= self.global_max:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later."
            )
        hits.append(now)
        self._hits[ip] = hits
        self._global.append(now)
