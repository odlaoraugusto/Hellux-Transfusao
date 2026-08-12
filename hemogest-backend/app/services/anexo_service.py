"""
HemoGest — Service de Anexos (Fase 9).
Genérico por design: qualquer entidade da whitelist abaixo pode anexar
fotos/documentos. Objeto físico no MinIO; aqui só metadado + auditoria.
Download nunca expõe URL pública direta — sempre pré-assinada e de curta duração.
"""
import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import registrar_auditoria
from app.models.anexo import Anexo
from app.models.audit_log import AcaoAuditoria
from app.services.storage import get_storage_service

ENTIDADES_PERMITIDAS = {"devolucao", "descarte", "reacao_transfusional"}
_TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024  # 15 MB

# Content-Type declarado pelo cliente é só um filtro inicial — nunca confiável
# sozinho (fácil de forjar). A assinatura binária (magic bytes) confirma que o
# conteúdo de fato corresponde ao tipo declarado, fechando o vetor de um
# upload malicioso (ex.: HTML/SVG com script) disfarçado de imagem/PDF.
_TIPOS_ACEITOS: dict[str, bytes] = {
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/jpeg": b"\xff\xd8\xff",
    "application/pdf": b"%PDF-",
}


def _validar_entidade(entidade: str) -> None:
    if entidade not in ENTIDADES_PERMITIDAS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Entidade '{entidade}' não aceita anexos. Permitidas: {', '.join(sorted(ENTIDADES_PERMITIDAS))}.",
        )


def _validar_arquivo(content_type: str | None, conteudo: bytes) -> None:
    assinatura = _TIPOS_ACEITOS.get(content_type or "")
    if assinatura is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Formato não suportado. Aceitos: {', '.join(sorted(_TIPOS_ACEITOS))}.",
        )
    if not conteudo.startswith(assinatura):
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "O conteúdo do arquivo não corresponde ao tipo declarado.",
        )


def listar(db: Session, entidade: str, entidade_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID) -> list[Anexo]:
    _validar_entidade(entidade)
    stmt = (
        select(Anexo)
        .where(Anexo.entidade == entidade)
        .where(Anexo.entidade_id == entidade_id)
        .where(Anexo.unidade_hospitalar_id == unidade_hospitalar_id)
        .order_by(Anexo.created_at)
    )
    return list(db.scalars(stmt))


def upload(
    db: Session, entidade: str, entidade_id: uuid.UUID, arquivo: UploadFile, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> Anexo:
    _validar_entidade(entidade)
    conteudo = arquivo.file.read()
    if len(conteudo) > _TAMANHO_MAXIMO_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Anexo excede 15 MB.")
    _validar_arquivo(arquivo.content_type, conteudo)

    object_name = f"{unidade_hospitalar_id}/{entidade}/{entidade_id}/{uuid.uuid4()}_{arquivo.filename}"
    storage = get_storage_service()
    storage.upload(object_name, conteudo, arquivo.content_type or "application/octet-stream")

    anexo = Anexo(
        entidade=entidade,
        entidade_id=entidade_id,
        object_name=object_name,
        nome_arquivo=arquivo.filename or "arquivo",
        content_type=arquivo.content_type or "application/octet-stream",
        tamanho_bytes=len(conteudo),
        uploaded_by=actor_id,
        unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.add(anexo)
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.UPLOAD, entidade=f"anexo:{entidade}", entidade_id=anexo.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
        detalhes={"nome_arquivo": anexo.nome_arquivo},
    )
    db.commit()
    db.refresh(anexo)
    return anexo


def get_download_url(db: Session, anexo_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID, *, actor_id: uuid.UUID) -> str:
    anexo = db.get(Anexo, anexo_id)
    if anexo is None or anexo.unidade_hospitalar_id != unidade_hospitalar_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Anexo não encontrado.")

    storage = get_storage_service()
    url = storage.get_presigned_url(anexo.object_name)

    registrar_auditoria(
        db, acao=AcaoAuditoria.DOWNLOAD, entidade=f"anexo:{anexo.entidade}", entidade_id=anexo.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    return url
