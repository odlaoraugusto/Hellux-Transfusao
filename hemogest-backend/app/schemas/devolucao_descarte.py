import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DevolucaoCreate(BaseModel):
    unidade_hemocomponente_id: uuid.UUID
    motivo_devolucao_id: uuid.UUID
    observacao: str | None = Field(default=None, max_length=1000)


class DevolucaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    unidade_hemocomponente_id: uuid.UUID
    motivo_devolucao_id: uuid.UUID
    observacao: str | None
    data_devolucao: datetime


class DescarteCreate(BaseModel):
    unidade_hemocomponente_id: uuid.UUID
    motivo_descarte_id: uuid.UUID
    observacao: str | None = Field(default=None, max_length=1000)


class DescarteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    unidade_hemocomponente_id: uuid.UUID
    motivo_descarte_id: uuid.UUID
    observacao: str | None
    data_descarte: datetime
