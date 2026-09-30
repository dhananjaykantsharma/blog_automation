from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import create_token, decode_token, login_rate_limiter, verify_admin_credentials
from app.schemas import LoginRequest, TokenResponse, User

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"


def _set_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 3600,
        path="/api/auth",
    )


def _token_response(subject: str) -> TokenResponse:
    settings = get_settings()
    return TokenResponse(
        access_token=create_token(subject, "access"),
        expires_in=settings.access_token_expire_minutes * 60,
        user=User(email=settings.admin_email, name=settings.admin_name),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, response: Response) -> TokenResponse:
    client_ip = request.client.host if request.client else "unknown"
    if not login_rate_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again in a minute.",
        )
    if not verify_admin_credentials(payload.email, payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    login_rate_limiter.reset(client_ip)
    subject = payload.email.strip().lower()
    _set_refresh_cookie(response, create_token(subject, "refresh"))
    return _token_response(subject)


@router.post("/refresh", response_model=TokenResponse)
def refresh(response: Response, refresh_token: str | None = Cookie(default=None)) -> TokenResponse:
    subject = decode_token(refresh_token, "refresh") if refresh_token else None
    if subject is None or subject != get_settings().admin_email.lower():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    # Rotate the refresh token on every use
    _set_refresh_cookie(response, create_token(subject, "refresh"))
    return _token_response(subject)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth")


@router.get("/me", response_model=User)
def me(user: User = Depends(get_current_user)) -> User:
    return user
