from fastapi import APIRouter
from pydantic import BaseModel
from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    senha: str


@router.post("/login")
async def login(body: LoginRequest) -> dict:
    settings = get_settings()
    if body.senha == settings.app_password:
        return {"ok": True}
    return {"ok": False}
