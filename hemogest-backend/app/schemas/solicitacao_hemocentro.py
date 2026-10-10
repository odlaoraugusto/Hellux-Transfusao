import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

_TIPO_SANGUINEO = "^(O|A|B|AB)[+-]$"


class SolicitacaoHemocentroItemCreate(BaseModel):
    hemocomponente_id: uuid.UUID
    quantidade_solicitada: int = Field(ge=1, le=200)


class SolicitacaoHemocentroCreate(BaseModel):
    hemocentro_nome: str | None = Field(default=None, max_length=120)
    observacoes: str | None = Field(default=None, max_length=2000)
    itens: list[SolicitacaoHemocentroItemCreate] = Field(min_length=1)


class CancelarSolicitacaoHemocentroRequest(BaseModel):
    motivo: str = Field(min_length=3, max_length=2000)


class BolsaRecebidaItem(BaseModel):
    """Uma bolsa chegada, lançada direto no estoque (mesma forma de
    UnidadeHemocomponenteCreate) — ver solicitacao_hemocentro_service.receber."""

    hemocomponente_id: uuid.UUID
    numero_bolsa: str = Field(min_length=1, max_length=30)
    numero_macarrao: str | None = Field(default=None, max_length=30)
    tipo_sanguineo: str | None = Field(default=None, pattern=_TIPO_SANGUINEO)
    data_coleta: date | None = None
    data_validade: date


class ReceberSolicitacaoHemocentroRequest(BaseModel):
    bolsas: list[BolsaRecebidaItem] = Field(min_length=1)


class SolicitacaoHemocentroItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    hemocomponente_id: uuid.UUID
    quantidade_solicitada: int


class SolicitacaoHemocentroOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    hemocentro_nome: str | None
    status: str
    data_solicitacao: datetime
    data_envio: datetime | None
    data_recebimento: datetime | None
    observacoes: str | None
    itens: list[SolicitacaoHemocentroItemOut]
