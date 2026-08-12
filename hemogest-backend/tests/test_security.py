import os

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-with-at-least-32-characters")
os.environ.setdefault("FIELD_ENCRYPTION_KEY", "test-field-key-with-at-least-32-characters")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")

from app.core.security import (  # noqa: E402
    create_access_token,
    decode_token,
    generate_opaque_token,
    hash_opaque_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip() -> None:
    hashed = hash_password("minhaSenhaForte123")
    assert hashed != "minhaSenhaForte123"
    assert verify_password("minhaSenhaForte123", hashed)
    assert not verify_password("senhaErrada", hashed)


def test_opaque_token_hash_is_deterministic() -> None:
    token = generate_opaque_token()
    assert hash_opaque_token(token) == hash_opaque_token(token)
    assert hash_opaque_token(token) != token


def test_access_token_roundtrip() -> None:
    token = create_access_token("user-123", extra_claims={"role": "TECNICO"})
    payload = decode_token(token)
    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"
    assert payload["role"] == "TECNICO"
