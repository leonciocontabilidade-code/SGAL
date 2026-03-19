"""
Rotas para upload, listagem e gerenciamento de alvarás.
"""
import asyncio
import logging
import os
import uuid
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import Alvara, StatusProcessamento
from app.schemas import AlvaraResponse, AlvaraUpdate, HistoricoAlertaResponse, UploadResponse
from app.services.ai_extractor import extrair_dados_com_ia
from app.services.document_processor import extrair_texto

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alvaras", tags=["Alvarás"])

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/tiff",
    "image/bmp",
}

def _get_max_size() -> int:
    return get_settings().max_upload_size_mb * 1024 * 1024


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_200_OK)
async def upload_alvara(
    arquivo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> UploadResponse:
    """
    Recebe um PDF ou imagem, extrai e processa os dados na mesma requisição.
    """
    _validar_arquivo(arquivo)

    conteudo = await arquivo.read()
    if len(conteudo) > _get_max_size():
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Arquivo excede {get_settings().max_upload_size_mb}MB.",
        )

    caminho = _salvar_arquivo(arquivo.filename, conteudo)

    # Extrai e processa imediatamente (regex é rápido — sem dependência externa)
    try:
        from app.services.document_processor import extrair_texto
        from app.services.ai_extractor import extrair_dados_com_ia

        texto = extrair_texto(str(caminho))
        dados = await extrair_dados_com_ia(texto)

        alvara = Alvara(
            nome_arquivo=arquivo.filename,
            caminho_arquivo=str(caminho),
            texto_extraido=texto,
            razao_social=dados.razao_social,
            cnpj=dados.cnpj,
            tipo=dados.tipo_alvara,
            numero_protocolo=dados.numero_protocolo,
            confianca_extracao=dados.confianca,
            data_emissao=date.fromisoformat(dados.data_emissao) if dados.data_emissao else None,
            data_vencimento=date.fromisoformat(dados.data_vencimento) if dados.data_vencimento else None,
            status_processamento=StatusProcessamento.CONCLUIDO,
        )
    except Exception as exc:
        logger.error("Erro ao processar %s: %s", arquivo.filename, exc)
        alvara = Alvara(
            nome_arquivo=arquivo.filename,
            caminho_arquivo=str(caminho),
            status_processamento=StatusProcessamento.ERRO,
            erro_processamento=str(exc),
        )

    db.add(alvara)
    await db.flush()
    await db.refresh(alvara)

    return UploadResponse(
        id=alvara.id,
        nome_arquivo=arquivo.filename,
        status_processamento=alvara.status_processamento,
        mensagem="Documento processado com sucesso." if alvara.status_processamento == StatusProcessamento.CONCLUIDO else "Erro ao processar documento.",
    )


# ── Cadastro Manual ───────────────────────────────────────────────────────────

@router.post("/", response_model=AlvaraResponse, status_code=status.HTTP_201_CREATED)
async def criar_alvara_manual(
    dados: AlvaraUpdate,
    db: AsyncSession = Depends(get_db),
) -> AlvaraResponse:
    """Cria um alvará manualmente sem upload de arquivo."""
    alvara = Alvara(
        nome_arquivo="Cadastro manual",
        caminho_arquivo="",
        razao_social=dados.razao_social,
        cnpj=dados.cnpj,
        tipo=dados.tipo or "DESCONHECIDO",
        numero_protocolo=dados.numero_protocolo,
        data_emissao=dados.data_emissao,
        data_vencimento=dados.data_vencimento,
        status_processamento=StatusProcessamento.CONCLUIDO,
    )
    db.add(alvara)
    await db.flush()
    await db.refresh(alvara)
    return _to_response(alvara)


# ── Listagem e Detalhes ───────────────────────────────────────────────────────

@router.get("/", response_model=list[AlvaraResponse])
async def listar_alvaras(
    tipo: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[AlvaraResponse]:
    stmt = select(Alvara).order_by(Alvara.data_vencimento.asc().nullslast())
    if tipo:
        stmt = stmt.where(Alvara.tipo == tipo.upper())

    alvaras = (await db.execute(stmt)).scalars().all()
    return [_to_response(a) for a in alvaras]


@router.get("/{alvara_id}", response_model=AlvaraResponse)
async def obter_alvara(alvara_id: int, db: AsyncSession = Depends(get_db)) -> AlvaraResponse:
    alvara = await _get_or_404(alvara_id, db)
    return _to_response(alvara)


@router.patch("/{alvara_id}", response_model=AlvaraResponse)
async def atualizar_alvara(
    alvara_id: int,
    dados: AlvaraUpdate,
    db: AsyncSession = Depends(get_db),
) -> AlvaraResponse:
    alvara = await _get_or_404(alvara_id, db)

    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(alvara, campo, valor)

    return _to_response(alvara)


@router.delete("/{alvara_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deletar_alvara(alvara_id: int, db: AsyncSession = Depends(get_db)) -> None:
    alvara = await _get_or_404(alvara_id, db)
    await db.delete(alvara)


@router.get("/{alvara_id}/alertas", response_model=list[HistoricoAlertaResponse])
async def listar_alertas_alvara(
    alvara_id: int, db: AsyncSession = Depends(get_db)
) -> list[HistoricoAlertaResponse]:
    alvara = await _get_or_404(alvara_id, db)
    return alvara.alertas


@router.post("/{alvara_id}/notificar")
async def notificar_alvara(alvara_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    """Dispara uma notificação manual para o alvará informado."""
    from app.models import HistoricoAlerta
    from app.services.alert_service import _montar_mensagem_alerta, _simular_envio_email

    alvara = await _get_or_404(alvara_id, db)

    if not alvara.data_vencimento:
        raise HTTPException(status_code=400, detail="Alvará sem data de vencimento definida.")

    status_venc = alvara.status_vencimento
    tipo_alerta = status_venc.value if status_venc else "INFORMATIVO"
    mensagem = _montar_mensagem_alerta(alvara, tipo_alerta)

    historico = HistoricoAlerta(
        alvara_id=alvara.id,
        tipo_alerta=tipo_alerta,
        mensagem=mensagem,
    )
    db.add(historico)
    _simular_envio_email(alvara, mensagem)

    return {"sucesso": True, "mensagem": mensagem}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _validar_arquivo(arquivo: UploadFile) -> None:
    if arquivo.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Tipo de arquivo não suportado: {arquivo.content_type}. "
                   f"Permitidos: PDF, PNG, JPEG, TIFF, BMP.",
        )


def _salvar_arquivo(nome_original: str, conteudo: bytes) -> Path:
    upload_dir = Path(get_settings().upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(nome_original).suffix.lower()
    nome_unico = f"{uuid.uuid4().hex}{ext}"
    caminho = upload_dir / nome_unico

    caminho.write_bytes(conteudo)
    return caminho


async def _processar_documento(alvara_id: int, caminho: str) -> None:
    """Task de background: extrai texto e chama a IA."""
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        alvara = await db.get(Alvara, alvara_id)
        if not alvara:
            logger.error("Alvará %d não encontrado para processamento.", alvara_id)
            return

        try:
            alvara.status_processamento = StatusProcessamento.PROCESSANDO
            await db.commit()

            texto = extrair_texto(caminho)
            dados = await extrair_dados_com_ia(texto)

            alvara.texto_extraido = texto
            alvara.razao_social = dados.razao_social
            alvara.cnpj = dados.cnpj
            alvara.tipo = dados.tipo_alvara
            alvara.numero_protocolo = dados.numero_protocolo
            alvara.confianca_extracao = dados.confianca

            if dados.data_emissao:
                alvara.data_emissao = date.fromisoformat(dados.data_emissao)
            if dados.data_vencimento:
                alvara.data_vencimento = date.fromisoformat(dados.data_vencimento)

            alvara.status_processamento = StatusProcessamento.CONCLUIDO
            logger.info("Alvará %d processado com sucesso (confiança: %d%%)", alvara_id, dados.confianca)

        except Exception as exc:
            logger.error("Erro ao processar alvará %d: %s", alvara_id, exc, exc_info=True)
            alvara.status_processamento = StatusProcessamento.ERRO
            alvara.erro_processamento = str(exc)

        await db.commit()


async def _get_or_404(alvara_id: int, db: AsyncSession) -> Alvara:
    alvara = await db.get(Alvara, alvara_id)
    if not alvara:
        raise HTTPException(status_code=404, detail=f"Alvará {alvara_id} não encontrado.")
    return alvara


def _to_response(alvara: Alvara) -> AlvaraResponse:
    return AlvaraResponse(
        **{
            col: getattr(alvara, col)
            for col in [
                "id", "razao_social", "cnpj", "tipo", "numero_protocolo",
                "data_emissao", "data_vencimento", "nome_arquivo",
                "status_processamento", "erro_processamento", "confianca_extracao",
                "alerta_enviado_amarelo", "alerta_enviado_vermelho",
                "criado_em", "atualizado_em",
            ]
        },
        dias_para_vencer=alvara.dias_para_vencer,
        status_vencimento=alvara.status_vencimento,
    )
