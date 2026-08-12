import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class InternacaoCreate(BaseModel):
    paciente_id: uuid.UUID
    setor_id: uuid.UUID
    numero_internacao: str | None = Field(default=None, max_length=30)
    leito: str | None = Field(default=None, max_length=20)
    data_entrada: date


class InternacaoAltaRequest(BaseModel):
    data_alta: date
    motivo_alta: str | None = Field(default=None, max_length=255)


class InternacaoMudancaSetorRequest(BaseModel):
    novo_setor_id: uuid.UUID
    leito: str | None = Field(default=None, max_length=20)


class InternacaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    paciente_id: uuid.UUID
    setor_atual_id: uuid.UUID
    numero_internacao: str | None
    leito: str | None
    data_entrada: date
    data_alta: date | None
    status: str
    motivo_alta: str | None


class InternacaoSetorHistoricoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    setor_id: uuid.UUID
    data_inicio: datetime
    data_fim: datetime | None
