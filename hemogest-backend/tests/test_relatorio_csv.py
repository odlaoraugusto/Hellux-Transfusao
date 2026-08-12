from app.services.relatorio_service import to_csv


def test_to_csv_vazio() -> None:
    assert to_csv([]) == ""


def test_to_csv_com_dados() -> None:
    linhas = [{"nome": "Ana", "cpf": "12345678900"}, {"nome": "Bruno", "cpf": "00011122233"}]
    csv_text = to_csv(linhas)
    assert "nome,cpf" in csv_text
    assert "Ana,12345678900" in csv_text
    assert "Bruno,00011122233" in csv_text
