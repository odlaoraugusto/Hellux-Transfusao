import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.validacoes import cpf_valido


def _validar_cpf(v: str | None) -> str | None:
    if v is None:
        return v
    digitos = "".join(ch for ch in v if ch.isdigit())
    if not cpf_valido(digitos):
        raise ValueError("CPF inválido.")
    return digitos


class PacienteBase(BaseModel):
    """Só o formato dos campos — sem validação de CPF aqui, porque
    `PacienteOut` também herda daqui pra SAÍDA da API (2026-10-02,
    correção de bug real: a checagem de dígito verificador do CPF
    rodando na saída derrubava a listagem inteira de pacientes assim que
    batia num cadastro antigo com CPF digitado errado antes dessa
    validação existir — a validação de verdade fica só em
    PacienteCreate/PacienteUpdate, na entrada)."""

    nome: str = Field(min_length=2, max_length=200)
    data_nascimento: date | None = None
    sexo: str | None = Field(default=None, pattern="^[MFI]$")
    cpf: str | None = Field(default=None, min_length=11, max_length=11)
    cns: str | None = Field(default=None, max_length=15)
    numero_prontuario: str | None = Field(default=None, max_length=30)
    tipo_sanguineo: str | None = Field(default=None, max_length=3)
    telefone: str | None = Field(default=None, max_length=20)
    nome_mae: str | None = Field(default=None, max_length=200)


class PacienteCreate(PacienteBase):
    @field_validator("cpf")
    @classmethod
    def _somente_digitos_cpf(cls, v: str | None) -> str | None:
        return _validar_cpf(v)


class PacienteUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=200)
    data_nascimento: date | None = None
    sexo: str | None = Field(default=None, pattern="^[MFI]$")
    cpf: str | None = Field(default=None, min_length=11, max_length=11)
    cns: str | None = Field(default=None, max_length=15)
    numero_prontuario: str | None = Field(default=None, max_length=30)
    tipo_sanguineo: str | None = Field(default=None, max_length=3)
    telefone: str | None = Field(default=None, max_length=20)
    nome_mae: str | None = Field(default=None, max_length=200)

    @field_validator("cpf")
    @classmethod
    def _somente_digitos_cpf(cls, v: str | None) -> str | None:
        return _validar_cpf(v)


class PacienteOut(PacienteBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
