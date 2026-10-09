import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AcompanhamentoCreate(BaseModel):
    solicitacao_id: uuid.UUID


class AcompanhamentoIniciarRequest(BaseModel):
    # 2026-10-05, pedido do cliente: "permitir colocar o horário de início
    # ... da infusão (atualmente pega o horario automaticamente)" — None
    # mantém o comportamento antigo (usa o horário do servidor).
    data_inicio: datetime | None = None


class AcompanhamentoFinalizarRequest(BaseModel):
    observacoes_finalizacao: str | None = None
    houve_intercorrencia: bool = False
    data_fim: datetime | None = None


class AcompanhamentoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    solicitacao_id: uuid.UUID
    status: str
    data_inicio: datetime | None
    data_fim: datetime | None
    observacoes_finalizacao: str | None


class SinalVitalCreate(BaseModel):
    momento: str = Field(pattern="^(PRE|DEZ_MINUTOS|UMA_HORA|FINAL|EXTRA)$")
    temperatura_c: float | None = Field(default=None, ge=30, le=45)
    pressao_arterial: str | None = Field(default=None, max_length=15)
    frequencia_cardiaca_bpm: int | None = Field(default=None, ge=0, le=300)
    frequencia_respiratoria_ipm: int | None = Field(default=None, ge=0, le=100)
    saturacao_o2_pct: int | None = Field(default=None, ge=0, le=100)
    observacoes: str | None = None


class SinalVitalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    momento: str
    data_hora: datetime
    temperatura_c: float | None
    pressao_arterial: str | None
    frequencia_cardiaca_bpm: int | None
    frequencia_respiratoria_ipm: int | None
    saturacao_o2_pct: int | None
    observacoes: str | None
