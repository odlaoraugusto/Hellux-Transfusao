import uuid

from pydantic import BaseModel, ConfigDict, Field


class SetorCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    sigla: str | None = Field(default=None, max_length=20)


class SetorUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=120)
    sigla: str | None = Field(default=None, max_length=20)
    ativo: bool | None = None


class SetorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nome: str
    sigla: str | None
    ativo: bool
