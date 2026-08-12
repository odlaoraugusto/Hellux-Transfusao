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


class UnidadeHospitalarUpdate(BaseModel):
    razao_social: str | None = Field(default=None, min_length=2, max_length=255)
    nome_fantasia: str | None = Field(default=None, min_length=2, max_length=255)
    codigo_cnes: str | None = Field(default=None, max_length=20)
    endereco: str | None = Field(default=None, max_length=255)
    cidade: str | None = Field(default=None, max_length=120)
    uf: str | None = Field(default=None, min_length=2, max_length=2)
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
    logo_object_name: str | None
    ativo: bool


class UnidadeHospitalarLogoOut(BaseModel):
    logo_url: str
