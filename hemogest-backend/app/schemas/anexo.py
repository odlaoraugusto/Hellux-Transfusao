import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AnexoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entidade: str
    entidade_id: uuid.UUID
    nome_arquivo: str
    content_type: str
    tamanho_bytes: int
    created_at: datetime


class AnexoDownloadOut(BaseModel):
    url: str
    expira_em_minutos: int = 15
