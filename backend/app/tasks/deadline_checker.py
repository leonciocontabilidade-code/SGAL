"""
Background task para verificação periódica de prazos de vencimento.
Executado pelo scheduler do FastAPI ao iniciar a aplicação.
"""
import asyncio
import logging
from datetime import datetime

from app.database import AsyncSessionLocal
from app.services.alert_service import verificar_e_disparar_alertas

logger = logging.getLogger(__name__)

INTERVALO_SEGUNDOS = 3600  # Verifica a cada 1 hora


async def iniciar_verificador_prazos() -> None:
    """Loop infinito que verifica prazos periodicamente."""
    logger.info("Verificador de prazos iniciado (intervalo: %ds).", INTERVALO_SEGUNDOS)

    while True:
        await asyncio.sleep(INTERVALO_SEGUNDOS)
        await _executar_verificacao()


async def _executar_verificacao() -> None:
    inicio = datetime.now()
    logger.info("Iniciando verificação de prazos às %s", inicio.isoformat())

    try:
        async with AsyncSessionLocal() as db:
            resultado = await verificar_e_disparar_alertas(db)
            duracao = (datetime.now() - inicio).total_seconds()
            logger.info(
                "Verificação concluída em %.2fs: %d amarelos, %d vermelhos, %d erros",
                duracao,
                resultado["amarelos"],
                resultado["vermelhos"],
                resultado["erros"],
            )
    except Exception as exc:
        logger.error("Erro crítico na verificação de prazos: %s", exc, exc_info=True)
