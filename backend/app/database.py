from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()

# Render fornece "postgres://" ou "postgresql://" — asyncpg precisa do driver explícito
_db_url = settings.database_url
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _db_url.startswith("postgresql://") and "+asyncpg" not in _db_url:
    _db_url = _db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

_is_sqlite = _db_url.startswith("sqlite")

engine = create_async_engine(
    _db_url,
    echo=settings.debug,
    # SQLite não suporta pool_size/max_overflow
    **({} if _is_sqlite else {"pool_pre_ping": True, "pool_size": 10, "max_overflow": 20}),
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def _run_migrations(conn) -> None:
    """Adiciona colunas novas sem apagar dados existentes (safe migration)."""
    from sqlalchemy import text

    if _is_sqlite:
        result = await conn.execute(text("PRAGMA table_info(alvaras)"))
        cols = {row[1] for row in result.fetchall()}
        sqlite_migrations = [
            ("email_contato",             "ALTER TABLE alvaras ADD COLUMN email_contato VARCHAR(255)"),
            ("alerta_resolvido",          "ALTER TABLE alvaras ADD COLUMN alerta_resolvido BOOLEAN NOT NULL DEFAULT 0"),
            ("status_renovacao",          "ALTER TABLE alvaras ADD COLUMN status_renovacao VARCHAR(20) NOT NULL DEFAULT 'NAO_INICIADA'"),
            ("data_protocolo_renovacao",  "ALTER TABLE alvaras ADD COLUMN data_protocolo_renovacao DATE"),
            ("numero_protocolo_renovacao","ALTER TABLE alvaras ADD COLUMN numero_protocolo_renovacao VARCHAR(100)"),
            ("observacoes_renovacao",     "ALTER TABLE alvaras ADD COLUMN observacoes_renovacao TEXT"),
            ("data_renovacao_efetiva",    "ALTER TABLE alvaras ADD COLUMN data_renovacao_efetiva DATE"),
            ("municipio",                 "ALTER TABLE alvaras ADD COLUMN municipio VARCHAR(200)"),
            ("url_portal_renovacao",      "ALTER TABLE alvaras ADD COLUMN url_portal_renovacao VARCHAR(500)"),
            ("telefone",                  "ALTER TABLE alvaras ADD COLUMN telefone VARCHAR(30)"),
        ]
        for col_name, sql in sqlite_migrations:
            if col_name not in cols:
                await conn.execute(text(sql))
    else:
        pg_migrations = [
            "ALTER TABLE alvaras ADD COLUMN IF NOT EXISTS email_contato VARCHAR(255)",
            "ALTER TABLE alvaras ADD COLUMN IF NOT EXISTS alerta_resolvido BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE alvaras ADD COLUMN IF NOT EXISTS status_renovacao VARCHAR(20) NOT NULL DEFAULT 'NAO_INICIADA'",
            "ALTER TABLE alvaras ADD COLUMN IF NOT EXISTS data_protocolo_renovacao DATE",
            "ALTER TABLE alvaras ADD COLUMN IF NOT EXISTS numero_protocolo_renovacao VARCHAR(100)",
            "ALTER TABLE alvaras ADD COLUMN IF NOT EXISTS observacoes_renovacao TEXT",
            "ALTER TABLE alvaras ADD COLUMN IF NOT EXISTS data_renovacao_efetiva DATE",
            "ALTER TABLE alvaras ADD COLUMN IF NOT EXISTS municipio VARCHAR(200)",
            "ALTER TABLE alvaras ADD COLUMN IF NOT EXISTS url_portal_renovacao VARCHAR(500)",
            "ALTER TABLE alvaras ADD COLUMN IF NOT EXISTS telefone VARCHAR(30)",
        ]
        for sql in pg_migrations:
            await conn.execute(text(sql))


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _run_migrations(conn)
    await _seed_initial_data()


async def _seed_initial_data() -> None:
    """Cria usuário admin e configurações padrão se não existirem."""
    import logging
    from passlib.context import CryptContext
    from sqlalchemy import select, func as sqlfunc
    from app.models import Usuario, Configuracao

    _log = logging.getLogger(__name__)
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    settings = get_settings()

    async with AsyncSessionLocal() as session:
        # Cria admin padrão se não houver usuários
        count = (await session.execute(select(sqlfunc.count()).select_from(Usuario))).scalar()
        if count == 0:
            session.add(Usuario(
                username="admin",
                nome="Administrador",
                senha_hash=pwd_context.hash(settings.app_password),
                admin=True,
                ativo=True,
            ))
            _log.info("Usuário 'admin' criado (senha: %s)", settings.app_password)

        # Cria configurações de portais padrão se não existirem
        existing = {r[0] for r in (await session.execute(
            select(Configuracao.chave)
        )).all()}

        portais_default = {
            "portal_SANITARIO":     ("https://sigvisa.saude.mg.gov.br/",        "Portal Vigilância Sanitária MG"),
            "portal_BOMBEIROS":     ("https://servicos.bombeiros.mg.gov.br/",    "Portal CBMMG"),
            "portal_FUNCIONAMENTO": ("https://redesim.gov.br/",                  "Portal Redesim"),
            "portal_AMA":           ("https://www.siam.mg.gov.br/",              "Portal SIAM/MG"),
            "portal_DESCONHECIDO":  ("",                                          "Portal genérico"),
        }
        for chave, (valor, descricao) in portais_default.items():
            if chave not in existing:
                session.add(Configuracao(chave=chave, valor=valor, descricao=descricao))

        await session.commit()
