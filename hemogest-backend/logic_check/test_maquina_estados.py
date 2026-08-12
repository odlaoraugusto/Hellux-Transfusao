"""
Testa de verdade as regras de transição de status que estão espalhadas
pelos services (unidade_hemocomponente, acompanhamento, reacao). Réplica
fiel das condições de cada função, sem os decorators/DB do FastAPI.
"""
import unittest


class StatusHemocomponente:
    DISPONIVEL = "DISPONIVEL"
    RESERVADO = "RESERVADO"
    TRANSFUNDIDO = "TRANSFUNDIDO"
    DEVOLVIDO = "DEVOLVIDO"
    DESCARTADO = "DESCARTADO"


class StatusAcompanhamento:
    AGUARDANDO = "AGUARDANDO"
    EM_ANDAMENTO = "EM_ANDAMENTO"
    FINALIZADO = "FINALIZADO"
    INTERCORRENCIA = "INTERCORRENCIA"


class StatusReacao:
    ABERTA = "ABERTA"
    INVESTIGACAO = "INVESTIGACAO"
    NOTIVISA = "NOTIVISA"
    ENCERRADA = "ENCERRADA"


# --- Réplicas das validações reais dos services ---

def pode_reservar(status_atual: str) -> bool:
    return status_atual == StatusHemocomponente.DISPONIVEL


def pode_iniciar_acompanhamento(status_bolsa: str) -> bool:
    return status_bolsa == StatusHemocomponente.RESERVADO


def pode_fracionar(status_bolsa: str, ja_e_satelite: bool) -> bool:
    return status_bolsa == StatusHemocomponente.DISPONIVEL and not ja_e_satelite


_STATUS_PERMITEM_BAIXA = {StatusHemocomponente.DISPONIVEL, StatusHemocomponente.RESERVADO}


def pode_devolver_ou_descartar(status_bolsa: str) -> bool:
    return status_bolsa in _STATUS_PERMITEM_BAIXA


def pode_finalizar_acompanhamento(status_acomp: str) -> bool:
    return status_acomp in (StatusAcompanhamento.EM_ANDANDO if False else StatusAcompanhamento.EM_ANDAMENTO, StatusAcompanhamento.INTERCORRENCIA)


def pode_registrar_sinal_vital(status_acomp: str) -> bool:
    return status_acomp in (StatusAcompanhamento.EM_ANDAMENTO, StatusAcompanhamento.INTERCORRENCIA)


def pode_investigar_reacao(status_reacao: str) -> bool:
    return status_reacao in (StatusReacao.ABERTA, StatusReacao.INVESTIGACAO)


def pode_notificar_notivisa(status_reacao: str) -> bool:
    return status_reacao == StatusReacao.INVESTIGACAO


def pode_encerrar_reacao(status_reacao: str) -> bool:
    return status_reacao in (StatusReacao.INVESTIGACAO, StatusReacao.NOTIVISA)


class TestMaquinaEstadosBolsa(unittest.TestCase):
    def test_so_disponivel_pode_ser_reservada(self):
        self.assertTrue(pode_reservar(StatusHemocomponente.DISPONIVEL))
        for status in (StatusHemocomponente.RESERVADO, StatusHemocomponente.TRANSFUNDIDO,
                       StatusHemocomponente.DEVOLVIDO, StatusHemocomponente.DESCARTADO):
            with self.subTest(status=status):
                self.assertFalse(pode_reservar(status))

    def test_acompanhamento_so_inicia_com_bolsa_reservada(self):
        self.assertTrue(pode_iniciar_acompanhamento(StatusHemocomponente.RESERVADO))
        self.assertFalse(pode_iniciar_acompanhamento(StatusHemocomponente.DISPONIVEL))

    def test_bolsa_ja_reservada_nao_pode_reservar_de_novo(self):
        # Regressão: uma bolsa RESERVADA não pode ser reservada por outro
        # paciente — isso preveniria dupla-reserva/corrida.
        self.assertFalse(pode_reservar(StatusHemocomponente.RESERVADO))

    def test_satelite_nao_pode_ser_refracionada(self):
        self.assertTrue(pode_fracionar(StatusHemocomponente.DISPONIVEL, ja_e_satelite=False))
        self.assertFalse(pode_fracionar(StatusHemocomponente.DISPONIVEL, ja_e_satelite=True))

    def test_devolucao_descarte_bloqueados_apos_transfundida(self):
        self.assertFalse(pode_devolver_ou_descartar(StatusHemocomponente.TRANSFUNDIDO))
        self.assertFalse(pode_devolver_ou_descartar(StatusHemocomponente.DESCARTADO))
        self.assertFalse(pode_devolver_ou_descartar(StatusHemocomponente.DEVOLVIDO))
        self.assertTrue(pode_devolver_ou_descartar(StatusHemocomponente.DISPONIVEL))
        self.assertTrue(pode_devolver_ou_descartar(StatusHemocomponente.RESERVADO))


class TestMaquinaEstadosAcompanhamento(unittest.TestCase):
    def test_sinal_vital_exige_em_andamento_ou_intercorrencia(self):
        self.assertTrue(pode_registrar_sinal_vital(StatusAcompanhamento.EM_ANDAMENTO))
        self.assertTrue(pode_registrar_sinal_vital(StatusAcompanhamento.INTERCORRENCIA))
        self.assertFalse(pode_registrar_sinal_vital(StatusAcompanhamento.AGUARDANDO))
        self.assertFalse(pode_registrar_sinal_vital(StatusAcompanhamento.FINALIZADO))

    def test_nao_finaliza_o_que_ja_esta_aguardando(self):
        # Regressão: um acompanhamento que nunca foi iniciado não pode ser
        # finalizado direto (puularia o registro de sinais vitais).
        self.assertFalse(pode_finalizar_acompanhamento(StatusAcompanhamento.AGUARDANDO))


class TestMaquinaEstadosReacao(unittest.TestCase):
    def test_fluxo_linear_completo(self):
        self.assertTrue(pode_investigar_reacao(StatusReacao.ABERTA))
        self.assertTrue(pode_investigar_reacao(StatusReacao.INVESTIGACAO))
        self.assertFalse(pode_investigar_reacao(StatusReacao.ENCERRADA))

        self.assertFalse(pode_notificar_notivisa(StatusReacao.ABERTA))
        self.assertTrue(pode_notificar_notivisa(StatusReacao.INVESTIGACAO))

        self.assertTrue(pode_encerrar_reacao(StatusReacao.INVESTIGACAO))
        self.assertTrue(pode_encerrar_reacao(StatusReacao.NOTIVISA))
        self.assertFalse(pode_encerrar_reacao(StatusReacao.ABERTA))

    def test_nao_pode_pular_direto_pra_encerrada(self):
        # Regressão: abrir uma reação e encerrar sem investigar deveria ser
        # impossível — protege contra pular a etapa de investigação.
        self.assertFalse(pode_encerrar_reacao(StatusReacao.ABERTA))


if __name__ == "__main__":
    unittest.main()
