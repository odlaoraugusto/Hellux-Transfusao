"""
HemoGest — Configuração do SQLAlchemy.
"""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


def _build_engine():
    """SQLite (usado na execução local sem Docker/Postgres) não aceita os
    parâmetros de pool de conexão do Postgres nem é thread-safe por padrão
    com uma única conexão compartilhada — por isso a criação do engine é
    condicional ao dialeto."""
    if settings.DATABASE_URL.startswith("sqlite"):
        return create_engine(
            settings.DATABASE_URL,
            connect_args={"check_same_thread": False},
        )
    return create_engine(
        settings.DATABASE_URL,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_pre_ping=True,
    )


engine = _build_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base declarativa para todos os models. Convenções (DER):
    - PK: UUID
    - created_at / updated_at / deleted_at (soft delete) em UTC
    - status como enum textual
    """
    pass


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
