import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import registrar_auditoria
from app.db.base_mixins import utcnow
from app.db.encrypted_types import blind_index
from app.models.audit_log import AcaoAuditoria
from app.models.paciente import Paciente
from app.schemas.paciente import PacienteCreate, PacienteUpdate

# Campos com índice cego (busca por igualdade exata sem depender de
# comparar ciphertext não-determinístico) — ver app.db.encrypted_types.
_CAMPOS_COM_HASH = {"cpf": "cpf_hash", "numero_prontuario": "numero_prontuario_hash"}


def _sincronizar_hashes(paciente: Paciente, dados: dict) -> None:
    for campo, campo_hash in _CAMPOS_COM_HASH.items():
        if campo in dados:
            valor = dados[campo]
            setattr(paciente, campo_hash, blind_index(valor) if valor else None)


def search_pacientes(
    db: Session,
    unidade_hospitalar_id: uuid.UUID,
    *,
    termo: str | None = None,
    cpf: str | None = None,
    numero_prontuario: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Paciente]:
    stmt = (
        select(Paciente)
        .where(Paciente.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(Paciente.deleted_at.is_(None))
    )
    if cpf:
        stmt = stmt.where(Paciente.cpf_hash == blind_index(cpf))
    if numero_prontuario:
        stmt = stmt.where(Paciente.numero_prontuario_hash == blind_index(numero_prontuario))

    # Nome/nome da mãe são campos cifrados (ciphertext não-determinístico) —
    # não existe ILIKE possível no SQL para eles. O filtro por `termo` roda
    # em memória, depois que o SQLAlchemy já descriptografou cada linha ao
    # carregar (EncryptedString faz isso de forma transparente). Isso só é
    # viável porque o volume de pacientes por unidade é pequeno (dezenas a
    # poucas centenas, não milhares) — não escalaria sem um índice de busca
    # dedicado (ex.: n-gramas cifrados ou um serviço de busca separado).
    candidatos = list(db.scalars(stmt))
    if termo:
        termo_normalizado = termo.strip().lower()
        candidatos = [
            p
            for p in candidatos
            if termo_normalizado in p.nome.lower()
            or (p.nome_mae is not None and termo_normalizado in p.nome_mae.lower())
        ]
    candidatos.sort(key=lambda p: p.nome.lower())
    return candidatos[offset : offset + limit]


def get_paciente(
    db: Session, paciente_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID, *, actor_id: uuid.UUID | None = None
) -> Paciente:
    paciente = db.get(Paciente, paciente_id)
    if (
        paciente is None
        or paciente.deleted_at is not None
        or paciente.unidade_hospitalar_id != unidade_hospitalar_id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Paciente não encontrado.")

    # Trilha de acesso a prontuário — requisito de responsabilização LGPD
    # ("quem acessou o registro de qual paciente, quando"), distinto da
    # trilha de escrita (CRIACAO/EDICAO) que já existia. Só na consulta de
    # UM paciente específico (visualização de prontuário) — não na busca em
    # lista, que geraria ruído sem o mesmo valor de accountability.
    if actor_id is not None:
        registrar_auditoria(
            db, acao=AcaoAuditoria.LEITURA, entidade="paciente", entidade_id=paciente.id,
            usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
        )
        db.commit()
    return paciente


def create_paciente(
    db: Session, payload: PacienteCreate, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> Paciente:
    if payload.cpf:
        existente = db.scalar(
            select(Paciente)
            .where(Paciente.unidade_hospitalar_id == unidade_hospitalar_id)
            .where(Paciente.cpf_hash == blind_index(payload.cpf))
            .where(Paciente.deleted_at.is_(None))
        )
        if existente is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Já existe um paciente com este CPF nesta unidade.")

    dados = payload.model_dump()
    paciente = Paciente(
        **dados,
        unidade_hospitalar_id=unidade_hospitalar_id,
        created_by=actor_id,
        updated_by=actor_id,
    )
    _sincronizar_hashes(paciente, dados)
    db.add(paciente)
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="paciente", entidade_id=paciente.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(paciente)
    return paciente


def update_paciente(
    db: Session, paciente_id: uuid.UUID, payload: PacienteUpdate, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID
) -> Paciente:
    paciente = get_paciente(db, paciente_id, unidade_hospitalar_id)
    dados = payload.model_dump(exclude_unset=True)
    for field, value in dados.items():
        setattr(paciente, field, value)
    _sincronizar_hashes(paciente, dados)
    paciente.updated_by = actor_id
    paciente.updated_at = utcnow()
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EDICAO, entidade="paciente", entidade_id=paciente.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
    db.refresh(paciente)
    return paciente


def delete_paciente(db: Session, paciente_id: uuid.UUID, *, unidade_hospitalar_id: uuid.UUID, actor_id: uuid.UUID) -> None:
    paciente = get_paciente(db, paciente_id, unidade_hospitalar_id)
    paciente.deleted_at = utcnow()
    paciente.updated_by = actor_id
    db.flush()
    registrar_auditoria(
        db, acao=AcaoAuditoria.EXCLUSAO_LOGICA, entidade="paciente", entidade_id=paciente.id,
        usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
    )
    db.commit()
