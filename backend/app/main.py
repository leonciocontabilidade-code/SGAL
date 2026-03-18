import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import init_db
from app.routers import alvaras, dashboard
from app.tasks.deadline_checker import iniciar_verificador_prazos

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()

# Diretório do build do frontend (relativo à raiz do projeto)
_HERE = Path(__file__).resolve().parent  # app/
_FRONTEND_DIST = _HERE.parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando %s...", settings.app_name)
    await init_db()
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    task = asyncio.create_task(iniciar_verificador_prazos())
    yield
    task.cancel()
    logger.info("Aplicação encerrada.")


app = FastAPI(
    title=settings.app_name,
    description="API para gestão de Alvarás e Licenças com extração inteligente via IA.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: em produção, o frontend é servido pelo mesmo servidor (sem CORS)
_allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(alvaras.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok", "app": settings.app_name}


# Serve o frontend React em produção (deve ficar por último)
if _FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="frontend")
    logger.info("Frontend servido de: %s", _FRONTEND_DIST)
else:
    logger.info("Frontend dist não encontrado — modo desenvolvimento.")
