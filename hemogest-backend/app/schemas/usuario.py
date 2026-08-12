"""
HemoGest — Schemas de Usuário e Autenticação.
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UsuarioBase(BaseModel):
    nome: str = Field(min_length=2, max_length=150)
    email: EmailStr


class UsuarioCreate(UsuarioBase):
    role_id: uuid.UUID
    unidade_hospitalar_id: uuid.UUID | None = None
    # Sem senha aqui: usuário é criado em estado "primeiro acesso" e recebe
    # um link de definição de senha (fluxo de recuperação reutilizado).


class UsuarioUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=150)
    role_id: uuid.UUID | None = None
    unidade_hospitalar_id: uuid.UUID | None = None
    ativo: bool | None = None


class UsuarioOut(UsuarioBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role_id: uuid.UUID
    unidade_hospitalar_id: uuid.UUID | None
    ativo: bool
    primeiro_acesso: bool
    ultimo_login_em: datetime | None


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class AlterarSenhaRequest(BaseModel):
    senha_atual: str
    nova_senha: str = Field(min_length=8)


class SolicitarRecuperacaoRequest(BaseModel):
    email: EmailStr


class RedefinirSenhaRequest(BaseModel):
    token: str
    nova_senha: str = Field(min_length=8)
