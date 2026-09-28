import uuid
from datetime import date, datetime, time, timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MODIFICACOES = ("Aliquotagem", "Filtração", "Irradiação", "Lavagem")


def _limpo(valor: str | None) -> str | None:
    if valor is None:
        return None
    valor = " ".join(valor.split())
    return valor or None


class FormularioItemIn(BaseModel):
    hemocomponente_id: uuid.UUID
    quantidade: int = Field(ge=1, le=2000)
    unidade_medida: Literal["UNIDADE", "ML"] = "UNIDADE"
    modificacoes: list[Literal["Aliquotagem", "Filtração", "Irradiação", "Lavagem"]] = Field(default_factory=list)

    @model_validator(mode="after")
    def _limites(self) -> "FormularioItemIn":
        if self.unidade_medida == "UNIDADE" and self.quantidade > 20:
            raise ValueError("Quantidade em unidades não pode passar de 20.")
        self.modificacoes = list(dict.fromkeys(self.modificacoes))
        return self


class FormularioCreate(BaseModel):
    # Isca para robôs: campo escondido na tela, que uma pessoa nunca preenche.
    website: str | None = Field(default=None, max_length=200)

    convenio: str | None = Field(default=None, max_length=60)
    data_solicitacao: date
    hora_solicitacao: time

    nome_paciente: str = Field(min_length=3, max_length=200)
    prontuario: str = Field(min_length=1, max_length=30)
    sexo: Literal["M", "F"]
    data_nascimento: date
    nome_mae: str = Field(min_length=3, max_length=200)
    raca_cor: Literal["Branca", "Preta", "Parda", "Amarela", "Indígena"]
    setor_nome: str = Field(min_length=2, max_length=120)
    leito: str = Field(min_length=1, max_length=20)
    peso_kg: float = Field(gt=0, le=500)

    diagnostico: str = Field(min_length=2, max_length=500)
    hb: str = Field(min_length=1, max_length=20)
    ht: str = Field(min_length=1, max_length=20)
    plaquetas: str = Field(min_length=1, max_length=20)
    tp: str | None = Field(default=None, max_length=20)
    ttpa: str | None = Field(default=None, max_length=20)

    indicacao: Literal["USO", "RESERVA"]
    antecedentes_transfusionais: bool
    antecedentes_obstetricos: bool | None = None
    reacao_previa: bool
    reacao_previa_descricao: str | None = Field(default=None, max_length=500)

    itens: list[FormularioItemIn] = Field(min_length=1, max_length=3)
    modalidade: Literal["EMERGENCIA", "URGENCIA", "ROTINA", "PROGRAMADA"]
    observacoes: str | None = Field(default=None, max_length=2000)

    termo_heterogrupo_medico: str | None = Field(default=None, max_length=120)
    termo_heterogrupo_crm: str | None = Field(default=None, max_length=30)
    termo_emergencia_medico: str | None = Field(default=None, max_length=120)
    termo_emergencia_crm: str | None = Field(default=None, max_length=30)

    medico_nome: str = Field(min_length=3, max_length=120)
    medico_crm: str = Field(min_length=2, max_length=30)

    @field_validator(
        "convenio", "nome_paciente", "prontuario", "nome_mae", "setor_nome", "leito", "diagnostico", "hb", "ht",
        "plaquetas", "tp", "ttpa", "reacao_previa_descricao", "termo_heterogrupo_medico", "termo_heterogrupo_crm",
        "termo_emergencia_medico", "termo_emergencia_crm", "medico_nome", "medico_crm",
    )
    @classmethod
    def _sem_espacos_sobrando(cls, v: str | None) -> str | None:
        return _limpo(v)

    @field_validator("observacoes")
    @classmethod
    def _observacoes(cls, v: str | None) -> str | None:
        return v.strip() or None if v else None

    @field_validator("data_nascimento")
    @classmethod
    def _nascimento(cls, v: date) -> date:
        if v > date.today() or v.year < 1900:
            raise ValueError("Data de nascimento inválida.")
        return v

    @field_validator("data_solicitacao")
    @classmethod
    def _data_solicitacao(cls, v: date) -> date:
        # 1 dia de folga: o relógio de quem preenche pode estar em outro fuso.
        if v > date.today() + timedelta(days=1):
            raise ValueError("Data da solicitação não pode estar no futuro.")
        return v

    @model_validator(mode="after")
    def _regras_cruzadas(self) -> "FormularioCreate":
        if self.sexo == "F":
            if self.antecedentes_obstetricos is None:
                raise ValueError("Informe os antecedentes obstétricos.")
        else:
            self.antecedentes_obstetricos = None
        if self.reacao_previa:
            if not self.reacao_previa_descricao:
                raise ValueError("Descreva a reação transfusional anterior.")
        else:
            self.reacao_previa_descricao = None
        return self


class EstabelecimentoOut(BaseModel):
    nome: str
    razao_social: str
    cnpj: str
    cnes: str | None
    endereco: str | None
    cidade: str | None
    uf: str | None


class HemocomponentePublicoOut(BaseModel):
    id: uuid.UUID
    nome: str
    sigla: str | None


class FormularioConfigOut(BaseModel):
    estabelecimento: EstabelecimentoOut
    hemocomponentes: list[HemocomponentePublicoOut]
    setores: list[str]


class FormularioCriadoOut(BaseModel):
    protocolo: str
    token_impressao: str
    criado_em: datetime


class FormularioItemOut(BaseModel):
    hemocomponente_id: uuid.UUID | None = None
    hemocomponente_nome: str
    hemocomponente_sigla: str | None = None
    quantidade: int
    unidade_medida: str
    modificacoes: list[str]


class FormularioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    protocolo: str
    criado_em: datetime
    estabelecimento: EstabelecimentoOut
    convenio: str | None
    data_solicitacao: date
    hora_solicitacao: time

    nome_paciente: str
    prontuario: str
    sexo: str
    data_nascimento: date
    nome_mae: str
    raca_cor: str
    setor_nome: str
    leito: str
    peso_kg: float

    diagnostico: str
    hb: str
    ht: str
    plaquetas: str
    tp: str | None
    ttpa: str | None

    indicacao: str
    antecedentes_transfusionais: bool
    antecedentes_obstetricos: bool | None
    reacao_previa: bool
    reacao_previa_descricao: str | None

    itens: list[FormularioItemOut]
    modalidade: str
    observacoes: str | None

    termo_heterogrupo_medico: str | None
    termo_heterogrupo_crm: str | None
    termo_emergencia_medico: str | None
    termo_emergencia_crm: str | None

    medico_nome: str
    medico_crm: str


class FormularioResumoOut(BaseModel):
    id: uuid.UUID
    protocolo: str
    criado_em: datetime
    data_solicitacao: date
    hora_solicitacao: time
    nome_paciente: str
    setor_nome: str
    leito: str
    modalidade: str
    medico_nome: str
    hemocomponentes: list[str]
