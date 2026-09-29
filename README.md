# Hellux — Módulo de Transfusão

Sistema web para a gestão de Agências Transfusionais hospitalares. Acompanha o caminho do hemocomponente do pedido do setor até a transfusão no paciente, com rastreabilidade de cada bolsa, verificação de compatibilidade ABO/Rh, acompanhamento clínico durante a transfusão, tratamento de reações e trilha de auditoria.

O sistema é multitenant: cada hospital (unidade hospitalar) enxerga apenas os próprios dados.

## Funcionalidades

**Solicitações**
- **Painel de solicitações:** pedidos do dia em três listas por status (Solicitado, Em processamento e Entregue ao setor), com filtro diário e filtros por status, setor, hemocomponente e paciente. No dia atual a lista se atualiza sozinha e toca um alerta sonoro quando chega um pedido novo, com toque diferente para emergência.
- **Entrega ao setor:** registra ABO/Rh do paciente, prova cruzada, temperatura de transporte, quem recebeu e as bolsas entregues. O servidor confere hemocomponente, validade, disponibilidade, quantidade e compatibilidade ABO/Rh. Incompatibilidade bloqueia a entrega; liberação com ressalva exige autorização do hemoterapeuta. As bolsas entregues ficam reservadas para o paciente.
- **Formulário público de solicitação:** página sem login, no endereço `/solicitar/<id da unidade>`, para o setor pedir hemocomponentes com os dados clínicos e laboratoriais do paciente. O formulário é gravado e depois aberto em uma visualização para impressão.
- **Formulários recebidos:** lista dos formulários enviados, por dia e modalidade (emergência, urgência, rotina, programada), com o link público para copiar e a impressão de cada um.

**Assistencial**
- **Pacientes e internações:** cadastro com dados identificadores criptografados, histórico de setores e alta.
- **Hemocomponentes (bolsas):** entrada de bolsas com número, tipo sanguíneo e validade, fracionamento em bolsas satélites (A, B, C…), reserva para paciente e controle de status (disponível, reservado, transfundido, devolvido, descartado).
- **Acompanhamento transfusional:** sinais vitais nos momentos protocolares (pré, 10 minutos, 1 hora, final e extras), finalização e registro de intercorrência.
- **Reações transfusionais:** fluxo em quatro etapas (aberta, investigação, NOTIVISA, encerrada).
- **Devoluções e descartes:** com motivos parametrizados e atualização automática do status da bolsa.
- **Anexos:** upload e download seguro de arquivos ligados aos registros.

**Gestão**
- **Dashboard:** estoque por hemocomponente, pendências, alertas (bolsas próximas do vencimento, estoque crítico) e indicadores dos últimos dias.
- **Relatórios:** pacientes, internações, hemocomponentes, transfusões, reações, devoluções, descartes e auditoria, em JSON ou CSV.
- **Indicadores:** consolidado do período.
- **Parametrizações:** hemocomponentes, motivos de devolução e de descarte, tipos de reação, gravidades e setores.
- **Unidade hospitalar, usuários e auditoria.**

## Perfis de acesso

| Perfil | O que faz |
|---|---|
| Administrador Global | Atua em várias unidades (escolhe a unidade ativa), cadastra unidades e perfis. |
| Supervisor | Gerencia usuários, setores, parametrizações e dados da própria unidade, além de toda a operação assistencial. |
| Biomédico | Operação assistencial, incluindo reações transfusionais. |
| Técnico | Operação assistencial: solicitações, bolsas, pacientes, internações, acompanhamento, devoluções e descartes. |

## Tecnologias

| Camada | Tecnologia |
|---|---|
| API | Python 3.12, FastAPI, SQLAlchemy 2, Pydantic 2 |
| Banco de dados | PostgreSQL (SQLite para uso local sem Docker) |
| Migrations | Alembic |
| Autenticação | JWT (access e refresh token), senhas com bcrypt |
| Anexos | MinIO (S3) ou disco local |
| Interface | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Execução | Docker e Docker Compose; Traefik na hospedagem em VPS |

## Estrutura do repositório

```
hemogest-backend/     API (FastAPI)
  app/api/v1/         rotas HTTP versionadas
  app/core/           configuração, segurança, tenant, permissões, auditoria
  app/models/         entidades SQLAlchemy
  app/schemas/        contratos de entrada e saída (Pydantic)
  app/services/       regras de negócio
  alembic/            migrations
  scripts/            criação do primeiro administrador, geração de chave de criptografia
  tests/              testes automatizados
hemogest-frontend/    interface (React + TypeScript)
  src/pages/          telas
  src/components/     componentes compartilhados
  src/lib/            cliente HTTP, alerta sonoro e utilitários
docker-compose.vps.yml  implantação em VPS com Traefik
LOCAL_SETUP.md          execução local no Windows, sem Docker
```

Os nomes das pastas e dos serviços permanecem `hemogest-*`.

## Segurança e privacidade

- **Isolamento por unidade:** toda entidade assistencial carrega `unidade_hospitalar_id`; a unidade é resolvida a partir do usuário autenticado.
- **Dados sensíveis criptografados em repouso:** nome, nome da mãe, CPF, CNS, prontuário e telefone dos pacientes são cifrados por campo (Fernet), com índice cego para buscas exatas.
- **Auditoria:** login, criações, edições, envios de arquivos e leitura de registros individuais de pacientes e formulários ficam registrados.
- **Sem exclusão física:** os registros assistenciais usam exclusão lógica (`deleted_at`).
- **Limite de requisições:** login e rotas públicas têm limite por IP.
- **Formulário público:** validação completa no servidor, limite de envios por IP, campo-isca contra robôs e link de impressão com token secreto (só o hash do token é guardado).
- **Documentação da API** (`/docs`) fica desligada quando `APP_DEBUG` não está ativo.

## Como rodar

### Com Docker (desenvolvimento)

```bash
cd hemogest-backend
cp .env.example .env        # preencha as chaves e senhas antes de continuar
docker compose up --build -d db minio
docker compose run --rm api alembic upgrade head
docker compose up --build
```

A API sobe em `http://localhost:8000` (Swagger em `/docs` com `APP_DEBUG=true`) e o console do MinIO em `http://localhost:9001`.

Crie o primeiro Administrador Global:

```bash
docker compose run --rm api python scripts/seed_admin.py --email admin@exemplo.com --senha 'SENHA-FORTE' --nome Administrador
```

### Sem Docker

```bash
cd hemogest-backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env         # use DATABASE_URL=sqlite:///./hemogest.db e STORAGE_BACKEND=local
alembic upgrade head
python scripts/seed_admin.py
uvicorn app.main:app --reload
```

Em Windows, sem privilégios de administrador, siga o [`LOCAL_SETUP.md`](./LOCAL_SETUP.md): os arquivos `setup.bat` preparam tudo e o `iniciar-tudo.bat` sobe a API e a interface.

### Interface

```bash
cd hemogest-frontend
npm install
npm run dev                  # http://localhost:5180
```

O Vite encaminha `/api` para a API. O alvo padrão é `http://127.0.0.1:8010`; ajuste `server.proxy` em `vite.config.ts` se a sua API estiver em outra porta.

Build de produção: `npm run build`. Em produção, defina `VITE_API_BASE_URL` no build quando a interface e a API estiverem em endereços diferentes.

## Configuração

Variáveis principais do backend (arquivo `.env`, modelo em `hemogest-backend/.env.example`):

| Variável | Para que serve |
|---|---|
| `DATABASE_URL` | Conexão com o banco (PostgreSQL ou SQLite). |
| `JWT_SECRET_KEY` | Chave de assinatura dos tokens (mínimo de 32 caracteres). |
| `FIELD_ENCRYPTION_KEY` | Chave mestra da criptografia de campo (mínimo de 32 caracteres). Gere com `python scripts/generate_encryption_key.py`. Trocar a chave torna ilegíveis os dados já gravados. |
| `CORS_ORIGINS` | Endereços da interface autorizados a chamar a API. |
| `STORAGE_BACKEND` | `minio` (padrão) ou `local`. |
| `MINIO_*` | Endpoint, credenciais e bucket dos anexos. |
| `APP_NAME`, `APP_ENV`, `APP_DEBUG` | Nome exibido pela API, ambiente e modo de depuração. |

## Banco de dados e migrations

```bash
alembic upgrade head                              # aplica as migrations
alembic revision --autogenerate -m "descricao"    # cria uma nova migration
```

## Testes

```bash
cd hemogest-backend
pip install -r requirements-dev.txt
pytest
```

Na interface, `npx tsc -b` confere os tipos e `npm run build` gera o pacote de produção.

## Implantação

- **VPS com Docker Compose e Traefik:** `docker-compose.vps.yml` publica API e interface com HTTPS automático, reaproveitando o Postgres e a rede do Traefik já existentes. Preencha `hemogest-backend/.env` (modelo em `.env.vps.example`), suba com `docker compose -f docker-compose.vps.yml up -d --build` e aplique as migrations com `docker compose -f docker-compose.vps.yml exec hemogest-backend alembic upgrade head`.
- **Fly.io:** passo a passo em [`hemogest-backend/DEPLOY.md`](./hemogest-backend/DEPLOY.md).

A cada versão nova, rode `alembic upgrade head` depois de subir os containers.

## Identidade visual

Vermelho `#C62828` como cor principal (`#8E1B1B` para hover e estados ativos, `#E57373` para alertas leves), tipografia Poppins e cantos arredondados de 12 px. Os tokens ficam em `hemogest-frontend/tailwind.config.js` e os vetores da marca em `hemogest-frontend/public/brand/`. A interface tem tema claro e escuro.

## Documentação adicional

- [`hemogest-backend/README.md`](./hemogest-backend/README.md): estrutura e convenções da API.
- [`hemogest-backend/docs/05-Architecture.md`](./hemogest-backend/docs/05-Architecture.md): arquitetura e decisões.
- [`hemogest-backend/docs/06-Roadmap.md`](./hemogest-backend/docs/06-Roadmap.md): roadmap.
- [`hemogest-backend/RUNBOOK.md`](./hemogest-backend/RUNBOOK.md): primeira execução.
- [`hemogest-backend/DEPLOY.md`](./hemogest-backend/DEPLOY.md): produção no Fly.io.
- [`LOCAL_SETUP.md`](./LOCAL_SETUP.md): execução local no Windows.
