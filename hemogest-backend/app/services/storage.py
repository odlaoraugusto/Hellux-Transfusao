"""
HemoGest — Serviço de armazenamento de anexos.
Duas implementações, escolhidas por STORAGE_BACKEND:
  - "minio": MinIO/S3 (produção, docker compose)
  - "local": disco local, sem servidor externo (execução sem Docker/MinIO —
             pensado para máquinas sem Docker e sem privilégios de admin)
Ambas expõem a mesma interface: upload / get_presigned_url / delete.
Usado por: Devoluções, Descartes, Reações Transfusionais, Logo da Unidade.
"""
import base64
import hashlib
import hmac
import os
import time
from datetime import timedelta
from functools import lru_cache
from io import BytesIO
from pathlib import Path

from app.core.config import settings


class StorageService:
    """Interface comum às implementações de armazenamento."""

    def upload(self, object_name: str, data: bytes, content_type: str) -> str:
        raise NotImplementedError

    def get_presigned_url(self, object_name: str, expires_minutes: int = 15) -> str:
        raise NotImplementedError

    def delete(self, object_name: str) -> None:
        raise NotImplementedError


class MinioStorageService(StorageService):
    def __init__(self) -> None:
        from minio import Minio

        self._client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        self._bucket = settings.MINIO_BUCKET_NAME
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        if not self._client.bucket_exists(self._bucket):
            self._client.make_bucket(self._bucket)

    def upload(self, object_name: str, data: bytes, content_type: str) -> str:
        self._client.put_object(
            self._bucket, object_name, BytesIO(data), length=len(data), content_type=content_type
        )
        return object_name

    def get_presigned_url(self, object_name: str, expires_minutes: int = 15) -> str:
        return self._client.presigned_get_object(
            self._bucket, object_name, expires=timedelta(minutes=expires_minutes)
        )

    def delete(self, object_name: str) -> None:
        self._client.remove_object(self._bucket, object_name)


def _sign(object_name: str, expires_at: int) -> str:
    payload = f"{object_name}:{expires_at}"
    sig = hmac.new(settings.JWT_SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    raw = f"{payload}:{sig}".encode()
    return base64.urlsafe_b64encode(raw).decode()


def verify_local_token(token: str) -> str:
    """Retorna object_name se o token for válido e não expirado. Levanta
    ValueError caso contrário (token adulterado, malformado ou expirado)."""
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        object_name, expires_at_s, sig = raw.rsplit(":", 2)
    except Exception as exc:  # noqa: BLE001 — qualquer falha de decodificação é token inválido
        raise ValueError("Token inválido.") from exc

    expected = hmac.new(
        settings.JWT_SECRET_KEY.encode(), f"{object_name}:{expires_at_s}".encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise ValueError("Token inválido.")
    if int(expires_at_s) < int(time.time()):
        raise ValueError("Token expirado.")
    return object_name


class LocalStorageService(StorageService):
    """Grava os anexos em disco, sob LOCAL_STORAGE_PATH. O "presigned URL" é
    emulado por um token HMAC com expiração, validado pelo endpoint
    GET /api/v1/anexos/arquivo/{token} (ver app/api/v1/anexos.py)."""

    def __init__(self) -> None:
        self._root = Path(settings.LOCAL_STORAGE_PATH).resolve()
        self._root.mkdir(parents=True, exist_ok=True)

    def _path_for(self, object_name: str) -> Path:
        # object_name é gerado internamente pelo anexo_service (nunca vem do
        # usuário), mas validamos mesmo assim contra path traversal.
        safe = os.path.normpath(object_name).lstrip("/\\")
        path = (self._root / safe).resolve()
        if path != self._root and self._root not in path.parents:
            raise ValueError("object_name inválido.")
        return path

    def upload(self, object_name: str, data: bytes, content_type: str) -> str:
        path = self._path_for(object_name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return object_name

    def get_presigned_url(self, object_name: str, expires_minutes: int = 15) -> str:
        expires_at = int(time.time()) + expires_minutes * 60
        token = _sign(object_name, expires_at)
        return f"{settings.API_V1_PREFIX}/anexos/arquivo/{token}"

    def delete(self, object_name: str) -> None:
        self._path_for(object_name).unlink(missing_ok=True)

    def read(self, object_name: str) -> bytes:
        return self._path_for(object_name).read_bytes()


@lru_cache
def get_storage_service() -> "StorageService":
    """Lazy singleton — evita conectar ao MinIO na importação do módulo
    (ex: durante testes que não usam upload de anexos)."""
    if settings.STORAGE_BACKEND == "local":
        return LocalStorageService()
    return MinioStorageService()
