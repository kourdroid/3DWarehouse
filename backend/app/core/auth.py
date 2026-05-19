from fastapi import Header, HTTPException, Query, status

from app.core.config import settings


def require_demo_token(
    token: str | None = Query(default=None),
    x_demo_token: str | None = Header(default=None, alias="X-Demo-Token"),
) -> None:
    provided_token = x_demo_token or token
    if provided_token != settings.DEMO_API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid demo API token",
        )


def validate_demo_token(token: str) -> bool:
    return token == settings.DEMO_API_TOKEN
