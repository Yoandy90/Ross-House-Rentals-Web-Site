"""
middleware.py — CORS & Rate Limiting configuration
Extracted from server.py for cleaner architecture.
"""

import time
import os
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from fastapi import Request

# ═══════════════════════════════════════════════════════════════
# CORS — Allowed Origins
# ═══════════════════════════════════════════════════════════════
ALLOWED_ORIGINS = [
    "https://www.rosstaxpreparation.com",
    "https://rosstaxpreparation.com",
    "https://ross-tax-website.vercel.app",
    "https://www.rosshouserentals.com",
    "https://rosshouserentals.com",
    "https://ross-house-rentals.vercel.app",
    "https://www.micasousa.com",
    "https://micasousa.com",
    "https://micasousa-web.vercel.app",
    "https://banking-filter-hub.preview.emergentagent.com",
    "exp://",
]


def setup_cors(app):
    """Apply CORS middleware to the FastAPI app."""
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=ALLOWED_ORIGINS,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["*"],
    )


# ═══════════════════════════════════════════════════════════════
# Rate Limiting — Endpoint-specific in-memory limiter
# ═══════════════════════════════════════════════════════════════
_RATE_LIMITS = {
    '/api/auth/login':                     (5, 60),
    '/api/auth/register':                  (3, 60),
    '/api/auth/phone/send-otp':            (3, 120),
    '/api/auth/phone/verify-otp':          (5, 60),
    '/api/auth/reset-password-token':      (3, 300),
    '/api/public/analytics/pageview':      (30, 60),
    '/api/stripe/create-checkout-session': (5, 60),
}

_rate_store: dict = {}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        limit_config = None
        for route, config in _RATE_LIMITS.items():
            if path == route:
                limit_config = config
                break

        if limit_config and request.method == 'POST':
            max_requests, window_seconds = limit_config
            ip = request.client.host if request.client else "unknown"
            now = time.time()

            if ip not in _rate_store:
                _rate_store[ip] = {}
            if path not in _rate_store[ip]:
                _rate_store[ip][path] = []

            _rate_store[ip][path] = [t for t in _rate_store[ip][path] if now - t < window_seconds]

            if len(_rate_store[ip][path]) >= max_requests:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Demasiados intentos. Espera un momento antes de intentar de nuevo."}
                )

            _rate_store[ip][path].append(now)

            if len(_rate_store) > 10000:
                oldest_ips = list(_rate_store.keys())[:5000]
                for old_ip in oldest_ips:
                    del _rate_store[old_ip]

        return await call_next(request)


def setup_rate_limiting(app):
    """Apply rate limiting middleware to the FastAPI app."""
    try:
        from slowapi import Limiter, _rate_limit_exceeded_handler
        from slowapi.util import get_remote_address
        from slowapi.errors import RateLimitExceeded

        limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")
        app.state.limiter = limiter
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        app.add_middleware(RateLimitMiddleware)
        print("✅ Rate limiting initialized with endpoint-specific limits")
        return limiter
    except (ImportError, Exception) as e:
        print(f"⚠️ Rate limiting not available: {e}")

        class DummyLimiter:
            def limit(self, *args, **kwargs):
                def decorator(func):
                    return func
                return decorator

        app.add_middleware(RateLimitMiddleware)
        return DummyLimiter()


def apply_all_middleware(app):
    """Apply all middleware in the correct order."""
    limiter = setup_rate_limiting(app)
    setup_cors(app)
    return limiter
