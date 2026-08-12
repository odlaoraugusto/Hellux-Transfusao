"""
Réplica fiel da lógica de app/core/permissions.py (require_roles /
require_permission), sem o Depends do FastAPI, pra testar as regras puras.
"""
import unittest


class RoleCodigo:
    ADMIN_GLOBAL = "ADMIN_GLOBAL"
    SUPERVISOR = "SUPERVISOR"
    BIOMEDICO = "BIOMEDICO"
    TECNICO = "TECNICO"


def checar_require_roles(role_do_usuario: str, *codigos_permitidos: str) -> bool:
    """Réplica de require_roles(*codigos)._dependency, sem o HTTPException."""
    if role_do_usuario == RoleCodigo.ADMIN_GLOBAL:
        return True
    return role_do_usuario in codigos_permitidos


def checar_require_permission(role_do_usuario: str, permissoes_do_role: list[str], permissao_exigida: str) -> bool:
    if role_do_usuario == RoleCodigo.ADMIN_GLOBAL:
        return True
    return permissao_exigida in permissoes_do_role


class TestRBAC(unittest.TestCase):
    def test_admin_global_sempre_passa(self):
        # Mesmo pedindo um código que não é o dele
        self.assertTrue(checar_require_roles(RoleCodigo.ADMIN_GLOBAL, RoleCodigo.SUPERVISOR))
        self.assertTrue(checar_require_roles(RoleCodigo.ADMIN_GLOBAL))  # nem lista vazia barra

    def test_tecnico_nao_acessa_rota_so_supervisor(self):
        self.assertFalse(checar_require_roles(RoleCodigo.TECNICO, RoleCodigo.SUPERVISOR))

    def test_require_roles_vazio_so_admin_passa(self):
        # Esse é o padrão usado em roles.py e unidades_hospitalares.py pra
        # restringir a SÓ admin global (create_role, criar unidade etc.)
        self.assertFalse(checar_require_roles(RoleCodigo.SUPERVISOR))
        self.assertFalse(checar_require_roles(RoleCodigo.TECNICO))
        self.assertTrue(checar_require_roles(RoleCodigo.ADMIN_GLOBAL))

    def test_biomedico_acessa_rota_de_multiplos_perfis(self):
        self.assertTrue(checar_require_roles(RoleCodigo.BIOMEDICO, RoleCodigo.BIOMEDICO, RoleCodigo.TECNICO, RoleCodigo.SUPERVISOR))

    def test_permissao_granular(self):
        self.assertTrue(checar_require_permission(RoleCodigo.SUPERVISOR, ["pacientes:criar"], "pacientes:criar"))
        self.assertFalse(checar_require_permission(RoleCodigo.SUPERVISOR, ["pacientes:criar"], "reacoes:notivisa"))
        self.assertTrue(checar_require_permission(RoleCodigo.ADMIN_GLOBAL, [], "qualquer:coisa"))


if __name__ == "__main__":
    unittest.main()
