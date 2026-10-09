"""
HemoGest — Configurações centrais da aplicação.
Todas as variáveis sensíveis vêm do ambiente (.env). Nunca hardcode segredos.
"""
from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Aplicação ---
    APP_NAME: str = "Hellux - Módulo de Transfusão"
    APP_ENV: str = Field(default="development")  # development | staging | production
    # Default é False de propósito: se alguém subir em produção sem definir
    # APP_DEBUG explicitamente no ambiente, /docs e /redoc ficam fechados por
    # padrão (fail-safe) em vez de expostos por padrão (fail-open).
    APP_DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    TIMEZONE: str = "UTC"  # Premissa do DER: tudo em UTC no banco

    # --- Segurança / JWT ---
    JWT_SECRET_KEY: str = Field(..., description="Chave secreta para assinatura dos tokens", min_length=32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # --- Criptografia de campo (dados sensíveis de paciente) ---
    # Segredo mestre — nunca usado diretamente, sempre via HKDF em
    # app.db.encrypted_types (ver docstring lá para o porquê da separação de
    # chaves). Gere com scripts/generate_encryption_key.py. Trocar esta chave
    # em produção torna ilegíveis os dados já cifrados com a chave antiga —
    # não é um valor para "resetar" sem um plano de re-criptografia.
    FIELD_ENCRYPTION_KEY: str = Field(
        ..., description="Segredo mestre para cifrar dados sensíveis de paciente", min_length=32
    )

    # --- Banco de Dados ---
    DATABASE_URL: str = Field(..., description="postgresql+psycopg://user:pass@host:port/db")
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    # --- CORS ---
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]

    # --- Armazenamento de Anexos ---
    # "minio"  -> usa MinIO/S3 (produção / docker compose)
    # "local"  -> disco local, sem servidor externo (execução sem Docker)
    STORAGE_BACKEND: str = "minio"

    # MinIO / S3
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = ""
    MINIO_SECRET_KEY: str = ""
    MINIO_BUCKET_NAME: str = "hemogest-anexos"
    MINIO_SECURE: bool = False

    # Disco local (STORAGE_BACKEND=local)
    LOCAL_STORAGE_PATH: str = "./storage"
    LOCAL_STORAGE_URL_TTL_MINUTES: int = 15

    # --- Logging ---
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = True

    # --- Multitenancy ---
    DEFAULT_TENANT_HEADER: str = "X-Unidade-Id"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
