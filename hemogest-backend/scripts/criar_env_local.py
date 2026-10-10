"""
HemoGest — Cria o `.env` do setup local sem Docker (SQLite + disco local).

Lacuna encontrada ao testar a instalação do zero (ver CHECKLIST_ROADMAP.md
§3): `setup.bat` roda `alembic upgrade head` direto, mas nunca cria um
`.env` antes — como `DATABASE_URL`, `JWT_SECRET_KEY` e
`FIELD_ENCRYPTION_KEY` são obrigatórias (`app.core.config.Settings`), uma
instalação do zero, seguindo exatamente o que `LOCAL_SETUP.md` descreve,
falha imediatamente com um erro de validação do Pydantic, antes de chegar a
criar qualquer tabela.

Este script fecha essa lacuna: se `hemogest-backend/.env` ainda não existir,
cria um com SQLite local, armazenamento em disco e chaves secretas geradas
na hora (mesma força usada por `generate_encryption_key.py`) — sem exigir
que a pessoa edite nada à mão. Se o `.env` já existir (por exemplo, criado
manualmente para apontar para Postgres), não faz nada, para nunca sobrescrever
uma configuração já em uso.

Uso:
    python scripts/criar_env_local.py
"""
import secrets
import sys
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"

CONTEUDO = """\
# Gerado automaticamente por scripts/criar_env_local.py (setup.bat) — setup
# local sem Docker, com SQLite e armazenamento em disco. Veja LOCAL_SETUP.md.
# Para produção ou Docker, use hemogest-backend/.env.example como modelo.

APP_NAME="Hellux - Módulo de Transfusão"
APP_ENV=development
APP_DEBUG=true

JWT_SECRET_KEY={jwt_secret_key}
FIELD_ENCRYPTION_KEY={field_encryption_key}

DATABASE_URL=sqlite:///./hemogest.db

STORAGE_BACKEND=local
LOCAL_STORAGE_PATH=./storage

LOG_LEVEL=INFO
LOG_JSON=false
"""


def main() -> None:
    if ENV_PATH.exists():
        print(f"{ENV_PATH} já existe — nada a fazer.")
        return

    conteudo = CONTEUDO.format(
        jwt_secret_key=secrets.token_urlsafe(48),
        field_encryption_key=secrets.token_urlsafe(48),
    )
    ENV_PATH.write_text(conteudo, encoding="utf-8")
    print(f"{ENV_PATH} criado com SQLite local e chaves geradas automaticamente.")


if __name__ == "__main__":
    sys.exit(main())
