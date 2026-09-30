import hmac
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Literal

import jwt

from app.core.config import get_settings

TokenType = Literal["access", "refresh"]


def verify_admin_credentials(email: str, password: str) -> bool:
    settings = get_settings()
    # Constant-time comparison for both fields to avoid timing leaks
    email_ok = hmac.compare_digest(email.strip().lower(), settings.admin_email.lower())
    password_ok = hmac.compare_digest(password.encode(), settings.admin_password.encode())
    return email_ok and password_ok


def create_token(subject: str, token_type: TokenType) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    if token_type == "access":
        expires = now + timedelta(minutes=settings.access_token_expire_minutes)
    else:
        expires = now + timedelta(days=settings.refresh_token_expire_days)
    payload = {"sub": subject, "type": token_type, "iat": now, "exp": expires}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str, expected_type: TokenType) -> str | None:
    """Returns the subject if the token is valid and of the expected type."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    return payload.get("sub")


class LoginRateLimiter:
    """Simple in-memory sliding-window limiter. Swap for Redis when running multiple workers."""

    def __init__(self, max_attempts: int = 5, window_seconds: int = 60):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, deque[float]] = defaultdict(deque)

    def is_allowed(self, key: str) -> bool:
        now = time.monotonic()
        attempts = self._attempts[key]
        while attempts and now - attempts[0] > self.window_seconds:
            attempts.popleft()
        if len(attempts) >= self.max_attempts:
            return False
        attempts.append(now)
        return True

    def reset(self, key: str) -> None:
        self._attempts.pop(key, None)


login_rate_limiter = LoginRateLimiter()
