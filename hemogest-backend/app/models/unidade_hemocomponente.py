"""
HemoGest — Unidade de Hemocomponente (a "bolsa" física, Fase 5).
Não confundir com `Hemocomponente` (Fase 3), que é o TIPO parametrizado
(ex: "Concentrado de Hemácias"). Esta tabela é a bolsa individual, com
número, validade e status.

Regra de negócio congelada (SRS §Regras de Negócio — Numeração de bolsas
satélites): quando uma bolsa-mãe é fracionada, cada fração recebe o mesmo
`numero_bolsa` da mãe com um sufixo de letra (`codigo_satelite`: A, B, C...).
`bolsa_mae_id` aponta para a bolsa original; bolsas-mãe têm `codigo_satelite
= None`.
"""
import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_mixins import BaseEntity, TenantMixin
from app.db.session import Base


class StatusHemocomponente:
    DISPONIVEL = "DISPONIVEL"
    RESERVADO = "RESERVADO"
    TRANSFUNDIDO = "TRANSFUNDIDO"
    DEVOLVIDO = "DEVOLVIDO"
    DESCARTADO = "DESCARTADO"


class UnidadeHemocomponente(Base, BaseEntity, TenantMixin):
    __tablename__ = "unidade_hemocomponente"

    hemocomponente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hemocomponente.id"), nullable=False, index=True
    )
    numero_bolsa: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    # Número do segmento ("macarrão") de tubo preso à bolsa, usado para
    # reteste de confirmação — nem toda unidade registra isso separado do
    # número da própria bolsa, por isso opcional (2026-10-10, pedido do
    # cliente).
    numero_macarrao: Mapped[str | None] = mapped_column(String(30), nullable=True)
    codigo_satelite: Mapped[str | None] = mapped_column(String(2), nullable=True, comment="A, B, C... ou None se bolsa-mãe")
    bolsa_mae_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("unidade_hemocomponente.id"), nullable=True, index=True
    )
    # Preenchido quando a bolsa chegou via uma Solicitação ao Hemocentro
    # (módulo opcional) — rastreabilidade de origem, nulo para entrada
    # manual direta (2026-10-10, pedido do cliente).
    solicitacao_hemocentro_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("solicitacao_hemocentro.id"), nullable=True, index=True
    )

    tipo_sanguineo: Mapped[str | None] = mapped_column(String(3), nullable=True)
    data_coleta: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_validade: Mapped[date] = mapped_column(Date, nullable=False)

    status: Mapped[str] = mapped_column(String(15), nullable=False, default=StatusHemocomponente.DISPONIVEL, index=True)
    paciente_reservado_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("paciente.id"), nullable=True
    )

    def __repr__(self) -> str:  # pragma: no cover
        sufixo = f"-{self.codigo_satelite}" if self.codigo_satelite else ""
        return f"<UnidadeHemocomponente {self.numero_bolsa}{sufixo}>"
