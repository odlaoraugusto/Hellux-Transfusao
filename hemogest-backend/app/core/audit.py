"""
HemoGest — Helper de auditoria.
Usado por todos os services que executam ações sensíveis. Não faz commit —
quem chama decide o momento da transação (geralmente junto do commit da
própria operação de negócio).
"""
import uuid

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def registrar_auditoria(
    db: Session,
    *,
    acao: str,
    entidade: str,
    usuario_id: uuid.UUID | None = None,
    entidade_id: uuid.UUID | None = None,
    unidade_hospitalar_id: uuid.UUID | None = None,
    detalhes: dict | None = None,
    ip_origem: str | None = None,
) -> AuditLog:
    log = AuditLog(
        usuario_id=usuario_id,
        unidade_hospitalar_id=unidade_hospitalar_id,
        acao=acao,
        entidade=entidade,
        entidade_id=entidade_id,
        detalhes=detalhes,
        ip_origem=ip_origem,
    )
    db.add(log)
    db.flush()
    return log
