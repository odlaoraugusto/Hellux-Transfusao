import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

_TIPO_SANGUINEO = "^(O|A|B|AB)[+-]$"


class SolicitacaoCreate(BaseModel):
    internacao_id: uuid.UUID
    hemocomponente_id: uuid.UUID
    quantidade: int = Field(default=1, ge=1, le=20)
    prioridade: str = Field(default="ROTINA", pattern="^(ROTINA|URGENTE|EMERGENCIA)$")
    setor_solicitante_id: uuid.UUID | None = Field(
        default=None, description="Se omitido, usa o setor atual da internação."
    )
    indicacao: str | None = Field(default=None, max_length=2000)
    medico_solicitante: str | None = Field(default=None, max_length=120)


class SolicitacaoEntregaRequest(BaseModel):
    abo_paciente: str = Field(pattern=_TIPO_SANGUINEO)
    bolsas: list[uuid.UUID] = Field(min_length=1, max_length=20)
    prova_cruzada: str | None = Field(default=None, pattern="^(COMPATIVEL|INCOMPATIVEL|NAO_SE_APLICA)$")
    temperatura_transporte_c: float | None = Field(default=None, ge=-40, le=40)
    recebido_por: str = Field(min_length=2, max_length=120)
    autorizacao_ressalva: bool = False
    observacoes: str | None = Field(default=None, max_length=2000)


class SolicitacaoBolsaOut(BaseModel):
    id: uuid.UUID
    numero_bolsa: str
    codigo_satelite: str | None
    tipo_sanguineo: str | None
    data_validade: date


class SolicitacaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    internacao_id: uuid.UUID
    paciente_id: uuid.UUID
    paciente_nome: str
    setor_solicitante_id: uuid.UUID
    setor_nome: str
    hemocomponente_id: uuid.UUID
    hemocomponente_nome: str
    hemocomponente_sigla: str | None
    quantidade: int
    prioridade: str
    indicacao: str | None
    medico_solicitante: str | None
    status: str
    data_solicitacao: datetime
    data_inicio_processamento: datetime | None
    data_entrega: datetime | None
    abo_paciente: str | None
    prova_cruzada: str | None
    temperatura_transporte_c: float | None
    recebido_por: str | None
    liberacao_com_ressalva: bool | None
    observacoes_entrega: str | None
    bolsas: list[SolicitacaoBolsaOut] = []
