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
        if "email_contato" not in cols:
            await conn.execute(text("ALTER TABLE alvaras ADD COLUMN email_contato VARCHAR(255)"))
        if "alerta_resolvido" not in cols:
            await conn.execute(text("ALTER TABLE alvaras ADD COLUMN alerta_resolvido BOOLEAN NOT NULL DEFAULT 0"))
    else:
        # PostgreSQL suporta IF NOT EXISTS
        await conn.execute(text(
            "ALTER TABLE alvaras ADD COLUMN IF NOT EXISTS email_contato VARCHAR(255)"
        ))
        await conn.execute(text(
            "ALTER TABLE alvaras ADD COLUMN IF NOT EXISTS alerta_resolvido BOOLEAN NOT NULL DEFAULT FALSE"
        ))


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _run_migrations(conn)
