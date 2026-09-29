"""
HemoGest — Formulário de Solicitação de Transfusão (formulário público).
Registro do formulário em papel digitalizado: preenchido sem login pelo
médico/enfermagem do setor e gravado na unidade hospitalar cujo link foi
usado. Depois de gravado, o formulário é aberto em uma visualização para
impressão (A4) — o carimbo e a assinatura continuam sendo feitos no papel.

Este registro é independente de Paciente/Internação de propósito: quem
preenche não está autenticado e o paciente pode nem estar cadastrado ainda.
Por isso guarda o que foi digitado, e não referências.

Nome do paciente, nome da mãe e prontuário são criptografados em repouso
(mesmo critério de app.models.paciente). `token_hash` é o SHA-256 do token
secreto entregue a quem enviou o formulário, que permite reabrir só aquele
formulário para impressão sem login (o token em si nunca é guardado).
"""
from datetime import date, time

from sqlalchemy import JSON, Boolean, Date, Numeric, String, Text, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_mixins import BaseEntity, TenantMixin
from app.db.encrypted_types import EncryptedString
from app.db.session import Base


class ModalidadeTransfusao:
    EMERGENCIA = "EMERGENCIA"
    URGENCIA = "URGENCIA"
    ROTINA = "ROTINA"
    PROGRAMADA = "PROGRAMADA"


class IndicacaoTransfusao:
    USO = "USO"
    RESERVA = "RESERVA"


class FormularioSolicitacao(Base, BaseEntity, TenantMixin):
    __tablename__ = "formulario_solicitacao"
    __table_args__ = (
        UniqueConstraint("unidade_hospitalar_id", "protocolo", name="uq_formulario_unidade_protocolo"),
    )

    protocolo: Mapped[str] = mapped_column(String(20), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    ip_origem: Mapped[str | None] = mapped_column(String(45), nullable=True)

    convenio: Mapped[str | None] = mapped_column(String(60), nullable=True)
    data_solicitacao: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    hora_solicitacao: Mapped[time] = mapped_column(Time, nullable=False)

    # Paciente
    nome_paciente: Mapped[str] = mapped_column(EncryptedString(500), nullable=False)
    prontuario: Mapped[str] = mapped_column(EncryptedString(255), nullable=False)
    sexo: Mapped[str] = mapped_column(String(1), nullable=False)
    data_nascimento: Mapped[date] = mapped_column(Date, nullable=False)
    nome_mae: Mapped[str] = mapped_column(EncryptedString(500), nullable=False)
    raca_cor: Mapped[str] = mapped_column(String(10), nullable=False)
    setor_nome: Mapped[str] = mapped_column(String(120), nullable=False)
    leito: Mapped[str] = mapped_column(String(20), nullable=False)
    peso_kg: Mapped[float] = mapped_column(Numeric(7, 3), nullable=False)

    # Clínico e laboratorial
    diagnostico: Mapped[str] = mapped_column(String(500), nullable=False)
    hb: Mapped[str] = mapped_column(String(20), nullable=False)
    ht: Mapped[str] = mapped_column(String(20), nullable=False)
    plaquetas: Mapped[str] = mapped_column(String(20), nullable=False)
    tp: Mapped[str | None] = mapped_column(String(20), nullable=True)
    ttpa: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Histórico e indicação
    indicacao: Mapped[str] = mapped_column(String(7), nullable=False)
    antecedentes_transfusionais: Mapped[bool] = mapped_column(Boolean, nullable=False)
    antecedentes_obstetricos: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    reacao_previa: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reacao_previa_descricao: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Hemocomponentes pedidos (até 3): hemocomponente_id, nome, sigla,
    # quantidade, unidade_medida ("UNIDADE" | "ML") e modificacoes.
    itens: Mapped[list] = mapped_column(JSON, nullable=False)
    modalidade: Mapped[str] = mapped_column(String(12), nullable=False, index=True)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Termos especiais (carimbo e assinatura são feitos no papel impresso)
    termo_heterogrupo_medico: Mapped[str | None] = mapped_column(String(120), nullable=True)
    termo_heterogrupo_crm: Mapped[str | None] = mapped_column(String(30), nullable=True)
    termo_emergencia_medico: Mapped[str | None] = mapped_column(String(120), nullable=True)
    termo_emergencia_crm: Mapped[str | None] = mapped_column(String(30), nullable=True)

    medico_nome: Mapped[str] = mapped_column(String(120), nullable=False)
    medico_crm: Mapped[str] = mapped_column(String(30), nullable=False)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<FormularioSolicitacao {self.protocolo}>"
