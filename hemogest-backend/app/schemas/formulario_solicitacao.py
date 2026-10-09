import re
import uuid
from datetime import date, datetime, time, timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.validacoes import cpf_valido

# Os 4 hemocomponentes do documento oficial (STH Rev.5) — fixos, não um
# catálogo configurável por unidade. Cada um só aceita as modificações que
# fazem sentido clinicamente para ele (mesma regra do papel).
TipoHemocomponente = Literal["CH", "PF", "CP", "CR"]
Modificacao = Literal["ALI", "FIL", "IRR", "LAV"]

MODIFICACOES_POR_TIPO: dict[str, set[str]] = {
    "CH": {"ALI", "FIL", "IRR", "LAV"},
    "PF": {"ALI"},
    "CP": {"ALI", "FIL", "IRR"},
    "CR": set(),
}

NOME_TIPO: dict[str, str] = {
    "CH": "Concentrado de Hemácias",
    "PF": "Plasma Fresco",
    "CP": "Concentrado de Plaquetas",
    "CR": "Crioprecipitado",
}

# Unidades/enfermarias fixas desta unidade hospitalar (2026-09-30, pedido
# do cliente) — mesmo raciocínio dos 4 hemocomponentes fixos: reflete a
# realidade física do hospital, não um catálogo configurável.
SetorFixo = Literal[
    "UTI Neonatal", "UTI Pediátrica", "Enfermaria Pediátrica", "UCINCo", "Canguru", "UCINCa",
    "Emergência Pediátrica", "Emergência Obstétrica", "Centro Obstétrico", "Centro Cirúrgico",
    "Alojamento Conjunto",
]


def _limpo(valor: str | None) -> str | None:
    if valor is None:
        return None
    valor = " ".join(valor.split())
    return valor or None


def _so_digitos(valor: str) -> str:
    return re.sub(r"\D", "", valor)


class FormularioItemIn(BaseModel):
    tipo: TipoHemocomponente
    quantidade: int = Field(ge=1, le=2000)
    unidade_medida: Literal["UNIDADE", "ML"] = "UNIDADE"
    modificacoes: list[Modificacao] = Field(default_factory=list)

    @model_validator(mode="after")
    def _limites(self) -> "FormularioItemIn":
        if self.unidade_medida == "UNIDADE" and self.quantidade > 20:
            raise ValueError("Quantidade em unidades não pode passar de 20.")
        permitidas = MODIFICACOES_POR_TIPO[self.tipo]
        invalidas = [m for m in self.modificacoes if m not in permitidas]
        if invalidas:
            raise ValueError(f"{NOME_TIPO[self.tipo]} não aceita a(s) modificação(ões) {', '.join(invalidas)}.")
        self.modificacoes = list(dict.fromkeys(self.modificacoes))
        return self


class FormularioCreate(BaseModel):
    # Isca para robôs: campo escondido na tela, que uma pessoa nunca preenche.
    website: str | None = Field(default=None, max_length=200)

    convenio: str | None = Field(default=None, max_length=60)
    data_solicitacao: date
    hora_solicitacao: time

    nome_paciente: str = Field(min_length=3, max_length=200)
    cpf: str = Field(max_length=14)
    # Recém-nascido pode ainda não ter CPF próprio — nesse caso o campo
    # recebe o CPF da mãe, marcado aqui (2026-10-02, pedido do cliente) pra
    # não ser confundido com o CPF do próprio paciente na folha impressa.
    cpf_e_da_mae: bool = Field(default=False)
    # Oficialmente obrigatório, mas não trava — mesmo motivo do prontuário
    # (2026-10-02, pedido do cliente: "alguns já estão atualizados pro
    # número do CPF", nem sempre a pessoa tem o CNS em mãos na hora).
    cns: str | None = Field(default=None, max_length=18)
    nome_social: str | None = Field(default=None, max_length=200)
    # Oficialmente obrigatório (cobrado de todo mundo que preenche), mas não
    # trava no backend (2026-10-02, pedido do cliente: "quando tiver na
    # contingência sem sistema, isso não ser uma trava" — o pedido de
    # sangue não pode esperar o prontuário sair).
    prontuario: str | None = Field(default=None, max_length=30)
    sexo: Literal["M", "F"]
    data_nascimento: date
    nome_mae: str = Field(min_length=3, max_length=200)
    raca_cor: Literal["Branca", "Preta", "Parda", "Amarela", "Indígena"] | None = None
    setor_nome: SetorFixo
    leito: str | None = Field(default=None, max_length=20)
    peso_kg: float | None = Field(default=None, gt=0, le=500)

    cep: str = Field(min_length=8, max_length=9)
    logradouro: str = Field(min_length=2, max_length=255)
    numero: str = Field(min_length=1, max_length=20)
    bairro: str | None = Field(default=None, max_length=255)
    cidade: str = Field(min_length=2, max_length=120)
    uf: str = Field(min_length=2, max_length=2)
    codigo_ibge: str | None = Field(default=None, max_length=10)

    diagnostico: str = Field(min_length=2, max_length=500)
    hb: str = Field(min_length=1, max_length=20)
    ht: str = Field(min_length=1, max_length=20)
    plaquetas: str | None = Field(default=None, max_length=20)
    tp: str | None = Field(default=None, max_length=20)
    ttpa: str | None = Field(default=None, max_length=20)

    indicacao: Literal["USO", "RESERVA"]
    antecedentes_transfusionais: bool
    antecedentes_obstetricos: bool | None = None
    reacao_previa: bool
    reacao_previa_descricao: str | None = Field(default=None, max_length=500)

    itens: list[FormularioItemIn] = Field(min_length=1, max_length=4)
    modalidade: Literal["EMERGENCIA", "URGENCIA", "ROTINA", "PROGRAMADA"]
    data_programada: date | None = None
    hora_programada: time | None = None
    observacoes: str | None = Field(default=None, max_length=2000)

    medico_nome: str = Field(min_length=3, max_length=120)
    medico_crm: str = Field(min_length=2, max_length=30)

    @field_validator(
        "convenio", "nome_paciente", "nome_social", "prontuario", "nome_mae", "setor_nome", "leito", "diagnostico",
        "hb", "ht", "plaquetas", "tp", "ttpa", "reacao_previa_descricao", "medico_nome", "medico_crm",
        "logradouro", "numero", "bairro", "cidade",
    )
    @classmethod
    def _sem_espacos_sobrando(cls, v: str | None) -> str | None:
        return _limpo(v)

    @field_validator("cep")
    @classmethod
    def _cep(cls, v: str) -> str:
        digitos = _so_digitos(v)
        if len(digitos) != 8:
            raise ValueError("CEP precisa ter 8 dígitos.")
        return f"{digitos[:5]}-{digitos[5:]}"

    @field_validator("uf")
    @classmethod
    def _uf(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("cpf")
    @classmethod
    def _cpf(cls, v: str) -> str:
        digitos = _so_digitos(v)
        # Confere os dígitos verificadores de verdade (2026-10-02, pedido do
        # cliente) — "000.000.000-00" ou qualquer sequência digitada só pra
        # passar pela obrigatoriedade do campo não tem mais passagem.
        if not cpf_valido(digitos):
            raise ValueError("CPF inválido.")
        return digitos

    @field_validator("cns")
    @classmethod
    def _cns(cls, v: str | None) -> str | None:
        if not v:
            return None
        digitos = _so_digitos(v)
        if len(digitos) != 15:
            raise ValueError("Cartão Nacional de Saúde (CNS) precisa ter 15 dígitos.")
        return digitos

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
        if self.modalidade == "PROGRAMADA":
            if not self.data_programada or not self.hora_programada:
                raise ValueError("Informe a data e a hora programadas.")
        else:
            self.data_programada = None
            self.hora_programada = None
        tipos = [item.tipo for item in self.itens]
        if len(tipos) != len(set(tipos)):
            raise ValueError("Cada hemocomponente só pode aparecer uma vez.")
        return self


class EstabelecimentoOut(BaseModel):
    nome: str
    razao_social: str
    cnpj: str
    cnes: str | None
    endereco: str | None
    cidade: str | None
    uf: str | None
    telefone: str | None


class FormularioConfigOut(BaseModel):
    estabelecimento: EstabelecimentoOut


class FormularioCriadoOut(BaseModel):
    protocolo: str
    token_impressao: str
    criado_em: datetime


class PacientePrefillOut(BaseModel):
    """Pré-preenchimento do formulário público a partir do prontuário já
    cadastrado nesta unidade (2026-10-01, pedido do cliente: "não importa
    os dados salvos do paciente"). Vem do último formulário recebido desse
    paciente — tem mais campos que o cadastro de Paciente (endereço, raça/
    cor, peso) — com fallback pro cadastro quando não há formulário
    anterior (paciente só existe por cadastro manual na tela de Pacientes)."""

    nome_paciente: str
    nome_social: str | None
    cpf: str | None
    cpf_e_da_mae: bool = False
    cns: str | None
    sexo: str | None
    data_nascimento: date | None
    nome_mae: str | None
    raca_cor: str | None
    peso_kg: float | None
    cep: str | None
    logradouro: str | None
    numero: str | None
    bairro: str | None
    cidade: str | None
    uf: str | None
    codigo_ibge: str | None


class PacienteBuscaOut(BaseModel):
    """Resultado leve de busca por nome (2026-10-02, pedido do cliente:
    "quando ficamos sem sistema, não temos prontuário de alguns
    pacientes") — só o suficiente pra reconhecer o paciente certo na
    lista; sem CPF/CNS/endereço aqui (isso só vem depois, ao abrir o
    prontuário encontrado via `paciente-por-prontuario`)."""

    numero_prontuario: str
    nome_paciente: str
    data_nascimento: date | None


class MedicoLookupOut(BaseModel):
    nome: str


class FormularioItemOut(BaseModel):
    tipo: TipoHemocomponente
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
    cpf: str | None
    cpf_e_da_mae: bool
    cns: str | None
    nome_social: str | None
    prontuario: str | None
    sexo: str
    data_nascimento: date
    nome_mae: str
    raca_cor: str | None
    setor_nome: str
    leito: str | None
    peso_kg: float | None

    cep: str | None
    logradouro: str | None
    numero: str | None
    bairro: str | None
    cidade: str | None
    uf: str | None
    codigo_ibge: str | None

    diagnostico: str
    hb: str
    ht: str
    plaquetas: str | None
    tp: str | None
    ttpa: str | None

    indicacao: str
    antecedentes_transfusionais: bool
    antecedentes_obstetricos: bool | None
    reacao_previa: bool
    reacao_previa_descricao: str | None

    itens: list[FormularioItemOut]
    modalidade: str
    data_programada: date | None
    hora_programada: time | None
    observacoes: str | None

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
    leito: str | None
    modalidade: str
    medico_nome: str
    hemocomponentes: list[str]
