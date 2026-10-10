import uuid

from pydantic import BaseModel, ConfigDict, Field


class UnidadeHospitalarCreate(BaseModel):
    razao_social: str = Field(min_length=2, max_length=255)
    nome_fantasia: str = Field(min_length=2, max_length=255)
    cnpj: str = Field(min_length=14, max_length=14)
    codigo_cnes: str | None = Field(default=None, max_length=20)
    endereco: str | None = Field(default=None, max_length=255)
    cidade: str | None = Field(default=None, max_length=120)
    uf: str | None = Field(default=None, min_length=2, max_length=2)
    telefone: str | None = Field(default=None, max_length=20)


class UnidadeHospitalarUpdate(BaseModel):
    razao_social: str | None = Field(default=None, min_length=2, max_length=255)
    nome_fantasia: str | None = Field(default=None, min_length=2, max_length=255)
    codigo_cnes: str | None = Field(default=None, max_length=20)
    endereco: str | None = Field(default=None, max_length=255)
    cidade: str | None = Field(default=None, max_length=120)
    uf: str | None = Field(default=None, min_length=2, max_length=2)
    telefone: str | None = Field(default=None, max_length=20)
    ativo: bool | None = None


class UnidadeHospitalarOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    razao_social: str
    nome_fantasia: str
    cnpj: str
    codigo_cnes: str | None
    endereco: str | None
    cidade: str | None
    uf: str | None
    telefone: str | None
    logo_object_name: str | None
    ativo: bool
    modulo_estoque_ativo: bool
    modulo_mapa_trabalho_ativo: bool
    modulo_solicitacao_hemocentro_ativo: bool


class UnidadeHospitalarLogoOut(BaseModel):
    logo_url: str


class ModulosUpdate(BaseModel):
    """Só o Admin Global edita (ver require_roles() em
    app.api.v1.unidades_hospitalares) — é decisão de implantação/TI, não do
    dia a dia assistencial da unidade. Ver MODULOS.md."""

    modulo_estoque_ativo: bool | None = None
    modulo_mapa_trabalho_ativo: bool | None = None
    modulo_solicitacao_hemocentro_ativo: bool | None = None
