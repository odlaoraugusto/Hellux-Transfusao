"""
HemoGest — Schemas de Role (RBAC).
"""
import uuid

from pydantic import BaseModel, ConfigDict, Field


class RoleBase(BaseModel):
    nome_exibicao: str = Field(min_length=2, max_length=80)
    descricao: str | None = Field(default=None, max_length=255)
    permissoes: list[str] = Field(default_factory=list)


class RoleCreate(RoleBase):
    codigo: str = Field(min_length=2, max_length=30, description="Identificador único, ex: SUPERVISOR")


class RoleUpdate(BaseModel):
    nome_exibicao: str | None = Field(default=None, min_length=2, max_length=80)
    descricao: str | None = Field(default=None, max_length=255)
    permissoes: list[str] | None = None


class RolePermissoesUpdate(BaseModel):
    permissoes: list[str] = Field(default_factory=list)


class RoleOut(RoleBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    codigo: str
