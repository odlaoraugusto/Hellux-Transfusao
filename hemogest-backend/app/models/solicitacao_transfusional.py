"""
HemoGest — Solicitação Transfusional (painel de solicitações).
Um pedido de hemocomponente feito por um setor para um paciente internado.
Fluxo: SOLICITADO -> EM_PROCESSAMENTO -> ENTREGUE. Dentro de
EM_PROCESSAMENTO, a agência registra e entrega as bolsas UMA DE CADA VEZ,
cada etapa independente das outras bolsas (2026-10-01, pedido do cliente:
"pedir duas mas só conseguir atender uma no momento, a outra vem no dia
seguinte" / "posso entregar uma bolsa primeiro e a segunda depois") — cada
bolsa tem sua própria Folha de Hemotransfusão (registro: número, ABO/Rh,
validade, volume, compatibilidade) e seu próprio recebimento (entrega:
recebido por, temperatura). A solicitação só vira
ENTREGUE quando TODAS as bolsas pedidas (`quantidade`) já tiverem sido
registradas E entregues.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_mixins import BaseEntity, TenantMixin, UUIDPrimaryKeyMixin, utcnow
from app.db.session import Base


class StatusSolicitacao:
    SOLICITADO = "SOLICITADO"
    EM_PROCESSAMENTO = "EM_PROCESSAMENTO"
    ENTREGUE = "ENTREGUE"
    CANCELADO = "CANCELADO"


class PrioridadeSolicitacao:
    ROTINA = "ROTINA"
    URGENTE = "URGENTE"
    EMERGENCIA = "EMERGENCIA"


class SolicitacaoTransfusional(Base, BaseEntity, TenantMixin):
    __tablename__ = "solicitacao_transfusional"

    # Opcional (2026-09-30, pedido do cliente) — solicitações originadas do
    # formulário público de transfusão (ver
    # app.services.formulario_solicitacao_service) não passam por
    # internação; só as criadas manualmente pela equipe têm uma.
    internacao_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("internacao.id"), nullable=True, index=True
    )
    # Formulário público que originou esta solicitação — nulo pra quem foi
    # criada manualmente pela equipe (2026-09-30, pedido do cliente: permitir
    # reimpressão do formulário a partir da solicitação).
    formulario_solicitacao_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("formulario_solicitacao.id"), nullable=True, index=True
    )
    paciente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("paciente.id"), nullable=False, index=True
    )
    setor_solicitante_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("setor.id"), nullable=False, index=True
    )
    hemocomponente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hemocomponente.id"), nullable=False
    )
    # Nº de bolsas pedidas — a unidade real de controle do fluxo (cada
    # bolsa é registrada/entregue individualmente). Quando o formulário
    # público pede um VOLUME em mL em vez de nº de bolsas (comum em
    # pediatria/neonatologia, ex.: "261 mL" — 2026-10-01, correção de bug
    # real: estava gravando 261 aqui, fazendo o sistema esperar 261
    # bolsas), `quantidade` vira 1 e o volume pedido vai para
    # `volume_ml_solicitado`.
    quantidade: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    volume_ml_solicitado: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prioridade: Mapped[str] = mapped_column(String(12), nullable=False, default=PrioridadeSolicitacao.ROTINA)
    indicacao: Mapped[str | None] = mapped_column(Text, nullable=True)
    medico_solicitante: Mapped[str | None] = mapped_column(String(120), nullable=True)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default=StatusSolicitacao.SOLICITADO, index=True)
    data_solicitacao: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    data_inicio_processamento: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    data_entrega: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ABO/Rh do paciente — do próprio paciente, vale pra todas as bolsas da
    # solicitação; definido na primeira bolsa registrada.
    abo_paciente: Mapped[str | None] = mapped_column(String(3), nullable=True)
    # PAI = Pesquisa de Anticorpos Irregulares (2026-10-01, correção de bug
    # real: "PAI" tinha virado campo de nome do pai do paciente por engano —
    # é exame pré-transfusional, sai junto com o ABO/Rh do paciente no
    # processamento da bolsa, não na entrega). NEGATIVA | POSITIVA |
    # NAO_REALIZADA.
    pesquisa_anticorpos_irregulares: Mapped[str | None] = mapped_column(String(15), nullable=True)

    # Cancelamento (2026-10-01, pedido do cliente: "erro de digitação do
    # médico, ou suspensão da transfusão") — só a partir de SOLICITADO ou
    # EM_PROCESSAMENTO; bolsas já entregues antes do cancelamento continuam
    # registradas (fato histórico, não é desfeito).
    motivo_cancelamento: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancelado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelado_por: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SolicitacaoTransfusional {self.id} status={self.status}>"


class SolicitacaoBolsa(Base, UUIDPrimaryKeyMixin):
    """Uma bolsa registrada individualmente para uma solicitação — dados
    digitados na hora (número, ABO/Rh, validade, volume), sem vínculo com
    estoque. Cada bolsa tem sua própria Folha de Hemotransfusão
    (folha_emitida_em/por) e seu próprio resultado de compatibilidade
    (2026-10-01, pedido do cliente: registro individual por bolsa, bolsas
    podem chegar em dias diferentes)."""

    __tablename__ = "solicitacao_bolsa"

    solicitacao_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("solicitacao_transfusional.id"), nullable=False, index=True
    )
    numero_bolsa: Mapped[str] = mapped_column(String(50), nullable=False)
    tipo_sanguineo: Mapped[str] = mapped_column(String(3), nullable=False)
    data_validade: Mapped[date] = mapped_column(Date, nullable=False)
    volume_ml: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prova_cruzada: Mapped[str | None] = mapped_column(String(15), nullable=True, comment="COMPATIVEL | INCOMPATIVEL | NAO_SE_APLICA")
    liberacao_com_ressalva: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Nome de quem fez a prova cruzada/liberou a bolsa no banco de sangue
    # (2026-10-01, pedido do cliente: "é o banco de sangue que libera, por
    # enquanto, então colocamos o nome de quem processa lá") — digitado à
    # mão, diferente de folha_emitida_por (usuário do HemoGest que
    # registrou a bolsa aqui, usado pra "Técnico responsável" e "Entregue
    # por" na folha).
    responsavel_testes: Mapped[str | None] = mapped_column(String(120), nullable=True)
    folha_emitida_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    folha_emitida_por: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    # Recebimento físico desta bolsa pelo setor — independente das outras
    # bolsas da mesma solicitação (2026-10-01, pedido do cliente: "posso
    # entregar uma bolsa primeiro e a segunda depois"). Nulo até ser
    # entregue.
    temperatura_transporte_c: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    recebido_por: Mapped[str | None] = mapped_column(String(120), nullable=True)
    observacoes_entrega: Mapped[str | None] = mapped_column(Text, nullable=True)
    entregue_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    entregue_por: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
