import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

_TIPO_SANGUINEO = "^(O|A|B|AB)[+-]$"
_TECNICA = "^(TUBO|GEL|OUTRO)$"


class MapaTrabalhoUpsert(BaseModel):
    """Preenchimento progressivo — tudo opcional, a equipe do laboratório
    completa conforme o teste é feito. Ver MODULOS.md."""

    abo_rh_receptor_confirmado: str | None = Field(default=None, pattern=_TIPO_SANGUINEO)
    abo_rh_doador_confirmado: str | None = Field(default=None, pattern=_TIPO_SANGUINEO)
    metodo_abo_rh: str | None = Field(default=None, pattern=_TECNICA)

    tecnica_prova_cruzada: str | None = Field(default=None, pattern=_TECNICA)
    lote_reagente_pai: str | None = Field(default=None, max_length=60)

    lote_soro_anti_a: str | None = Field(default=None, max_length=60)
    lote_soro_anti_b: str | None = Field(default=None, max_length=60)
    lote_soro_anti_d: str | None = Field(default=None, max_length=60)
    validade_reagentes: date | None = None

    temperatura_amostra_c: float | None = Field(default=None, ge=-40, le=40)

    tecnico_executante_id: uuid.UUID | None = None
    conferente_id: uuid.UUID | None = None

    data_hora_inicio: datetime | None = None
    data_hora_fim: datetime | None = None

    observacoes: str | None = Field(default=None, max_length=2000)


class MapaTrabalhoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    solicitacao_bolsa_id: uuid.UUID
    abo_rh_receptor_confirmado: str | None
    abo_rh_doador_confirmado: str | None
    metodo_abo_rh: str | None
    tecnica_prova_cruzada: str | None
    lote_reagente_pai: str | None
    lote_soro_anti_a: str | None
    lote_soro_anti_b: str | None
    lote_soro_anti_d: str | None
    validade_reagentes: date | None
    temperatura_amostra_c: float | None
    tecnico_executante_id: uuid.UUID | None
    conferente_id: uuid.UUID | None
    data_hora_inicio: datetime | None
    data_hora_fim: datetime | None
    observacoes: str | None
