"""
Autenticação: login com senha + JWT de sessão + rate limiting por IP.
"""
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)

# ── Rate limiting simples em memória ──────────────────────────────────────────
_attempts: dict[str, list[float]] = defaultdict(list)
_WINDOW_SECS = 60
_MAX_ATTEMPTS = 5


def _check_rate_limit(ip: str) -> None:
    now = time.time()
    _attempts[ip] = [t for t in _attempts[ip] if now - t < _WINDOW_SECS]
    if len(_attempts[ip]) >= _MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Muitas tentativas. Aguarde {_WINDOW_SECS} segundos.",
        )
    _attempts[ip].append(now)


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token() -> str:
    settings = get_settings()
    payload = {
        "sub": "sgal-user",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> str:
    """Dependência que valida o Bearer token JWT em todas as rotas protegidas."""
    settings = get_settings()
    if not credentials:
        raise HTTPException(status_code=401, detail="Token de autenticação não fornecido.")
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=["HS256"],
        )
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada. Faça login novamente.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido.")


# ── Endpoint de login ─────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    senha: str


@router.post("/login")
async def login(body: LoginRequest, request: Request) -> dict:
    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(ip)

    settings = get_settings()
    if body.senha == settings.app_password:
        _attempts.pop(ip, None)  # zera tentativas após sucesso
        token = create_access_token()
        return {"ok": True, "token": token, "expires_hours": settings.jwt_expire_hours}

    raise HTTPException(status_code=401, detail="Senha incorreta.")
