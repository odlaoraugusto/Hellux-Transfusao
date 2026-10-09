"""
HemoGest — validações compartilhadas.
"""


def cpf_valido(digitos: str) -> bool:
    """Confere os dois dígitos verificadores do CPF (2026-10-02, pedido do
    cliente: "caso digitem 000.000.000-00... trava também, pq tem que ter
    esse dado obrigatoriamente") — só checar 11 dígitos deixava passar
    qualquer sequência (000.000.000-00, 123.456.789-00 etc) digitada só
    pra vencer a obrigatoriedade do campo."""
    if len(digitos) != 11 or len(set(digitos)) == 1:
        return False

    def dv(tamanho: int) -> int:
        soma = sum(int(digitos[i]) * (tamanho + 1 - i) for i in range(tamanho))
        resto = (soma * 10) % 11
        return resto if resto < 10 else 0

    return dv(9) == int(digitos[9]) and dv(10) == int(digitos[10])
