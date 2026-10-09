"""
HemoGest — Schemas do bloco Parametrização.
As 4 entidades (Hemocomponente, MotivoDevolucao — motivos de devolução E
descarte, 2026-10-05, pedido do cliente —, TipoReacao, Gravidade)
compartilham a mesma forma base; cada uma estende com seus campos
específicos.
"""
import uuid

from pydantic import BaseModel, ConfigDict, Field


class ParametrizacaoItemBase(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    descricao: str | None = Field(default=None, max_length=255)
    cor: str | None = Field(default=None, max_length=7, pattern=r"^#[0-9A-Fa-f]{6}$")
    ordem: int = 0


class ParametrizacaoItemUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=120)
    descricao: str | None = Field(default=None, max_length=255)
    cor: str | None = Field(default=None, max_length=7, pattern=r"^#[0-9A-Fa-f]{6}$")
    ordem: int | None = None
    ativo: bool | None = None


class ParametrizacaoItemOut(ParametrizacaoItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ativo: bool


# --- Motivos de Devolução/Descarte / Tipo de Reação: usam a forma base ---
MotivoDevolucaoCreate = ParametrizacaoItemBase
MotivoDevolucaoOut = ParametrizacaoItemOut
TipoReacaoCreate = ParametrizacaoItemBase
TipoReacaoOut = ParametrizacaoItemOut


# --- Hemocomponente: campos extras ---
class HemocomponenteCreate(ParametrizacaoItemBase):
    sigla: str | None = Field(default=None, max_length=10)
    validade_padrao_dias: int | None = Field(default=None, ge=1)


class HemocomponenteUpdate(ParametrizacaoItemUpdate):
    sigla: str | None = Field(default=None, max_length=10)
    validade_padrao_dias: int | None = Field(default=None, ge=1)


class HemocomponenteOut(ParametrizacaoItemOut):
    sigla: str | None
    validade_padrao_dias: int | None


# --- Gravidade: campo extra "nivel" ---
class GravidadeCreate(ParametrizacaoItemBase):
    nivel: int = Field(ge=1, le=10)


class GravidadeUpdate(ParametrizacaoItemUpdate):
    nivel: int | None = Field(default=None, ge=1, le=10)


class GravidadeOut(ParametrizacaoItemOut):
    nivel: int
