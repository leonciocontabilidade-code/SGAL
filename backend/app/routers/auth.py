"""
Autenticação: login com username + senha (bcrypt) + JWT + rate limiting por IP.
"""
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import Usuario

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Rate limiting ──────────────────────────────────────────────────────────────
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


# ── Hashing ───────────────────────────────────────────────────────────────────

def hash_senha(senha: str) -> str:
    return pwd_context.hash(senha)


def verificar_senha(senha: str, senha_hash: str) -> bool:
    return pwd_context.verify(senha, senha_hash)


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(username: str, admin: bool = False) -> str:
    settings = get_settings()
    payload = {
        "sub": username,
        "admin": admin,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def _decode_token(credentials: HTTPAuthorizationCredentials | None) -> dict:
    settings = get_settings()
    if not credentials:
        raise HTTPException(status_code=401, detail="Token de autenticação não fornecido.")
    try:
        return jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada. Faça login novamente.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido.")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> str:
    """Dependência básica: retorna username (str). Compatível com endpoints existentes."""
    return _decode_token(credentials)["sub"]


def get_current_user_info(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    """Retorna {username, admin}."""
    payload = _decode_token(credentials)
    return {"username": payload["sub"], "admin": payload.get("admin", False)}


def require_admin(
    user: dict = Depends(get_current_user_info),
) -> dict:
    """Dependência que exige perfil admin."""
    if not user.get("admin"):
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
    return user


# ── Endpoint de login ─────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    senha: str


@router.post("/login")
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(ip)

    result = await db.execute(
        select(Usuario).where(
            Usuario.username == body.username.strip().lower(),
            Usuario.ativo == True,  # noqa: E712
        )
    )
    usuario = result.scalar_one_or_none()

    if not usuario or not verificar_senha(body.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos.")

    _attempts.pop(ip, None)
    settings = get_settings()
    token = create_access_token(usuario.username, admin=usuario.admin)
    return {
        "ok": True,
        "token": token,
        "expires_hours": settings.jwt_expire_hours,
        "username": usuario.username,
        "nome": usuario.nome,
        "admin": usuario.admin,
    }
