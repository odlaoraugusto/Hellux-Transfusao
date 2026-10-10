"""
HemoGest — Mapa de Trabalho Pré-Transfusional (módulo opcional).
Ficha técnica do laboratório para UMA bolsa registrada (SolicitacaoBolsa):
confirmação de ABO/Rh, prova cruzada, pesquisa de anticorpos irregulares,
lotes de reagentes e dupla checagem — fica arquivada junto com a
Solicitação, além dos campos mínimos já existentes em SolicitacaoBolsa
(prova_cruzada, responsavel_testes).

Só existe para a bolsa quando a unidade tem modulo_mapa_trabalho_ativo
(ver app.models.unidade_hospitalar e MODULOS.md) — unidades que só
transfundem, sem fazer os testes na própria estrutura, não precisam dela.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_mixins import BaseEntity, TenantMixin
from app.db.session import Base


class MapaTrabalhoPreTransfusional(Base, BaseEntity, TenantMixin):
    __tablename__ = "mapa_trabalho_pretransfusional"

    solicitacao_bolsa_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("solicitacao_bolsa.id"), nullable=False, unique=True, index=True
    )

    # Confirmação ABO/Rh no laboratório (o que já vem digitado em
    # SolicitacaoTransfusional.abo_paciente/SolicitacaoBolsa.tipo_sanguineo é
    # o resultado assumido; aqui fica o registro técnico de como e quando
    # foi confirmado).
    abo_rh_receptor_confirmado: Mapped[str | None] = mapped_column(String(3), nullable=True)
    abo_rh_doador_confirmado: Mapped[str | None] = mapped_column(String(3), nullable=True)
    metodo_abo_rh: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="TUBO | GEL | OUTRO")

    tecnica_prova_cruzada: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="TUBO | GEL | OUTRO")
    lote_reagente_pai: Mapped[str | None] = mapped_column(
        String(60), nullable=True, comment="Lote do reagente da Pesquisa de Anticorpos Irregulares"
    )

    lote_soro_anti_a: Mapped[str | None] = mapped_column(String(60), nullable=True)
    lote_soro_anti_b: Mapped[str | None] = mapped_column(String(60), nullable=True)
    lote_soro_anti_d: Mapped[str | None] = mapped_column(String(60), nullable=True)
    validade_reagentes: Mapped[date | None] = mapped_column(Date, nullable=True)

    temperatura_amostra_c: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)

    tecnico_executante_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Dupla checagem por uma segunda pessoa — prática comum em bancos de
    # sangue para reduzir risco de troca de amostra/bolsa.
    conferente_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    data_hora_inicio: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    data_hora_fim: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<MapaTrabalhoPreTransfusional bolsa={self.solicitacao_bolsa_id}>"
