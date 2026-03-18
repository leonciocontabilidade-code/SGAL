"""
Serviço de alertas: detecta alvarás críticos e registra/simula envio de e-mail.
"""
import logging
from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Alvara, HistoricoAlerta, StatusVencimento, StatusProcessamento
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def verificar_e_disparar_alertas(db: AsyncSession) -> dict:
    """
    Varre todos os alvarás processados e dispara alertas para os que
    estão na zona Amarela ou Vermelha e ainda não receberam alerta.
    Retorna um resumo do processamento.
    """
    resultado = {"amarelos": 0, "vermelhos": 0, "erros": 0}

    stmt = select(Alvara).where(
        Alvara.status_processamento == StatusProcessamento.CONCLUIDO,
        Alvara.data_vencimento.isnot(None),
    )
    alvaras = (await db.execute(stmt)).scalars().all()

    for alvara in alvaras:
        try:
            status = alvara.status_vencimento
            await _processar_alerta(db, alvara, status, resultado)
        except Exception as exc:
            logger.error("Erro ao processar alerta alvara_id=%d: %s", alvara.id, exc)
            resultado["erros"] += 1

    await db.commit()
    logger.info("Verificação de alertas concluída: %s", resultado)
    return resultado


async def _processar_alerta(
    db: AsyncSession,
    alvara: Alvara,
    status: Optional[StatusVencimento],
    resultado: dict,
) -> None:
    if status == StatusVencimento.VERMELHO and not alvara.alerta_enviado_vermelho:
        mensagem = _montar_mensagem_alerta(alvara, "VERMELHO")
        await _registrar_alerta(db, alvara.id, "VERMELHO", mensagem)
        alvara.alerta_enviado_vermelho = True
        # Também marca amarelo como enviado se ainda não estava
        if not alvara.alerta_enviado_amarelo:
            alvara.alerta_enviado_amarelo = True
        resultado["vermelhos"] += 1
        _simular_envio_email(alvara, mensagem)

    elif status == StatusVencimento.AMARELO and not alvara.alerta_enviado_amarelo:
        mensagem = _montar_mensagem_alerta(alvara, "AMARELO")
        await _registrar_alerta(db, alvara.id, "AMARELO", mensagem)
        alvara.alerta_enviado_amarelo = True
        resultado["amarelos"] += 1
        _simular_envio_email(alvara, mensagem)


def _montar_mensagem_alerta(alvara: Alvara, tipo: str) -> str:
    dias = alvara.dias_para_vencer
    vencimento_str = alvara.data_vencimento.strftime("%d/%m/%Y") if alvara.data_vencimento else "N/A"

    if tipo == "VERMELHO":
        if dias is not None and dias < 0:
            urgencia = f"VENCIDO há {abs(dias)} dias"
        else:
            urgencia = f"vence em {dias} dias ({vencimento_str})"
    else:
        urgencia = f"vence em {dias} dias ({vencimento_str})"

    return (
        f"[ALERTA {tipo}] Alvará {alvara.tipo.value} | "
        f"Empresa: {alvara.razao_social or 'N/I'} | "
        f"CNPJ: {alvara.cnpj or 'N/I'} | "
        f"Protocolo: {alvara.numero_protocolo or 'N/I'} | "
        f"Situação: {urgencia}"
    )


async def _registrar_alerta(
    db: AsyncSession, alvara_id: int, tipo: str, mensagem: str
) -> None:
    historico = HistoricoAlerta(
        alvara_id=alvara_id,
        tipo_alerta=tipo,
        mensagem=mensagem,
    )
    db.add(historico)


def _simular_envio_email(alvara: Alvara, mensagem: str) -> None:
    """
    Simulação de envio de e-mail.
    Em produção, substitua por integração real (SendGrid, SES, SMTP, etc.).
    """
    logger.warning("📧 [SIMULAÇÃO DE E-MAIL] %s", mensagem)
    # Exemplo de integração real:
    # await send_email(
    #     to=["gestao@empresa.com"],
    #     subject=f"[SGAL] Alerta {tipo} - {alvara.razao_social}",
    #     body=mensagem
    # )
