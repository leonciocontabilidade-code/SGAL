"""
Rota do dashboard: estatísticas consolidadas e lista de todos os alvarás.
Suporta filtros server-side e paginação.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends

from app.database import get_db
from app.models import Alvara, StatusVencimento, StatusProcessamento
from app.routers.auth import get_current_user
from app.schemas import DashboardResponse, DashboardStats
from app.routers.alvaras import _to_response
from app.services.alert_service import verificar_e_disparar_alertas

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

_POR_PAGINA = 100  # registros por página


@router.get("/", response_model=DashboardResponse)
async def obter_dashboard(
    pagina: int = 1,
    tipo: str | None = None,
    status_venc: str | None = None,
    busca: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> DashboardResponse:
    # Carrega todos para calcular stats globais (sem filtro)
    stmt_all = select(Alvara).order_by(Alvara.data_vencimento.asc().nullslast())
    todos = (await db.execute(stmt_all)).scalars().all()
    stats = _calcular_stats(todos)

    # Aplica filtros para a listagem
    filtrados = list(todos)
    if tipo and tipo.upper() not in ("TODOS", ""):
        filtrados = [a for a in filtrados if a.tipo.value == tipo.upper()]
    if status_venc and status_venc.upper() not in ("TODOS", ""):
        sv = status_venc.upper()
        if sv == "SEM_DATA":
            filtrados = [a for a in filtrados if a.data_vencimento is None]
        else:
            filtrados = [a for a in filtrados if a.status_vencimento and a.status_vencimento.value == sv]
    if busca:
        q = busca.lower()
        filtrados = [
            a for a in filtrados
            if (a.razao_social or "").lower().__contains__(q)
            or (a.cnpj or "").__contains__(q)
            or (a.numero_protocolo or "").lower().__contains__(q)
        ]

    total_filtrado = len(filtrados)
    total_paginas = max(1, (total_filtrado + _POR_PAGINA - 1) // _POR_PAGINA)
    pagina = max(1, min(pagina, total_paginas))

    inicio = (pagina - 1) * _POR_PAGINA
    pagina_alvaras = filtrados[inicio: inicio + _POR_PAGINA]

    return DashboardResponse(
        stats=stats,
        alvaras=[_to_response(a) for a in pagina_alvaras],
        total_filtrado=total_filtrado,
        pagina=pagina,
        total_paginas=total_paginas,
    )


@router.post("/verificar-alertas")
async def disparar_verificacao_alertas(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> dict:
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
