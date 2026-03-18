"""
Rota do dashboard: estatísticas consolidadas e lista de todos os alvarás.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends

from app.database import get_db
from app.models import Alvara, StatusVencimento, StatusProcessamento
from app.schemas import DashboardResponse, DashboardStats
from app.routers.alvaras import _to_response
from app.services.alert_service import verificar_e_disparar_alertas

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/", response_model=DashboardResponse)
async def obter_dashboard(db: AsyncSession = Depends(get_db)) -> DashboardResponse:
    stmt = select(Alvara).order_by(Alvara.data_vencimento.asc().nullslast())
    alvaras = (await db.execute(stmt)).scalars().all()

    stats = _calcular_stats(alvaras)
    return DashboardResponse(
        stats=stats,
        alvaras=[_to_response(a) for a in alvaras],
    )


@router.post("/verificar-alertas")
async def disparar_verificacao_alertas(db: AsyncSession = Depends(get_db)) -> dict:
    """Endpoint manual para forçar verificação de alertas (útil para testes)."""
    resultado = await verificar_e_disparar_alertas(db)
    return {"sucesso": True, "resultado": resultado}


def _calcular_stats(alvaras: list[Alvara]) -> DashboardStats:
    verdes = amarelos = vermelhos = sem_vencimento = 0
    por_tipo: dict[str, int] = {}

    for a in alvaras:
        tipo_key = a.tipo.value
        por_tipo[tipo_key] = por_tipo.get(tipo_key, 0) + 1

        status = a.status_vencimento
        if status == StatusVencimento.VERDE:
            verdes += 1
        elif status == StatusVencimento.AMARELO:
            amarelos += 1
        elif status == StatusVencimento.VERMELHO:
            vermelhos += 1
        else:
            sem_vencimento += 1

    return DashboardStats(
        total=len(alvaras),
        verdes=verdes,
        amarelos=amarelos,
        vermelhos=vermelhos,
        sem_vencimento=sem_vencimento,
        por_tipo=por_tipo,
    )
