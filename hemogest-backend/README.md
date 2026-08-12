# HemoGest — Backend

API do HemoGest, sistema SaaS multitenant para gestão de Agências
Transfusionais. Stack: **FastAPI + SQLAlchemy + PostgreSQL + Alembic + JWT +
MinIO + Docker**.

Este scaffold entrega a **Fase 1 — Sprint 1.1 (Estrutura do Backend)** do
Roadmap Oficial: estrutura de pastas, configuração FastAPI, SQLAlchemy,
Alembic, Docker, variáveis de ambiente, logging, config de JWT e cliente
MinIO. Os módulos assistenciais (Fases 2 em diante) serão adicionados nas
próximas sprints.

## Estrutura

```
app/
  api/v1/        # Rotas HTTP (routers), versionadas
  core/          # Config, logging, security (JWT), tenant context
  db/            # Engine, sessão, mixins de base (UUID, soft delete, auditoria)
  models/        # Models SQLAlchemy (a popular a partir da Fase 2/3)
  schemas/       # Schemas Pydantic (request/response)
  services/      # Regras de negócio / integrações (MinIO, etc.)
  utils/         # Funções utilitárias
alembic/         # Migrations
tests/           # Testes automatizados
assets/          # Identidade visual (logo oficial)
```

## Como rodar (desenvolvimento)

```bash
cp .env.example .env
# edite .env com valores reais (nunca use os defaults em produção)

docker compose up --build
```

A API sobe em `http://localhost:8000` (`/docs` para Swagger UI).
PostgreSQL em `localhost:5432`, console MinIO em `http://localhost:9001`.

## Rodando sem Docker

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload
```

## Testes

```bash
pytest
```

## Migrations

```bash
alembic revision --autogenerate -m "descricao"
alembic upgrade head
```

## Multitenancy — header para Admin Global

Endpoints com escopo de unidade (parametrização, setores) exigem uma
unidade resolvida. Para usuários normais, ela vem do próprio cadastro. Para
o **Administrador Global** (que não pertence a uma unidade fixa), envie o
header `X-Unidade-Id: <uuid-da-unidade>` na requisição.

## Convenções (congeladas no DER)

- Chaves primárias em **UUID**.
- **Soft delete** (`deleted_at`) — nenhum registro assistencial é apagado fisicamente.
- Todo timestamp em **UTC**.
- Toda entidade assistencial carrega `unidade_hospitalar_id` (isolamento multitenant).
- Trilha de auditoria em todas as operações sensíveis (login, CRUD, upload/download).

## Identidade visual

O logo oficial (vetores em `assets/brand/`) e a paleta de cores (`#C62828`
vermelho principal, `#8E1B1B` vermelho escuro, `#E57373` vermelho claro)
e devem ser usados como fonte única de verdade para o frontend (Fase 13).
