"""
HemoGest — Service do Formulário de Solicitação de Transfusão (formulário público).
Gravação sem login: a unidade vem do link usado, não do usuário. Por isso o
que é aceito é conferido aqui — a unidade precisa existir e estar ativa, e
cada hemocomponente pedido precisa ser um hemocomponente ativo daquela
unidade (o nome fica gravado junto, para o documento impresso continuar
igual mesmo que o cadastro mude depois).
"""
import hashlib
import secrets
import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.audit import registrar_auditoria
from app.db.base_mixins import utcnow
from app.models.audit_log import AcaoAuditoria
from app.models.formulario_solicitacao import FormularioSolicitacao
from app.models.parametrizacao import Hemocomponente
from app.models.setor import Setor
from app.models.unidade_hospitalar import UnidadeHospitalar
from app.schemas.formulario_solicitacao import FormularioCreate

# Sem 0/O/1/I: o protocolo é lido e digitado por pessoas.
_ALFABETO_PROTOCOLO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _novo_protocolo(agora: datetime) -> str:
    sufixo = "".join(secrets.choice(_ALFABETO_PROTOCOLO) for _ in range(5))
    return f"FS-{agora:%y%m%d}-{sufixo}"


def get_unidade_ativa(db: Session, unidade_id: uuid.UUID) -> UnidadeHospitalar:
    unidade = db.get(UnidadeHospitalar, unidade_id)
    # Mesma resposta para "não existe" e "inativa": não deixa enumerar unidades.
    if unidade is None or unidade.deleted_at is not None or not unidade.ativo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Formulário não encontrado.")
    return unidade


def estabelecimento_de(unidade: UnidadeHospitalar) -> dict:
    return {
        "nome": unidade.nome_fantasia,
        "razao_social": unidade.razao_social,
        "cnpj": unidade.cnpj,
        "cnes": unidade.codigo_cnes,
        "endereco": unidade.endereco,
        "cidade": unidade.cidade,
        "uf": unidade.uf,
    }


def hemocomponentes_ativos(db: Session, unidade_id: uuid.UUID) -> list[Hemocomponente]:
    stmt = (
        select(Hemocomponente)
        .where(Hemocomponente.unidade_hospitalar_id == unidade_id)
        .where(Hemocomponente.deleted_at.is_(None))
        .where(Hemocomponente.ativo.is_(True))
        .order_by(Hemocomponente.ordem, Hemocomponente.nome)
    )
    return list(db.scalars(stmt))


def config_publica(db: Session, unidade_id: uuid.UUID) -> dict:
    unidade = get_unidade_ativa(db, unidade_id)
    setores = db.scalars(
        select(Setor.nome)
        .where(Setor.unidade_hospitalar_id == unidade_id)
        .where(Setor.deleted_at.is_(None))
        .where(Setor.ativo.is_(True))
        .order_by(Setor.nome)
    )
    return {
        "estabelecimento": estabelecimento_de(unidade),
        "hemocomponentes": [{"id": h.id, "nome": h.nome, "sigla": h.sigla} for h in hemocomponentes_ativos(db, unidade_id)],
        "setores": list(setores),
    }


def criar(
    db: Session, unidade_id: uuid.UUID, payload: FormularioCreate, *, ip_origem: str | None
) -> tuple[FormularioSolicitacao, str]:
    """Grava o formulário e devolve (registro, token de impressão em texto puro).
    O token só existe aqui e na resposta: no banco fica só o hash."""
    get_unidade_ativa(db, unidade_id)

    disponiveis = {h.id: h for h in hemocomponentes_ativos(db, unidade_id)}
    itens = []
    for item in payload.itens:
        hemo = disponiveis.get(item.hemocomponente_id)
        if hemo is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Hemocomponente inválido para esta unidade.")
        itens.append(
            {
                "hemocomponente_id": str(hemo.id),
                "hemocomponente_nome": hemo.nome,
                "hemocomponente_sigla": hemo.sigla,
                "quantidade": item.quantidade,
                "unidade_medida": item.unidade_medida,
                "modificacoes": item.modificacoes,
            }
        )

    dados = payload.model_dump(exclude={"website", "itens"})
    token = secrets.token_urlsafe(24)
    agora = utcnow()

    for tentativa in range(5):
        registro = FormularioSolicitacao(
            unidade_hospitalar_id=unidade_id,
            protocolo=_novo_protocolo(agora),
            token_hash=hash_token(token),
            ip_origem=ip_origem,
            itens=itens,
            **dados,
        )
        db.add(registro)
        try:
            db.flush()
        except IntegrityError:
            # Protocolo repetido na mesma unidade (5 caracteres aleatórios): sorteia outro.
            db.rollback()
            if tentativa == 4:
                raise
            continue
        break

    registrar_auditoria(
        db, acao=AcaoAuditoria.CRIACAO, entidade="formulario_solicitacao", entidade_id=registro.id,
        usuario_id=None, unidade_hospitalar_id=unidade_id, ip_origem=ip_origem,
        detalhes={"protocolo": registro.protocolo, "origem": "formulario_publico"},
    )
    db.commit()
    db.refresh(registro)
    return registro, token


def get_por_token(db: Session, token: str) -> FormularioSolicitacao:
    stmt = select(FormularioSolicitacao).where(
        FormularioSolicitacao.token_hash == hash_token(token), FormularioSolicitacao.deleted_at.is_(None)
    )
    registro = db.scalars(stmt).first()
    if registro is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Formulário não encontrado.")
    return registro


def get_formulario(
    db: Session, formulario_id: uuid.UUID, unidade_hospitalar_id: uuid.UUID, *, actor_id: uuid.UUID | None = None
) -> FormularioSolicitacao:
    registro = db.get(FormularioSolicitacao, formulario_id)
    if registro is None or registro.deleted_at is not None or registro.unidade_hospitalar_id != unidade_hospitalar_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Formulário não encontrado.")
    # Abrir um formulário individual mostra dado de paciente: fica na trilha de
    # auditoria (LGPD), como no prontuário. Listagens não geram registro.
    if actor_id is not None:
        registrar_auditoria(
            db, acao=AcaoAuditoria.LEITURA, entidade="formulario_solicitacao", entidade_id=registro.id,
            usuario_id=actor_id, unidade_hospitalar_id=unidade_hospitalar_id,
        )
        db.commit()
    return registro


def search(
    db: Session,
    unidade_hospitalar_id: uuid.UUID,
    *,
    de: datetime | None = None,
    ate: datetime | None = None,
    modalidade: str | None = None,
    limit: int = 200,
) -> list[FormularioSolicitacao]:
    stmt = (
        select(FormularioSolicitacao)
        .where(FormularioSolicitacao.unidade_hospitalar_id == unidade_hospitalar_id)
        .where(FormularioSolicitacao.deleted_at.is_(None))
    )
    if de:
        stmt = stmt.where(FormularioSolicitacao.created_at >= de)
    if ate:
        stmt = stmt.where(FormularioSolicitacao.created_at < ate)
    if modalidade:
        stmt = stmt.where(FormularioSolicitacao.modalidade == modalidade)
    return list(db.scalars(stmt.order_by(FormularioSolicitacao.created_at.desc()).limit(limit)))


def montar_saida(db: Session, registro: FormularioSolicitacao) -> dict:
    unidade = db.get(UnidadeHospitalar, registro.unidade_hospitalar_id)
    dados = {c.key: getattr(registro, c.key) for c in FormularioSolicitacao.__table__.columns}
    dados.update(
        criado_em=registro.created_at,
        estabelecimento=estabelecimento_de(unidade),
        peso_kg=float(registro.peso_kg),
    )
    return dados


def montar_resumo(registro: FormularioSolicitacao) -> dict:
    return {
        "id": registro.id,
        "protocolo": registro.protocolo,
        "criado_em": registro.created_at,
        "data_solicitacao": registro.data_solicitacao,
        "hora_solicitacao": registro.hora_solicitacao,
        "nome_paciente": registro.nome_paciente,
        "setor_nome": registro.setor_nome,
        "leito": registro.leito,
        "modalidade": registro.modalidade,
        "medico_nome": registro.medico_nome,
        "hemocomponentes": [
            f"{i.get('hemocomponente_sigla') or i['hemocomponente_nome']} × {i['quantidade']}"
            f"{' mL' if i['unidade_medida'] == 'ML' else ''}"
            for i in registro.itens
        ],
    }
