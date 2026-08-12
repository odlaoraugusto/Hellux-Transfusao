"""
HemoGest — Paciente (Sprint 4.1).
CPF/CNS são opcionais no schema (nem todo paciente atendido em urgência tem
documento no momento do cadastro), mas pelo menos um identificador único
por unidade deve existir — reforçado no service, não no banco.

Campos diretamente identificadores (nome, nome da mãe, CPF, CNS, prontuário,
telefone) são cifrados em repouso — ver app.db.encrypted_types.EncryptedString
para o design. `data_nascimento`, `sexo` e `tipo_sanguineo` ficam em texto
plano: sozinhos não identificam o paciente e `tipo_sanguineo` precisa ficar
consultável para o fluxo de estoque/compatibilidade.

`cpf_hash`/`numero_prontuario_hash` existem só para permitir igualdade exata
(unicidade de CPF, busca por prontuário) sem depender de comparar ciphertext
não-determinístico — ver blind_index() em app.db.encrypted_types. Nunca usar
essas colunas de hash para exibir ou "adivinhar" o valor original.
"""
from datetime import date

from sqlalchemy import Date, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_mixins import BaseEntity, TenantMixin
from app.db.encrypted_types import EncryptedString
from app.db.session import Base


class Paciente(Base, BaseEntity, TenantMixin):
    __tablename__ = "paciente"

    nome: Mapped[str] = mapped_column(EncryptedString(500), nullable=False)
    data_nascimento: Mapped[date | None] = mapped_column(Date, nullable=True)
    sexo: Mapped[str | None] = mapped_column(String(1), nullable=True, comment="M | F | I (ignorado)")

    cpf: Mapped[str | None] = mapped_column(EncryptedString(255), nullable=True)
    cpf_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    cns: Mapped[str | None] = mapped_column(EncryptedString(255), nullable=True, comment="Cartão Nacional de Saúde")
    numero_prontuario: Mapped[str | None] = mapped_column(EncryptedString(255), nullable=True)
    numero_prontuario_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    tipo_sanguineo: Mapped[str | None] = mapped_column(String(3), nullable=True, comment="ex: O+, AB-")
    telefone: Mapped[str | None] = mapped_column(EncryptedString(255), nullable=True)
    nome_mae: Mapped[str | None] = mapped_column(EncryptedString(500), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover
        return "<Paciente cifrado>"
