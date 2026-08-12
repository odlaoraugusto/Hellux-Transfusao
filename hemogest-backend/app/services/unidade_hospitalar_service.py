"""
HemoGest — Service de Unidade Hospitalar.
Criação restrita a Administrador Global (é o onboarding de um novo tenant
no SaaS). Edição/logo liberadas a Supervisor+ da própria unidade.
"""
import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import registrar_auditoria
from app.db.base_mixins import utcnow
from app.models.audit_log import AcaoAuditoria
from app.models.unidade_hospitalar import UnidadeHospitalar
from app.schemas.unidade_hospitalar import UnidadeHospitalarCreate, UnidadeHospitalarUpdate
from app.services.storage import get_storage_service

_TIPOS_IMAGEM_ACEITOS = {"image/png", "image/jpeg", "image/svg+xml"}
_TAMANHO_MAXIMO_LOGO_BYTES = 5 * 1024 * 1024  # 5 MB


def list_unidades(db: Session) -> list[UnidadeHospitalar]:
    stmt = select(UnidadeHospitalar).where(UnidadeHospitalar.deleted_at.is_(None)).order_by(
        UnidadeHospitalar.nome_fantasia
    )
    return list(db.scalars(stmt))


def get_unidade(db: Session, unidade_id: uuid.UUID) -> UnidadeHospitalar:
    unidade = db.get(UnidadeHospitalar, unidade_id)
    if unidade is None or unidade.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unidade hospitalar não encontrada.")
    return unidade


def create_unidade(db: Session, payload: UnidadeHospitalarCreate, *, actor_id: uuid.UUID) -> UnidadeHospitalar:
    existente = db.scalar(select(UnidadeHospitalar).where(UnidadeHospitalar.cnpj == payload.cnpj))
    if existente is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe uma unidade com este CNPJ.")

    unidade = UnidadeHospitalar(**payload.model_dump(), created_by=actor_id, updated_by=actor_id)
    db.add(unidade)
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="unidade_hospitalar", entidade_id=unidade.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade.id,
    )
    db.commit()
    db.refresh(unidade)
    return unidade


def update_unidade(
    db: Session, unidade_id: uuid.UUID, payload: UnidadeHospitalarUpdate, *, actor_id: uuid.UUID
) -> UnidadeHospitalar:
    unidade = get_unidade(db, unidade_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(unidade, field, value)
    unidade.updated_by = actor_id
    unidade.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="unidade_hospitalar", entidade_id=unidade.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade.id,
    )
    db.commit()
    db.refresh(unidade)
    return unidade


def upload_logo(db: Session, unidade_id: uuid.UUID, arquivo: UploadFile, *, actor_id: uuid.UUID) -> str:
    unidade = get_unidade(db, unidade_id)

    if arquivo.content_type not in _TIPOS_IMAGEM_ACEITOS:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Formato não suportado. Aceitos: {', '.join(sorted(_TIPOS_IMAGEM_ACEITOS))}.",
        )

    conteudo = arquivo.file.read()
    if len(conteudo) > _TAMANHO_MAXIMO_LOGO_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Logo excede 5 MB.")

    extensao = arquivo.filename.rsplit(".", 1)[-1] if arquivo.filename and "." in arquivo.filename else "png"
    object_name = f"{unidade_id}/logo/logo.{extensao}"

    storage = get_storage_service()
    storage.upload(object_name, conteudo, arquivo.content_type)

    unidade.logo_object_name = object_name
    unidade.updated_by = actor_id
    unidade.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.UPLOAD, entidade="unidade_hospitalar_logo", entidade_id=unidade.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade.id, detalhes={"object_name": object_name},
    )
    db.commit()

    return storage.get_presigned_url(object_name)
