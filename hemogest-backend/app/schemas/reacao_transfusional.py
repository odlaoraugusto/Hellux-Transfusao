import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReacaoAberturaRequest(BaseModel):
    acompanhamento_id: uuid.UUID
    tipo_reacao_id: uuid.UUID
    gravidade_id: uuid.UUID
    descricao: str = Field(min_length=5)


class ReacaoInvestigacaoRequest(BaseModel):
    investigacao: str = Field(min_length=5)


class ReacaoNotivisaRequest(BaseModel):
    notivisa_numero: str = Field(min_length=1, max_length=50)


class ReacaoEncerramentoRequest(BaseModel):
    conclusao: str = Field(min_length=5)


class ReacaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    acompanhamento_id: uuid.UUID
    tipo_reacao_id: uuid.UUID
    gravidade_id: uuid.UUID
    status: str
    descricao: str
    data_abertura: datetime
    investigacao: str | None
    notivisa_numero: str | None
    notivisa_data_envio: datetime | None
    conclusao: str | None
    data_encerramento: datetime | None
