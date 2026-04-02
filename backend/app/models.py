import enum
from datetime import datetime, date
from typing import Optional

from sqlalchemy import (
    String, Text, Date, DateTime, Enum, Boolean,
    ForeignKey, func, Integer
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TipoAlvara(str, enum.Enum):
    SANITARIO = "SANITARIO"
    BOMBEIROS = "BOMBEIROS"
    FUNCIONAMENTO = "FUNCIONAMENTO"
    AMA = "AMA"
    DESCONHECIDO = "DESCONHECIDO"


class StatusVencimento(str, enum.Enum):
    VERDE = "VERDE"       # > 60 dias
    AMARELO = "AMARELO"  # 15 a 60 dias
    VERMELHO = "VERMELHO"  # < 15 dias ou vencido


class StatusProcessamento(str, enum.Enum):
    PENDENTE = "PENDENTE"
    PROCESSANDO = "PROCESSANDO"
    CONCLUIDO = "CONCLUIDO"
    ERRO = "ERRO"


class StatusRenovacao(str, enum.Enum):
    NAO_INICIADA    = "NAO_INICIADA"
    EM_ANDAMENTO    = "EM_ANDAMENTO"
    AGUARDANDO_DOCS = "AGUARDANDO_DOCS"
    RENOVADO        = "RENOVADO"
    CANCELADO       = "CANCELADO"


class Alvara(Base):
    __tablename__ = "alvaras"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Dados extraídos do documento
    razao_social: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cnpj: Mapped[Optional[str]] = mapped_column(String(18), nullable=True, index=True)
    tipo: Mapped[TipoAlvara] = mapped_column(
        Enum(TipoAlvara), default=TipoAlvara.DESCONHECIDO, nullable=False
    )
    numero_protocolo: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    data_emissao: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    data_vencimento: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)

    # Contato para alertas
    email_contato: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Controle do arquivo
    nome_arquivo: Mapped[str] = mapped_column(String(255), nullable=False)
    caminho_arquivo: Mapped[str] = mapped_column(Text, nullable=False)
    texto_extraido: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Status e processamento
    status_processamento: Mapped[StatusProcessamento] = mapped_column(
        Enum(StatusProcessamento), default=StatusProcessamento.PENDENTE
    )
    erro_processamento: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confianca_extracao: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="Percentual de confiança da IA (0-100)"
    )

    # Alertas
    alerta_enviado_amarelo: Mapped[bool] = mapped_column(Boolean, default=False)
    alerta_enviado_vermelho: Mapped[bool] = mapped_column(Boolean, default=False)

    # Alerta resolvido/reconhecido pelo operador
    alerta_resolvido: Mapped[bool] = mapped_column(Boolean, default=False)

    # Localização
    municipio: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Renovação
    status_renovacao: Mapped[StatusRenovacao] = mapped_column(
        Enum(StatusRenovacao), default=StatusRenovacao.NAO_INICIADA, nullable=False
    )
    data_protocolo_renovacao: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    numero_protocolo_renovacao: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    observacoes_renovacao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    data_renovacao_efetiva: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    url_portal_renovacao: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Metadados
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relacionamentos
    alertas: Mapped[list["HistoricoAlerta"]] = relationship(
        "HistoricoAlerta", back_populates="alvara", cascade="all, delete-orphan"
    )

    @property
    def dias_para_vencer(self) -> Optional[int]:
        if self.data_vencimento is None:
            return None
        return (self.data_vencimento - date.today()).days

    @property
    def status_vencimento(self) -> Optional[StatusVencimento]:
        dias = self.dias_para_vencer
        if dias is None:
            return None
        if dias > 60:
            return StatusVencimento.VERDE
        if dias > 15:
            return StatusVencimento.AMARELO
        return StatusVencimento.VERMELHO

    def __repr__(self) -> str:
        return f"<Alvara id={self.id} tipo={self.tipo} cnpj={self.cnpj}>"


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    admin: Mapped[bool] = mapped_column(Boolean, default=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<Usuario id={self.id} username={self.username} admin={self.admin}>"


class Configuracao(Base):
    __tablename__ = "configuracoes"

    chave: Mapped[str] = mapped_column(String(100), primary_key=True)
    valor: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    descricao: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:
        return f"<Configuracao chave={self.chave}>"


class HistoricoAlerta(Base):
    __tablename__ = "historico_alertas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    alvara_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("alvaras.id", ondelete="CASCADE"), nullable=False
    )
    tipo_alerta: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="AMARELO ou VERMELHO"
    )
    mensagem: Mapped[str] = mapped_column(Text, nullable=False)
    enviado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    alvara: Mapped["Alvara"] = relationship("Alvara", back_populates="alertas")

    def __repr__(self) -> str:
        return f"<HistoricoAlerta alvara_id={self.alvara_id} tipo={self.tipo_alerta}>"
