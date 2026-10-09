"""
HemoGest — Schemas de Usuário e Autenticação.
Login é um nome de usuário simples, não e-mail (ver app.models.usuario).
"""
import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

_LOGIN_VALIDO = re.compile(r"^[a-z0-9._-]+$")


def _validar_login(v: str) -> str:
    v = v.strip().lower()
    if not _LOGIN_VALIDO.match(v):
        raise ValueError("Login só pode ter letras minúsculas, números, ponto, hífen ou underscore.")
    return v


class UsuarioBase(BaseModel):
    nome: str = Field(min_length=2, max_length=150)
    login: str = Field(min_length=3, max_length=60)

    @field_validator("login")
    @classmethod
    def _login(cls, v: str) -> str:
        return _validar_login(v)


class UsuarioCreate(UsuarioBase):
    role_id: uuid.UUID
    unidade_hospitalar_id: uuid.UUID | None = None
    # Senha temporária definida por quem cria a conta (Supervisor/Admin
    # Global) — repassada por fora para a pessoa, que troca no primeiro
    # login (`primeiro_acesso=True`).
    senha: str = Field(min_length=8)


class UsuarioUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=150)
    role_id: uuid.UUID | None = None
    unidade_hospitalar_id: uuid.UUID | None = None
    ativo: bool | None = None
    # Presente = reset de senha (mesmo padrão de criação): força troca no
    # próximo login.
    senha: str | None = Field(default=None, min_length=8)


class UsuarioOut(UsuarioBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role_id: uuid.UUID
    role_codigo: str | None
    unidade_hospitalar_id: uuid.UUID | None
    ativo: bool
    primeiro_acesso: bool
    ultimo_login_em: datetime | None


class LoginRequest(BaseModel):
    login: str
    senha: str

    @field_validator("login")
    @classmethod
    def _login(cls, v: str) -> str:
        return v.strip().lower()


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class AlterarSenhaRequest(BaseModel):
    senha_atual: str
    nova_senha: str = Field(min_length=8)
