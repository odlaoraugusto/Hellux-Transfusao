"""
HemoGest — Registro central de models.
Todo novo model criado nas próximas sprints deve ser importado aqui para
que apareça no Base.metadata e seja capturado pelo alembic autogenerate.
"""
from app.models.acompanhamento_transfusional import AcompanhamentoTransfusional, SinalVital  # noqa: F401
from app.models.anexo import Anexo  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.devolucao_descarte import Descarte, Devolucao  # noqa: F401
from app.models.formulario_solicitacao import FormularioSolicitacao  # noqa: F401
from app.models.internacao import Internacao, InternacaoSetorHistorico  # noqa: F401
from app.models.paciente import Paciente  # noqa: F401
from app.models.parametrizacao import (  # noqa: F401
    Gravidade,
    Hemocomponente,
    MotivoDescarte,
    MotivoDevolucao,
    TipoReacao,
)
from app.models.password_reset_token import PasswordResetToken  # noqa: F401
from app.models.reacao_transfusional import ReacaoTransfusional  # noqa: F401
from app.models.refresh_token import RefreshToken  # noqa: F401
from app.models.role import Role  # noqa: F401
from app.models.setor import Setor  # noqa: F401
from app.models.solicitacao_transfusional import SolicitacaoBolsa, SolicitacaoTransfusional  # noqa: F401
from app.models.unidade_hemocomponente import UnidadeHemocomponente  # noqa: F401
from app.models.unidade_hospitalar import UnidadeHospitalar  # noqa: F401
from app.models.usuario import Usuario  # noqa: F401

__all__ = [
    "AcompanhamentoTransfusional",
    "Anexo",
    "AuditLog",
    "Descarte",
    "Devolucao",
    "FormularioSolicitacao",
    "Gravidade",
    "Hemocomponente",
    "Internacao",
    "InternacaoSetorHistorico",
    "MotivoDescarte",
    "MotivoDevolucao",
    "Paciente",
    "PasswordResetToken",
    "ReacaoTransfusional",
    "RefreshToken",
    "Role",
    "Setor",
    "SinalVital",
    "SolicitacaoBolsa",
    "SolicitacaoTransfusional",
    "TipoReacao",
    "UnidadeHemocomponente",
    "UnidadeHospitalar",
    "Usuario",
]
