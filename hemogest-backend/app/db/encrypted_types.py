"""
HemoGest — Criptografia de campo para dados sensíveis (LGPD, art. 5º II).

Por que campo-a-campo, e não só "confiar no disco criptografado do Postgres
gerenciado": criptografia de disco (at-rest) protege contra alguém roubar o
HD/backup físico, mas não protege contra um dump de banco, uma query SQL
direta por alguém com acesso ao Postgres (ex.: um provedor de hospedagem
comprometido), ou um erro de configuração que exponha a connection string.
Criptografia de campo garante que mesmo quem tem acesso de leitura direto ao
banco não vê nome/CPF/prontuário em texto plano — só a aplicação, de posse
da chave, consegue.

Design:
- `EncryptedString`: TypeDecorator do SQLAlchemy — transparente para o resto
  do código (o objeto Python sempre vê texto plano; só o valor persistido no
  banco é ciphertext). Usa Fernet (AES-128-CBC + HMAC-SHA256 autenticado),
  que já cuida de IV aleatório e integridade — não é criptografia "caseira".
- `blind_index()`: como o ciphertext do Fernet é não-determinístico (mesmo
  valor gera ciphertext diferente a cada vez, por causa do IV aleatório),
  nenhuma coluna criptografada pode ser comparada com `=` no SQL. Para os
  poucos campos que precisam de busca exata (CPF, número de prontuário),
  mantemos ao lado uma coluna de "índice cego": HMAC-SHA256 determinístico
  do valor normalizado. HMAC nunca revela o valor original (diferente de um
  hash simples, não é vulnerável a rainbow table sem a chave), mas permite
  comparar "o HMAC deste CPF bate com o HMAC gravado" sem nunca descriptografar
  em massa. Busca por trecho (nome/nome da mãe) não é possível com índice
  cego — ver comentário em app.services.paciente_service sobre a estratégia
  adotada ali (filtrar em memória, viável pelo volume pequeno de pacientes).

Separação de chaves: a chave de cifra (Fernet) e a chave do índice cego (HMAC)
são derivadas por HKDF a partir do mesmo segredo mestre (FIELD_ENCRYPTION_KEY),
mas com `info` diferente — nunca a mesma chave crua é usada para dois
propósitos criptográficos distintos, mesmo que venham do mesmo segredo.
"""
from __future__ import annotations

import base64
import hmac
from functools import lru_cache
from hashlib import sha256

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from sqlalchemy import String
from sqlalchemy.types import TypeDecorator

from app.core.config import settings

_INFO_CIFRA = b"hemogest-field-encryption-v1"
_INFO_INDICE_CEGO = b"hemogest-blind-index-v1"


def _derivar_chave(info: bytes) -> bytes:
    hkdf = HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=info)
    return hkdf.derive(settings.FIELD_ENCRYPTION_KEY.encode("utf-8"))


@lru_cache
def _fernet() -> Fernet:
    return Fernet(base64.urlsafe_b64encode(_derivar_chave(_INFO_CIFRA)))


@lru_cache
def _chave_indice_cego() -> bytes:
    return _derivar_chave(_INFO_INDICE_CEGO)


def blind_index(valor: str) -> str:
    """HMAC-SHA256 hexadecimal e determinístico do valor normalizado — só
    serve para igualdade exata (CPF, prontuário). Nunca usar para dado que
    precise de busca por trecho."""
    normalizado = valor.strip().lower().encode("utf-8")
    return hmac.new(_chave_indice_cego(), normalizado, sha256).hexdigest()


def autoteste_criptografia() -> None:
    """Roda no startup da aplicação (app.main) — cifra e decifra um valor
    conhecido. Se FIELD_ENCRYPTION_KEY estiver ausente/curta/errada, isso
    falha imediatamente no boot em vez de silenciosamente na primeira
    leitura de paciente em produção."""
    sonda = "hemogest-autoteste"
    cifrado = _fernet().encrypt(sonda.encode("utf-8"))
    if _fernet().decrypt(cifrado).decode("utf-8") != sonda:
        raise RuntimeError("Autoteste de criptografia de campo falhou.")


class EncryptedString(TypeDecorator):
    """Coluna string criptografada de forma transparente para o ORM. Sempre
    dimensione a coluna do banco generosamente (o ciphertext em base64 do
    Fernet fica bem maior que o texto plano — ~1.4x + ~100 bytes de overhead
    fixo) — ver larguras escolhidas em app.models.paciente."""

    impl = String
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect) -> str | None:
        if value is None:
            return None
        return _fernet().encrypt(value.encode("utf-8")).decode("ascii")

    def process_result_value(self, value: str | None, dialect) -> str | None:
        if value is None:
            return None
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
