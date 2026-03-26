"""
Rotas administrativas: backup e restore do banco de dados.
"""
import shutil
import tempfile
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from app.config import get_settings
from app.routers.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["Admin"])


def _get_db_path() -> Path:
    settings = get_settings()
    url = settings.database_url
    # Extrai o caminho do sqlite URL: sqlite+aiosqlite:///./sgal.db ou ////data/sgal.db
    path_str = url.split("///")[-1]
    return Path(path_str).resolve()


@router.get("/backup", summary="Download do banco de dados")
async def download_backup(_: str = Depends(get_current_user)):
    """Faz download do arquivo sgal.db para backup local."""
    db_path = _get_db_path()
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Banco de dados não encontrado.")

    agora = datetime.now().strftime("%Y%m%d_%H%M%S")
    nome = f"sgal_backup_{agora}.db"
    return FileResponse(
        path=str(db_path),
        media_type="application/octet-stream",
        filename=nome,
    )


@router.post("/restore", summary="Restaurar banco de dados via upload")
async def upload_restore(
    arquivo: UploadFile = File(...),
    _: str = Depends(get_current_user),
):
    """
    Substitui o banco de dados pelo arquivo enviado.
    ATENÇÃO: todos os dados atuais serão substituídos.
    """
    if not arquivo.filename or not arquivo.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="Envie um arquivo .db válido.")

    db_path = _get_db_path()

    # Salva temporariamente e valida que é um SQLite válido
    with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp:
        conteudo = await arquivo.read()
        tmp.write(conteudo)
        tmp_path = Path(tmp.name)

    # Verifica assinatura SQLite (primeiros 16 bytes)
    with open(tmp_path, "rb") as f:
        header = f.read(16)
    if not header.startswith(b"SQLite format 3"):
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Arquivo não é um banco SQLite válido.")

    # Faz backup do atual antes de substituir
    if db_path.exists():
        backup = db_path.with_suffix(".db.bak")
        shutil.copy2(db_path, backup)

    shutil.move(str(tmp_path), str(db_path))
    return {"ok": True, "mensagem": "Banco de dados restaurado. Reinicie o servidor para aplicar."}


@router.get("/status", summary="Status do armazenamento")
async def storage_status(_: str = Depends(get_current_user)):
    """Retorna informações sobre o banco de dados e volume."""
    db_path = _get_db_path()
    settings = get_settings()

    return {
        "db_path": str(db_path),
        "db_existe": db_path.exists(),
        "db_tamanho_kb": round(db_path.stat().st_size / 1024, 1) if db_path.exists() else 0,
        "volume_montado": str(db_path).startswith("/data"),
        "database_url": settings.database_url.split("///")[0] + "///...",
    }
