"""
Rotas administrativas: backup, restore, usuários e configurações do sistema.
"""
import shutil
import smtplib
import tempfile
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import Usuario, Configuracao
from app.routers.auth import get_current_user, require_admin, hash_senha, verificar_senha
from app.schemas import UsuarioCreate, UsuarioUpdate, UsuarioResponse, ConfiguracaoLote

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Backup / Restore ──────────────────────────────────────────────────────────

def _get_db_path() -> Path:
    url = get_settings().database_url
    path_str = url.split("///")[-1]
    return Path(path_str).resolve()


@router.get("/backup", summary="Download do banco de dados")
async def download_backup(_: str = Depends(get_current_user)):
    db_path = _get_db_path()
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Banco de dados não encontrado.")
    agora = datetime.now().strftime("%Y%m%d_%H%M%S")
    return FileResponse(path=str(db_path), media_type="application/octet-stream",
                        filename=f"sgal_backup_{agora}.db")


@router.post("/restore", summary="Restaurar banco de dados via upload")
async def upload_restore(arquivo: UploadFile = File(...), _: str = Depends(get_current_user)):
    if not arquivo.filename or not arquivo.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="Envie um arquivo .db válido.")
    db_path = _get_db_path()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp:
        conteudo = await arquivo.read()
        tmp.write(conteudo)
        tmp_path = Path(tmp.name)
    with open(tmp_path, "rb") as f:
        if not f.read(16).startswith(b"SQLite format 3"):
            tmp_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Arquivo não é um banco SQLite válido.")
    if db_path.exists():
        shutil.copy2(db_path, db_path.with_suffix(".db.bak"))
    shutil.move(str(tmp_path), str(db_path))
    return {"ok": True, "mensagem": "Banco restaurado com sucesso."}


@router.get("/status", summary="Status do armazenamento")
async def storage_status(_: str = Depends(get_current_user)):
    db_path = _get_db_path()
    settings = get_settings()
    return {
        "db_path": str(db_path),
        "db_existe": db_path.exists(),
        "db_tamanho_kb": round(db_path.stat().st_size / 1024, 1) if db_path.exists() else 0,
        "volume_montado": str(db_path).startswith("/data"),
        "database_url": settings.database_url.split("///")[0] + "///...",
    }


# ── Usuários ──────────────────────────────────────────────────────────────────

@router.get("/usuarios", response_model=list[UsuarioResponse])
async def listar_usuarios(
    _: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[UsuarioResponse]:
    result = await db.execute(select(Usuario).order_by(Usuario.criado_em))
    return result.scalars().all()


@router.post("/usuarios", response_model=UsuarioResponse, status_code=201)
async def criar_usuario(
    dados: UsuarioCreate,
    _: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UsuarioResponse:
    # Verifica duplicata
    existente = (await db.execute(
        select(Usuario).where(Usuario.username == dados.username.strip().lower())
    )).scalar_one_or_none()
    if existente:
        raise HTTPException(status_code=409, detail="Nome de usuário já cadastrado.")

    usuario = Usuario(
        username=dados.username.strip().lower(),
        nome=dados.nome.strip(),
        email=dados.email,
        senha_hash=hash_senha(dados.senha),
        admin=dados.admin,
        ativo=True,
    )
    db.add(usuario)
    await db.flush()
    await db.refresh(usuario)
    return usuario


@router.patch("/usuarios/{usuario_id}", response_model=UsuarioResponse)
async def atualizar_usuario(
    usuario_id: int,
    dados: UsuarioUpdate,
    current: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UsuarioResponse:
    usuario = await db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    # Impede que o admin remova seus próprios privilégios
    if usuario.username == current["username"] and dados.admin is False:
        raise HTTPException(status_code=400, detail="Você não pode remover seus próprios privilégios.")
    if dados.nome is not None:
        usuario.nome = dados.nome.strip()
    if dados.email is not None:
        usuario.email = dados.email
    if dados.senha is not None:
        usuario.senha_hash = hash_senha(dados.senha)
    if dados.admin is not None:
        usuario.admin = dados.admin
    if dados.ativo is not None:
        usuario.ativo = dados.ativo
    await db.flush()
    await db.refresh(usuario)
    return usuario


@router.delete("/usuarios/{usuario_id}", status_code=204)
async def desativar_usuario(
    usuario_id: int,
    current: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    usuario = await db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if usuario.username == current["username"]:
        raise HTTPException(status_code=400, detail="Você não pode desativar sua própria conta.")
    usuario.ativo = False


# ── Configurações do sistema ──────────────────────────────────────────────────

@router.get("/configuracoes")
async def get_configuracoes(
    _: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Retorna todas as configurações. Senha SMTP é mascarada."""
    result = await db.execute(select(Configuracao))
    configs = {r.chave: r.valor for r in result.scalars().all()}

    # Mascara senha SMTP
    if configs.get("smtp_password"):
        configs["smtp_password"] = "••••••••"

    # Preenche portais com defaults se não existirem
    portais_default = {
        "portal_SANITARIO":     "https://sigvisa.saude.mg.gov.br/",
        "portal_BOMBEIROS":     "https://servicos.bombeiros.mg.gov.br/",
        "portal_FUNCIONAMENTO": "https://redesim.gov.br/",
        "portal_AMA":           "https://www.siam.mg.gov.br/",
        "portal_DESCONHECIDO":  "",
    }
    for k, v in portais_default.items():
        configs.setdefault(k, v)

    return configs


@router.patch("/configuracoes")
async def salvar_configuracoes(
    lote: ConfiguracaoLote,
    _: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Salva configurações no banco. Ignora 'smtp_password' se for '••••••••'."""
    for chave, valor in lote.configuracoes.items():
        # Não sobrescreve a senha se o frontend enviou o placeholder
        if chave == "smtp_password" and valor == "••••••••":
            continue
        cfg = await db.get(Configuracao, chave)
        if cfg:
            cfg.valor = valor
        else:
            db.add(Configuracao(chave=chave, valor=valor))
    return {"ok": True}


@router.post("/testar-smtp")
async def testar_smtp(
    _: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Testa a conexão SMTP com as configurações atuais."""
    result = await db.execute(
        select(Configuracao).where(Configuracao.chave.in_([
            "smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_tls"
        ]))
    )
    configs = {r.chave: r.valor for r in result.scalars().all()}
    settings = get_settings()

    host = configs.get("smtp_host") or settings.smtp_host
    port = int(configs.get("smtp_port") or settings.smtp_port)
    user = configs.get("smtp_user") or settings.smtp_user
    password = configs.get("smtp_password") or settings.smtp_password
    tls = (configs.get("smtp_tls") or "").lower() not in ("false", "0", "no") if "smtp_tls" in configs else settings.smtp_tls

    if not host:
        raise HTTPException(status_code=400, detail="SMTP Host não configurado.")

    try:
        with smtplib.SMTP(host, port, timeout=10) as server:
            server.ehlo()
            if tls:
                server.starttls()
                server.ehlo()
            if user and password:
                server.login(user, password)
        return {"ok": True, "mensagem": f"Conexão com {host}:{port} bem-sucedida!"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Falha na conexão: {exc}")


# ── Alterar própria senha ─────────────────────────────────────────────────────

class AlterarSenhaRequest(BaseModel):
    senha_atual: str
    nova_senha: str


@router.post("/alterar-senha")
async def alterar_senha(
    dados: AlterarSenhaRequest,
    current: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Permite ao usuário trocar sua própria senha."""
    result = await db.execute(select(Usuario).where(Usuario.username == current))
    usuario = result.scalar_one_or_none()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if not verificar_senha(dados.senha_atual, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Senha atual incorreta.")
    usuario.senha_hash = hash_senha(dados.nova_senha)
    return {"ok": True}
