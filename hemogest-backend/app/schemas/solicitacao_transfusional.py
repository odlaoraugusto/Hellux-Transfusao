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


class RegistrarBolsaRequest(BaseModel):
    """Registro de UMA bolsa (2026-10-01, pedido do cliente) — cada
    solicitação pode ter várias bolsas, registradas uma de cada vez, em
    momentos diferentes (ex.: pediu 2, só uma chegou hoje). Cada chamada
    gera a Folha de Hemotransfusão daquela bolsa e confere compatibilidade
    com o paciente antes de liberar."""

    abo_paciente: str = Field(pattern=_TIPO_SANGUINEO)
    # PAI = Pesquisa de Anticorpos Irregulares (2026-10-01, correção de bug
    # real — era "nome do pai" por engano) — exame pré-transfusional do
    # paciente, sai junto com o ABO/Rh, travado na primeira bolsa igual
    # abo_paciente.
    pesquisa_anticorpos_irregulares: str = Field(pattern="^(NEGATIVA|POSITIVA|NAO_REALIZADA)$")
    numero_bolsa: str = Field(min_length=1, max_length=50)
    tipo_sanguineo: str = Field(pattern=_TIPO_SANGUINEO)
    data_validade: date
    volume_ml: int | None = Field(default=None, ge=1, le=2000)
    prova_cruzada: str | None = Field(default=None, pattern="^(COMPATIVEL|INCOMPATIVEL|NAO_SE_APLICA)$")
    # Quem fez a prova cruzada/liberou no banco de sangue (2026-10-01,
    # pedido do cliente) — não é o usuário logado no HemoGest.
    responsavel_testes: str = Field(min_length=2, max_length=120)


class CancelarSolicitacaoRequest(BaseModel):
    """Cancelamento (2026-10-01, pedido do cliente: "erro de digitação do
    médico, ou suspensão da transfusão") — motivo é obrigatório, fica
    registrado na solicitação e na trilha de auditoria."""

    motivo: str = Field(min_length=3, max_length=2000)


class EntregarBolsaRequest(BaseModel):
    """Registro do recebimento físico de UMA bolsa — independente das
    outras bolsas da mesma solicitação (2026-10-01, pedido do cliente:
    "posso entregar uma bolsa primeiro e a segunda depois")."""

    temperatura_transporte_c: float | None = Field(default=None, ge=-40, le=40)
    recebido_por: str = Field(min_length=2, max_length=120)
    observacoes: str | None = Field(default=None, max_length=2000)


class SolicitacaoBolsaOut(BaseModel):
    id: uuid.UUID
    numero_bolsa: str
    tipo_sanguineo: str
    data_validade: date
    volume_ml: int | None
    prova_cruzada: str | None
    liberacao_com_ressalva: bool
    responsavel_testes: str | None
    folha_emitida_em: datetime
    folha_emitida_por_nome: str | None = None
    # Recebimento desta bolsa — tudo nulo até ser entregue.
    temperatura_transporte_c: float | None
    recebido_por: str | None
    observacoes_entrega: str | None
    entregue_em: datetime | None
    entregue_por_nome: str | None = None


class SolicitacaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    internacao_id: uuid.UUID | None
    formulario_solicitacao_id: uuid.UUID | None
    paciente_id: uuid.UUID
    paciente_nome: str
    setor_solicitante_id: uuid.UUID
    setor_nome: str
    hemocomponente_id: uuid.UUID
    hemocomponente_nome: str
    hemocomponente_sigla: str | None
    quantidade: int
    volume_ml_solicitado: int | None
    prioridade: str
    indicacao: str | None
    medico_solicitante: str | None
    status: str
    data_solicitacao: datetime
    data_inicio_processamento: datetime | None
    data_entrega: datetime | None
    abo_paciente: str | None
    pesquisa_anticorpos_irregulares: str | None
    # Quantas bolsas já foram registradas / entregues, de `quantidade`
    # pedidas — base pro frontend mostrar "Parcial" (2026-10-01, pedido do
    # cliente).
    bolsas_registradas: int = 0
    bolsas_entregues: int = 0
    bolsas: list[SolicitacaoBolsaOut] = []
    motivo_cancelamento: str | None = None
    cancelado_em: datetime | None = None
    cancelado_por_nome: str | None = None


class RegistroBolsaOut(SolicitacaoOut):
    """Resposta de `POST /solicitacoes/{id}/bolsas` — igual à solicitação,
    mais o id da bolsa recém-registrada (pra abrir a folha dela direto)."""

    bolsa_id: uuid.UUID
