"""
HemoGest — Seed do primeiro Administrador Global.

Lacuna conhecida (ver RUNBOOK.md): a Fase 2 não construiu um endpoint de
bootstrap inicial — sem um Admin Global já existente, ninguém consegue criar
os demais usuários pela API. Este script resolve isso indo direto ao banco.

Cria (se ainda não existirem):
  - as 4 roles fixas da V1 (ADMIN_GLOBAL, SUPERVISOR, BIOMEDICO, TECNICO)
  - o primeiro usuário Admin Global, já com primeiro_acesso=False (pronto
    para logar imediatamente, sem passar pelo fluxo de primeiro acesso)

Uso:
    python scripts/seed_admin.py
    python scripts/seed_admin.py --login admin --senha MinhaSenha123 --nome "Admin"

Idempotente: pode ser executado várias vezes; só cria o que ainda não existe.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import hash_password  # noqa: E402
from app.db.session import Base, SessionLocal, engine  # noqa: E402
from app.models.role import Role, RoleCodigo  # noqa: E402
from app.models.usuario import Usuario  # noqa: E402

import app.models  # noqa: E402,F401 — registra todos os models no Base.metadata

ROLES_PADRAO = [
    (RoleCodigo.ADMIN_GLOBAL, "Administrador Global", []),
    (RoleCodigo.SUPERVISOR, "Supervisor", []),
    (RoleCodigo.BIOMEDICO, "Biomédico", []),
    (RoleCodigo.TECNICO, "Técnico", []),
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Cria o primeiro Admin Global do HemoGest.")
    parser.add_argument("--login", default="admin")
    parser.add_argument("--senha", default="TrocarSenha123!")
    parser.add_argument("--nome", default="Administrador")
    parser.add_argument(
        "--create-tables",
        action="store_true",
        help="Cria as tabelas via Base.metadata.create_all antes do seed "
        "(atalho para SQLite local; em Postgres prefira `alembic upgrade head`).",
    )
    args = parser.parse_args()

    if args.create_tables:
        Base.metadata.create_all(bind=engine)
        print("Tabelas criadas/conferidas via Base.metadata.create_all().")

    db = SessionLocal()
    try:
        roles_por_codigo = {}
        for codigo, nome_exibicao, permissoes in ROLES_PADRAO:
            role = db.query(Role).filter(Role.codigo == codigo).first()
            if role is None:
                role = Role(codigo=codigo, nome_exibicao=nome_exibicao, permissoes=permissoes)
                db.add(role)
                db.flush()
                print(f"Role criada: {codigo}")
            roles_por_codigo[codigo] = role

        usuario = db.query(Usuario).filter(Usuario.login == args.login).first()
        if usuario is not None:
            print(f"Usuário '{args.login}' já existe — nada a fazer.")
            return

        usuario = Usuario(
            nome=args.nome,
            login=args.login,
            senha_hash=hash_password(args.senha),
            role_id=roles_por_codigo[RoleCodigo.ADMIN_GLOBAL].id,
            unidade_hospitalar_id=None,
            ativo=True,
            primeiro_acesso=False,
        )
        db.add(usuario)
        db.commit()
        print(f"Admin Global criado: {args.login} / senha: {args.senha}")
        print("Troque a senha após o primeiro login (POST /api/v1/auth/change-password).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
