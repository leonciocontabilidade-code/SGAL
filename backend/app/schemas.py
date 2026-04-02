from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator
import re

from app.models import TipoAlvara, StatusVencimento, StatusProcessamento, StatusRenovacao, Usuario


# ── Resposta da IA ────────────────────────────────────────────────────────────

class DadosExtradosIA(BaseModel):
    """Schema que a IA deve retornar ao processar um documento."""
    razao_social: Optional[str] = None
    cnpj: Optional[str] = None
    tipo_alvara: TipoAlvara = TipoAlvara.DESCONHECIDO
    numero_protocolo: Optional[str] = None
    data_emissao: Optional[str] = None   # ISO 8601: YYYY-MM-DD
    data_vencimento: Optional[str] = None  # ISO 8601: YYYY-MM-DD
    confianca: int = Field(default=0, ge=0, le=100)
    observacoes: Optional[str] = None

    @field_validator("cnpj")
    @classmethod
    def normalizar_cnpj(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        digits = re.sub(r"\D", "", v)
        if len(digits) == 14:
            return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"
        return v


# ── Alvará ────────────────────────────────────────────────────────────────────

class AlvaraBase(BaseModel):
    razao_social: Optional[str] = None
    cnpj: Optional[str] = None
    tipo: TipoAlvara = TipoAlvara.DESCONHECIDO
    numero_protocolo: Optional[str] = None
    data_emissao: Optional[date] = None
    data_vencimento: Optional[date] = None
    email_contato: Optional[str] = None
    municipio: Optional[str] = None


class AlvaraCreate(AlvaraBase):
    nome_arquivo: str
    caminho_arquivo: str


class AlvaraUpdate(BaseModel):
    razao_social: Optional[str] = None
    cnpj: Optional[str] = None
    tipo: Optional[TipoAlvara] = None
    numero_protocolo: Optional[str] = None
    data_emissao: Optional[date] = None
    data_vencimento: Optional[date] = None
    email_contato: Optional[str] = None
    alerta_resolvido: Optional[bool] = None
    # Renovação
    municipio: Optional[str] = None
    status_renovacao: Optional[StatusRenovacao] = None
    data_protocolo_renovacao: Optional[date] = None
    numero_protocolo_renovacao: Optional[str] = None
    observacoes_renovacao: Optional[str] = None
    data_renovacao_efetiva: Optional[date] = None
    url_portal_renovacao: Optional[str] = None


class AlvaraResponse(AlvaraBase):
    id: int
    nome_arquivo: str
    status_processamento: StatusProcessamento
    erro_processamento: Optional[str] = None
    confianca_extracao: Optional[int] = None
    alerta_enviado_amarelo: bool
    alerta_enviado_vermelho: bool
    alerta_resolvido: bool
    criado_em: datetime
    atualizado_em: datetime

    # Renovação
    municipio: Optional[str] = None
    status_renovacao: StatusRenovacao = StatusRenovacao.NAO_INICIADA
    data_protocolo_renovacao: Optional[date] = None
    numero_protocolo_renovacao: Optional[str] = None
    observacoes_renovacao: Optional[str] = None
    data_renovacao_efetiva: Optional[date] = None
    url_portal_renovacao: Optional[str] = None

    # Campos computados
    dias_para_vencer: Optional[int] = None
    status_vencimento: Optional[StatusVencimento] = None

    model_config = {"from_attributes": True}


# ── Upload ────────────────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    id: int
    nome_arquivo: str
    status_processamento: StatusProcessamento
    mensagem: str


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total: int
    verdes: int
    amarelos: int
    vermelhos: int
    sem_vencimento: int
    por_tipo: dict[str, int]


class DashboardResponse(BaseModel):
    stats: DashboardStats
    alvaras: list[AlvaraResponse]
    total_filtrado: int = 0
    pagina: int = 1
    total_paginas: int = 1


# ── Usuários ──────────────────────────────────────────────────────────────────

class UsuarioCreate(BaseModel):
    username: str
    nome: str
    email: Optional[str] = None
    senha: str
    admin: bool = False


class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[str] = None
    senha: Optional[str] = None
    admin: Optional[bool] = None
    ativo: Optional[bool] = None


class UsuarioResponse(BaseModel):
    id: int
    username: str
    nome: str
    email: Optional[str] = None
    admin: bool
    ativo: bool
    criado_em: datetime
    model_config = {"from_attributes": True}


# ── Configurações ─────────────────────────────────────────────────────────────

class ConfiguracaoItem(BaseModel):
    chave: str
    valor: Optional[str] = None
    descricao: Optional[str] = None


class ConfiguracaoLote(BaseModel):
    configuracoes: dict[str, Optional[str]]


# ── Alertas ───────────────────────────────────────────────────────────────────

class HistoricoAlertaResponse(BaseModel):
    id: int
    alvara_id: int
    tipo_alerta: str
    mensagem: str
    enviado_em: datetime

    model_config = {"from_attributes": True}
