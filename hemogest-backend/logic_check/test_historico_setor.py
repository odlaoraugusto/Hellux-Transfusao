"""
Simula em memória a lógica de mudar_setor() do internacao_service: fechar
o registro de histórico aberto e abrir um novo, sem precisar de banco.
"""
import unittest
from dataclasses import dataclass, field


@dataclass
class RegistroHistorico:
    setor_id: str
    data_inicio: int  # uso int como "timestamp" simplificado
    data_fim: int | None = None


class InternacaoSimulada:
    def __init__(self, setor_inicial: str, t: int):
        self.setor_atual_id = setor_inicial
        self.historico: list[RegistroHistorico] = [RegistroHistorico(setor_id=setor_inicial, data_inicio=t)]

    def mudar_setor(self, novo_setor_id: str, t: int):
        aberto = next((r for r in self.historico if r.data_fim is None), None)
        if aberto is not None:
            aberto.data_fim = t
        self.historico.append(RegistroHistorico(setor_id=novo_setor_id, data_inicio=t))
        self.setor_atual_id = novo_setor_id


class TestHistoricoSetor(unittest.TestCase):
    def test_uma_mudanca_fecha_o_anterior_e_abre_o_novo(self):
        internacao = InternacaoSimulada("UTI", t=0)
        internacao.mudar_setor("Enfermaria", t=10)

        self.assertEqual(len(internacao.historico), 2)
        self.assertEqual(internacao.historico[0].setor_id, "UTI")
        self.assertEqual(internacao.historico[0].data_fim, 10)  # fechado
        self.assertEqual(internacao.historico[1].setor_id, "Enfermaria")
        self.assertIsNone(internacao.historico[1].data_fim)  # aberto
        self.assertEqual(internacao.setor_atual_id, "Enfermaria")

    def test_apenas_um_registro_fica_aberto_por_vez(self):
        internacao = InternacaoSimulada("UTI", t=0)
        internacao.mudar_setor("Enfermaria", t=10)
        internacao.mudar_setor("Centro Cirurgico", t=20)
        internacao.mudar_setor("UTI", t=30)

        abertos = [r for r in internacao.historico if r.data_fim is None]
        self.assertEqual(len(abertos), 1)
        self.assertEqual(abertos[0].setor_id, "UTI")

    def test_intervalos_nao_se_sobrepoem(self):
        internacao = InternacaoSimulada("UTI", t=0)
        internacao.mudar_setor("Enfermaria", t=10)
        internacao.mudar_setor("Alta", t=25)

        # cada registro fechado deve terminar exatamente onde o próximo começa
        for anterior, proximo in zip(internacao.historico, internacao.historico[1:]):
            self.assertEqual(anterior.data_fim, proximo.data_inicio)


if __name__ == "__main__":
    unittest.main()
