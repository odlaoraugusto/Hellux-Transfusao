# RUNBOOK — Primeira execução do HemoGest

> Este documento é sobre rodar **localmente** (dev). Pra colocar em
> produção no Fly.io, veja [`DEPLOY.md`](./DEPLOY.md).

Este documento existe porque o ambiente onde o código foi escrito **não
tinha rede liberada nem Postgres/Docker instalados** — tudo foi validado
por leitura, `py_compile`/`tsc --noEmit`, e uma suíte de testes de lógica
pura (ver `logic_check/`, 22 testes passando, sem depender de banco). O que
falta é justamente o que só um ambiente real consegue provar.

Siga esta ordem. Cada etapa assume que a anterior funcionou.

## 1. Backend — subir a infraestrutura

```bash
cd hemogest-backend
cp .env.example .env
# edite JWT_SECRET_KEY e as senhas do .env antes de continuar

docker compose up --build -d db minio
docker compose ps   # confirme que db e minio estão "healthy"/"running"
```

## 2. Rodar as migrations contra o Postgres real

```bash
docker compose run --rm api alembic upgrade head
```

**O que observar:** essa é a primeira vez que o schema inteiro (12 fases,
~20 tabelas) é aplicado de ponta a ponta. Se alguma FK, índice ou
`UniqueConstraint` estiver errado, é aqui que vai quebrar. Se der erro,
me mande a mensagem completa — a causa mais provável é uma referência de
tabela com nome diferente entre model e migration (revisei manualmente,
mas é exatamente o tipo de erro que passa despercebido sem execução real).

## 3. Subir a API e rodar os testes automatizados

```bash
docker compose up --build -d api
docker compose exec api pytest -v
```

Testes existentes: `test_health.py`, `test_security.py`,
`test_relatorio_csv.py`. Nenhum deles cobre fluxo completo com banco ainda
— são unitários. **Próximo passo natural depois que isso passar:** escrever
testes de integração (Fase 14) que batem na API de verdade — login →
criar unidade → criar bolsa → reservar → transfundir, etc.

## 4. Smoke test manual da API

Com a API no ar (`http://localhost:8000/docs`):

1. Não existe usuário nenhum ainda — o primeiro Admin Global precisa ser
   inserido direto no banco (a Fase 2 não construiu um endpoint de
   "seed"/bootstrap inicial, só depois que já existe um Admin Global é que
   dá pra criar os outros via API). **Isso é uma lacuna real** — considere
   um script `seed_admin.py` ou uma migration de dados com o primeiro
   usuário antes de ir pra produção.
2. Login (`POST /api/v1/auth/login`) → deve falhar com 403 se
   `primeiro_acesso=true` (comportamento esperado).
3. Criar uma Unidade Hospitalar (`POST /api/v1/unidades-hospitalares`,
   só Admin Global).
4. Criar Role/Setor/Hemocomponente (parametrização) usando o header
   `X-Unidade-Id`.
5. Cadastrar uma bolsa, reservar, iniciar acompanhamento, registrar sinal
   vital, finalizar — esse é o fluxo mais longo e mais provável de expor
   um bug de integração entre services.

## 5. Frontend

```bash
cd hemogest-frontend
npm install
npm run dev
```

**O que observar:** o `npm install` é a primeira vez que os tipos reais de
`react`, `react-router-dom`, `recharts` e `lucide-react` entram em cena —
os stubs que usei pra validação (`tsc --noEmit`) eram simplificados demais
pra pegar erros de tipagem fina. Rode `npm run build` (não só `dev`) pra
pegar esses erros antes de considerar a Fase 13 "testada".

## 6. O que eu testei de verdade vs. o que fica pendente

| Camada | Testado de verdade aqui | Só validado por leitura |
|---|---|---|
| Lógica de negócio pura (máquina de estados, RBAC, satélites, histórico de setor) | ✅ 22 testes, `logic_check/` | — |
| Sintaxe Python | ✅ `py_compile` em 100% dos arquivos | — |
| Sintaxe/tipos TypeScript | ✅ `tsc --noEmit` com stubs | Tipos reais dos pacotes (só com `npm install`) |
| Schema do banco (migrations) | ❌ nunca rodou contra Postgres | Revisão manual de FKs/índices |
| Integração API completa (services + DB + auth) | ❌ | Revisão manual |
| MinIO (upload/download de anexos) | ❌ | Revisão manual |
| Frontend renderizando de verdade | ❌ | Revisão manual + tipos parciais |

Se qualquer etapa acima quebrar, é esperado — faz parte de destravar isso
com uma primeira execução real. Me chama com o erro que eu ajusto.
