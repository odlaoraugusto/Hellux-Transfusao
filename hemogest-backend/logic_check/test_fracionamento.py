"""
Teste isolado (stdlib only) da lógica de fracionamento de bolsas satélites,
extraída literalmente de app/services/unidade_hemocomponente_service.py
para poder rodar sem SQLAlchemy/FastAPI instalados.
"""
import string
import unittest


def gerar_codigos_satelite(quantidade_fracoes: int) -> list[str]:
    """Réplica exata da lógica usada em `fracionar()`."""
    if quantidade_fracoes > len(string.ascii_uppercase):
        raise ValueError("Quantidade de frações excede o limite de sufixos disponíveis.")
    return list(string.ascii_uppercase[:quantidade_fracoes])


class TestFracionamento(unittest.TestCase):
    def test_duas_fracoes(self):
        self.assertEqual(gerar_codigos_satelite(2), ["A", "B"])

    def test_cinco_fracoes(self):
        self.assertEqual(gerar_codigos_satelite(5), ["A", "B", "C", "D", "E"])

    def test_maximo_26_fracoes(self):
        codigos = gerar_codigos_satelite(26)
        self.assertEqual(len(codigos), 26)
        self.assertEqual(codigos[0], "A")
        self.assertEqual(codigos[-1], "Z")

    def test_acima_do_limite_estoura(self):
        with self.assertRaises(ValueError):
            gerar_codigos_satelite(27)

    def test_codigos_sao_unicos(self):
        codigos = gerar_codigos_satelite(10)
        self.assertEqual(len(codigos), len(set(codigos)))


if __name__ == "__main__":
    unittest.main()
