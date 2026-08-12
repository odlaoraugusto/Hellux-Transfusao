import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PacienteBase(BaseModel):
    nome: str = Field(min_length=2, max_length=200)
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
        if v is None:
            return v
        v = "".join(ch for ch in v if ch.isdigit())
        if len(v) != 11:
            raise ValueError("CPF deve ter 11 dígitos.")
        return v


class PacienteCreate(PacienteBase):
    pass


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


class PacienteOut(PacienteBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
