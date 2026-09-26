"""
HemoGest — Compatibilidade ABO/Rh entre bolsa e paciente.
Regras usadas na entrega de uma solicitação:
  - Hemácias: os antígenos A/B da bolsa precisam existir no paciente.
    Bolsa Rh+ para paciente Rh- é liberação com ressalva (exige autorização).
  - Plasma e crioprecipitado: regra inversa (os anticorpos do plasma não
    podem atingir as hemácias do paciente). Rh não se aplica.
  - Plaquetas: ABO/Rh idêntico é o ideal; o resto é liberação com ressalva.
O tipo do hemocomponente é inferido pela sigla parametrizada pela unidade.
"""

TIPOS_SANGUINEOS = ("O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-")


class ResultadoCompatibilidade:
    COMPATIVEL = "COMPATIVEL"
    RESSALVA = "RESSALVA"
    INCOMPATIVEL = "INCOMPATIVEL"


class TipoComponente:
    HEMACIAS = "HEMACIAS"
    PLASMA = "PLASMA"
    PLAQUETAS = "PLAQUETAS"


def tipo_por_sigla(sigla: str | None) -> str | None:
    s = (sigla or "").strip().upper()
    if not s:
        return None
    if s.startswith("CH"):
        return TipoComponente.HEMACIAS
    if s.startswith("CP") or s.startswith("PLAQ"):
        return TipoComponente.PLAQUETAS
    if s.startswith("CRIO") or s in ("PFC", "PC", "PIC", "PFC24") or s.startswith("PLASMA"):
        return TipoComponente.PLASMA
    return None


def _antigenos(tipo: str) -> set[str]:
    return set(tipo.rstrip("+-").replace("O", ""))


def avaliar(tipo_componente: str | None, doador: str, receptor: str) -> tuple[str, str]:
    """Retorna (resultado, mensagem) para uma bolsa `doador` em paciente `receptor`."""
    if doador not in TIPOS_SANGUINEOS or receptor not in TIPOS_SANGUINEOS:
        return ResultadoCompatibilidade.INCOMPATIVEL, "Tipo sanguíneo inválido."

    ag_d, ag_r = _antigenos(doador), _antigenos(receptor)
    rh_d, rh_r = doador.endswith("+"), receptor.endswith("+")

    if tipo_componente == TipoComponente.HEMACIAS:
        if not ag_d <= ag_r:
            return ResultadoCompatibilidade.INCOMPATIVEL, f"Hemácias {doador} são ABO incompatíveis com paciente {receptor}."
        if rh_d and not rh_r:
            return ResultadoCompatibilidade.RESSALVA, "Bolsa Rh positivo para paciente Rh negativo."
        return ResultadoCompatibilidade.COMPATIVEL, "Compatível."

    if tipo_componente == TipoComponente.PLASMA:
        if not ag_r <= ag_d:
            return ResultadoCompatibilidade.INCOMPATIVEL, f"Plasma {doador} tem anticorpos contra as hemácias do paciente {receptor}."
        return ResultadoCompatibilidade.COMPATIVEL, "Compatível."

    if tipo_componente == TipoComponente.PLAQUETAS:
        if ag_d == ag_r and not (rh_d and not rh_r):
            return ResultadoCompatibilidade.COMPATIVEL, "Compatível."
        return ResultadoCompatibilidade.RESSALVA, "Plaquetas ABO/Rh não idênticas ao paciente."

    # Sigla não reconhecida: sem regra específica, só aceita isogrupo sem ressalva.
    if doador == receptor:
        return ResultadoCompatibilidade.COMPATIVEL, "Isogrupo."
    return ResultadoCompatibilidade.RESSALVA, "Hemocomponente sem regra de compatibilidade cadastrada; confirme com o hemoterapeuta."
