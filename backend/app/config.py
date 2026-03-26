import os
from functools import lru_cache
from pydantic_settings import BaseSettings
from pathlib import Path

# Caminho absoluto do .env — funciona independente do diretório de execução
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

# Em produção no Railway, usa o volume persistente em /data
_DEFAULT_DB = (
    "sqlite+aiosqlite:////data/sgal.db"
    if os.getenv("RAILWAY_ENVIRONMENT")
    else "sqlite+aiosqlite:///./sgal.db"
)


class Settings(BaseSettings):
    # Database (SQLite por padrão — sem instalação extra)
    database_url: str = _DEFAULT_DB

    # AI Provider (supports "anthropic" or "openai")
    ai_provider: str = "anthropic"
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # Alert thresholds (days)
    alert_yellow_days: int = 60
    alert_red_days: int = 15

    # Upload
    upload_dir: str = "uploads"
    max_upload_size_mb: int = 20

    # App
    app_name: str = "SGAL - Sistema de Gestão de Alvarás e Licenças"
    debug: bool = False
    app_password: str = "sgal2024"

    # JWT — troque jwt_secret em produção (.env)
    jwt_secret: str = "sgal-jwt-secret-change-in-production-use-env"
    jwt_expire_hours: int = 8

    # SMTP — configure no .env para envios reais
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_tls: bool = True

    model_config = {
        "env_file": str(_ENV_FILE),
        "env_file_encoding": "utf-8",
        "env_ignore_empty": True,
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
