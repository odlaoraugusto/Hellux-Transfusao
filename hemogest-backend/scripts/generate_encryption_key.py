"""
HemoGest — Gera um valor forte para FIELD_ENCRYPTION_KEY.

Uso:
    python scripts/generate_encryption_key.py

Cole o valor impresso em FIELD_ENCRYPTION_KEY no .env (dev) ou no gerenciador
de secrets do ambiente de produção (ex.: `fly secrets set`). NUNCA reaproveite
a mesma chave entre dev e produção, e nunca commite o valor real em nenhum
arquivo versionado.

Trocar essa chave depois que já existem pacientes cadastrados torna os
registros antigos ilegíveis — não há como decifrá-los com a chave nova. Se
precisar rotacionar em produção, é necessário um processo de re-criptografia
(ler com a chave antiga, gravar com a nova), não só trocar a variável.
"""
import secrets


def main() -> None:
    chave = secrets.token_urlsafe(48)  # 48 bytes de entropia, bem acima do mínimo de 32 caracteres exigido
    print(chave)


if __name__ == "__main__":
    main()
