import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class UnidadeHemocomponenteCreate(BaseModel):
    hemocomponente_id: uuid.UUID
    numero_bolsa: str = Field(min_length=1, max_length=30)
    tipo_sanguineo: str | None = Field(default=None, max_length=3)
    data_coleta: date | None = None
    data_validade: date


class FracionarRequest(BaseModel):
    quantidade_fracoes: int = Field(ge=2, le=10, description="Em quantas bolsas satélites fracionar")


class ReservarRequest(BaseModel):
    paciente_id: uuid.UUID


class UnidadeHemocomponenteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    hemocomponente_id: uuid.UUID
    numero_bolsa: str
    codigo_satelite: str | None
    bolsa_mae_id: uuid.UUID | None
    tipo_sanguineo: str | None
    data_coleta: date | None
    data_validade: date
    status: str
    paciente_reservado_id: uuid.UUID | None
