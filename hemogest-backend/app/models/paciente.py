"""
HemoGest — Paciente (Sprint 4.1).
CPF/CNS são opcionais no schema (nem todo paciente atendido em urgência tem
documento no momento do cadastro), mas pelo menos um identificador único
por unidade deve existir — reforçado no service, não no banco.
"""
from datetime import date

from sqlalchemy import Date, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_mixins import BaseEntity, TenantMixin
from app.db.session import Base


class Paciente(Base, BaseEntity, TenantMixin):
    __tablename__ = "paciente"

    nome: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    data_nascimento: Mapped[date | None] = mapped_column(Date, nullable=True)
    sexo: Mapped[str | None] = mapped_column(String(1), nullable=True, comment="M | F | I (ignorado)")

    cpf: Mapped[str | None] = mapped_column(String(11), nullable=True, index=True)
    cns: Mapped[str | None] = mapped_column(String(15), nullable=True, index=True, comment="Cartão Nacional de Saúde")
    numero_prontuario: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)

    tipo_sanguineo: Mapped[str | None] = mapped_column(String(3), nullable=True, comment="ex: O+, AB-")
    telefone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    nome_mae: Mapped[str | None] = mapped_column(String(200), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Paciente {self.nome}>"
