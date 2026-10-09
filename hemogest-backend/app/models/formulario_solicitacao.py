"""
HemoGest — Formulário de Solicitação de Transfusão (formulário público).
Registro do formulário em papel digitalizado: preenchido sem login pelo
médico/enfermagem do setor e gravado na unidade hospitalar cujo link foi
usado. Depois de gravado, o formulário é aberto em uma visualização que
gera o PDF oficial (STH Rev.5, sobreposição via pdf-lib) — carimbo e
assinatura continuam sendo feitos no papel impresso.

Este registro é independente de Paciente/Internação de propósito: quem
preenche não está autenticado e o paciente pode nem estar cadastrado ainda.
Por isso guarda o que foi digitado, e não referências.

Campos obrigatórios/opcionais seguem o documento STH Rev.5 e pedido do
cliente (2026-09-30): prontuário, nome, nome da mãe, unidade, nascimento,
sexo, diagnóstico, Hb, Ht e indicação transfusional são obrigatórios; o
resto é opcional. `itens` guarda até 4 hemocomponentes fixos (CH/PF/CP/CR,
ver app.schemas.formulario_solicitacao), não um catálogo configurável.

Nome do paciente, nome social, CPF, nome da mãe e prontuário são
criptografados em repouso (mesmo critério de app.models.paciente).
`token_hash` é o SHA-256 do token secreto entregue a quem enviou o
formulário, que permite reabrir só aquele formulário para impressão sem
login (o token em si nunca é guardado).
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
    cpf: Mapped[str | None] = mapped_column(EncryptedString(255), nullable=True)
    # Recém-nascido sem CPF próprio: o CPF digitado é o da mãe (2026-10-02,
    # pedido do cliente) — sinalizado aqui pra folha impressa mostrar
    # "(Mãe)" junto, sem confundir com o CPF do próprio paciente.
    cpf_e_da_mae: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cns: Mapped[str | None] = mapped_column(EncryptedString(255), nullable=True, comment="Cartão Nacional de Saúde")
    nome_social: Mapped[str | None] = mapped_column(EncryptedString(500), nullable=True)
    # Oficialmente obrigatório, mas não trava quem preenche sem ele à mão
    # (2026-10-02, pedido do cliente: "quando tiver na contingência sem
    # sistema, isso não ser uma trava") — paciente nasce sem prontuário
    # nesse caso; a equipe completa depois pela tela de Pacientes.
    prontuario: Mapped[str | None] = mapped_column(EncryptedString(255), nullable=True)
    sexo: Mapped[str] = mapped_column(String(1), nullable=False)
    data_nascimento: Mapped[date] = mapped_column(Date, nullable=False)
    nome_mae: Mapped[str] = mapped_column(EncryptedString(500), nullable=False)
    raca_cor: Mapped[str | None] = mapped_column(String(10), nullable=True)
    setor_nome: Mapped[str] = mapped_column(String(120), nullable=False)
    leito: Mapped[str | None] = mapped_column(String(20), nullable=True)
    peso_kg: Mapped[float | None] = mapped_column(Numeric(7, 3), nullable=True)

    # Endereço (2026-09-30, pedido do cliente) — CEP busca o resto via API
    # (ViaCEP) no formulário; só o número é digitado à mão. Logradouro,
    # número e bairro identificam a residência, por isso criptografados
    # (mesmo critério do nome/CPF/mãe); CEP/cidade/UF/IBGE sozinhos não
    # identificam uma pessoa, ficam em texto puro (mesmo critério de leito).
    cep: Mapped[str | None] = mapped_column(String(9), nullable=True)
    logradouro: Mapped[str | None] = mapped_column(EncryptedString(255), nullable=True)
    numero: Mapped[str | None] = mapped_column(EncryptedString(255), nullable=True)
    bairro: Mapped[str | None] = mapped_column(EncryptedString(255), nullable=True)
    cidade: Mapped[str | None] = mapped_column(String(120), nullable=True)
    uf: Mapped[str | None] = mapped_column(String(2), nullable=True)
    codigo_ibge: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Clínico e laboratorial
    diagnostico: Mapped[str] = mapped_column(String(500), nullable=False)
    hb: Mapped[str] = mapped_column(String(20), nullable=False)
    ht: Mapped[str] = mapped_column(String(20), nullable=False)
    plaquetas: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tp: Mapped[str | None] = mapped_column(String(20), nullable=True)
    ttpa: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Histórico
    indicacao: Mapped[str] = mapped_column(String(7), nullable=False)
    antecedentes_transfusionais: Mapped[bool] = mapped_column(Boolean, nullable=False)
    antecedentes_obstetricos: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    reacao_previa: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reacao_previa_descricao: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Hemocomponentes pedidos — até 4 (CH/PF/CP/CR, fixos, ver
    # app.schemas.formulario_solicitacao): tipo, quantidade, unidade_medida
    # ("UNIDADE" | "ML") e modificacoes.
    itens: Mapped[list] = mapped_column(JSON, nullable=False)
    modalidade: Mapped[str] = mapped_column(String(12), nullable=False, index=True)
    # Só preenchidos quando modalidade == PROGRAMADA.
    data_programada: Mapped[date | None] = mapped_column(Date, nullable=True)
    hora_programada: Mapped[time | None] = mapped_column(Time, nullable=True)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)

    medico_nome: Mapped[str] = mapped_column(String(120), nullable=False)
    medico_crm: Mapped[str] = mapped_column(String(30), nullable=False)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<FormularioSolicitacao {self.protocolo}>"
