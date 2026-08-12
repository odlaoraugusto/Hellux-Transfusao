# DEPLOY.md — HemoGest em produção (Fly.io, região `gru`/São Paulo)

Este documento é o passo-a-passo pra colocar o HemoGest no ar de verdade.
Ele assume que você (dono do projeto) tem a `flyctl` instalada e autenticada
(`fly auth login`) — **nada aqui foi executado neste ambiente**: não há conta
Fly configurada onde este trabalho foi feito, então todo o `fly ...` abaixo é
o que você vai rodar na sua máquina, não algo que já rodou.

Pra quem só quer rodar localmente (dev), use o `RUNBOOK.md` — este arquivo é
só sobre produção.

## Por que `gru` (São Paulo)

Decisão deliberada: HemoGest lida com dado de saúde (LGPD trata isso como
dado sensível, art. 5º, II). Hospedar o banco e a API na região São Paulo do
Fly reduz a discussão sobre residência/transferência internacional de dados.
**Isso cobre computação e banco — não cobre automaticamente terceiros que
você conectar depois** (ex.: um provedor de e-mail transacional, um serviço
de anexos fora do Fly). Se algum desses entrar no projeto, revisite essa
análise.

---

## 0. Visão geral da arquitetura de deploy

- **Backend** (`hemogest-backend/`): app Fly.io próprio, Dockerfile, região
  `gru`. Ver `fly.toml` nesta pasta.
- **Frontend** (`hemogest-frontend/`): SPA estática (Vite/React). Duas
  opções — escolhida aqui: **Opção A** (Fly.io, nginx). Opção B fica
  documentada como alternativa mais simples caso quimestre trocar depois.
- **Banco**: Postgres gerenciado pelo Fly (ver seção 3 — a oferta mudou
  recentemente, confirme no painel antes de provisionar).
- **Anexos** (`STORAGE_BACKEND=minio`, o default em produção): um object
  storage S3-compatível. Ver seção 3.1 — **isso também é dado sensível
  potencialmente** (anexos de reação transfusional, laudos), não é só o
  Postgres que precisa de cuidado de residência.

### Frontend: por que Opção A (Fly.io + nginx) em vez de Cloudflare Pages/Netlify/Vercel

Escolhi manter tudo na mesma plataforma (Fly) por simplicidade operacional
nesta fase — uma conta, uma cobrança, um lugar pra olhar logs/métricas, e
você já vai ter uma conta Fly pro backend de qualquer forma. O custo é abrir
mão de uma CDN global pronta e de builds automáticos por push (Netlify/
Vercel fazem isso de graça); pra uma SPA de baixo tráfego isso não pesa
muito. **Se no futuro o tráfego do frontend crescer ou você quiser preview
deployments automáticos por PR, migrar pra Cloudflare Pages é simples** — é
só apontar o DNS pro novo host e trocar `VITE_API_BASE_URL` no build.

Arquivos da Opção A: `hemogest-frontend/Dockerfile` (multi-stage: build com
Node, runtime só com nginx), `hemogest-frontend/nginx.conf`,
`hemogest-frontend/fly.toml`.

**Opção B (alternativa, caso prefira)**: build local (`npm run build`) e
subir a pasta `dist/` num host estático dedicado (Cloudflare Pages, Netlify
ou Vercel). Mais simples, TLS automático, CDN de borda pronta. Nesse caso
você **não precisa** dos três arquivos acima — só configura
`VITE_API_BASE_URL` como variável de build na plataforma escolhida, apontando
pra URL pública do backend no Fly (`https://<seu-app-backend>.fly.dev/api/v1`).
O `src/lib/api.ts` já foi ajustado pra ler essa variável com fallback pro
comportamento atual de dev (path relativo `/api/v1`), então essa troca de
plataforma não exige mexer em código.

---

## 1. Criar os apps no Fly

```bash
# Backend
cd hemogest-backend
fly apps create hemogest-backend        # nomes de app no Fly são globais —
                                          # se "hemogest-backend" já existir
                                          # (de outra conta), escolha outro e
                                          # atualize `app = "..."` no fly.toml

# Frontend
cd ../hemogest-frontend
fly apps create hemogest-frontend        # mesma observação sobre nome único
```

Se os nomes escolhidos forem diferentes dos placeholders (`hemogest-backend`
/ `hemogest-frontend`), edite o campo `app = "..."` no topo de cada
`fly.toml` antes de continuar.

---

## 2. Variáveis de ambiente — o que é secret e o que não é

Regra: **qualquer coisa em `.env.example` que seja credencial, chave ou
string de conexão vai por `fly secrets set` — nunca em `fly.toml`.** O que
não é sensível (nível de log, flags de comportamento, lista de origens CORS)
pode ir em `[env]` no `fly.toml` (já configurado lá).

### 2.1 Lista completa — todas as variáveis de `.env.example` + a nova

| Variável | Vai por... | Observação |
|---|---|---|
| `APP_NAME` | `[env]` no fly.toml (opcional, já tem default) | não sensível |
| `APP_ENV` | `[env]` no fly.toml | já setado como `production` |
| `APP_DEBUG` | `[env]` no fly.toml | **deixe `false`** — `/docs` e `/redoc` só abrem se isso for `true`, e em produção isso vaza schema da API |
| `JWT_SECRET_KEY` | **`fly secrets set`** | assinatura dos tokens — gere uma chave forte, nunca reaproveite a de dev |
| `JWT_ALGORITHM` | `[env]` (opcional, tem default `HS256`) | não sensível |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `[env]` (opcional) | não sensível |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `[env]` (opcional) | não sensível |
| `DATABASE_URL` | **`fly secrets set`** | string de conexão completa (usuário+senha do Postgres) — nunca em `fly.toml` |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | `[env]` (opcional) | não sensível |
| `CORS_ORIGINS` | `[env]` no fly.toml | não é segredo (é uma lista de origens públicas), mas **precisa ser trocado** pro domínio real do frontend antes do deploy — ver seção 4 |
| `STORAGE_BACKEND` | `[env]` no fly.toml | já setado como `minio` |
| `MINIO_ENDPOINT` | `[env]` no fly.toml (não sensível — é um hostname) ou secret, se preferir não deixar nem o endpoint público | depende do provedor S3 escolhido — ver 3.1 |
| `MINIO_ACCESS_KEY` | **`fly secrets set`** | credencial |
| `MINIO_SECRET_KEY` | **`fly secrets set`** | credencial |
| `MINIO_BUCKET_NAME` | `[env]` (opcional) | não sensível |
| `MINIO_SECURE` | `[env]` no fly.toml | **`true`** em produção (endpoint S3 real fala HTTPS; `false` só fazia sentido pro MinIO local do docker-compose) |
| `LOG_LEVEL` / `LOG_JSON` | `[env]` no fly.toml | já configurado |
| `FIELD_ENCRYPTION_KEY` | **`fly secrets set`** | **nova** — criptografia de campo dos dados de paciente. Gere com `python scripts/generate_encryption_key.py` (script já existe no repo). Guarde essa chave em um cofre externo além do Fly (ex.: gerenciador de senhas da equipe) — se ela se perder, os dados de paciente já gravados ficam irrecuperáveis, e trocar a chave sem um processo de re-criptografia torna ilegíveis os registros antigos (ver docstring do próprio script) |

### 2.2 Comandos exatos

```bash
cd hemogest-backend

fly secrets set \
  JWT_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')" \
  DATABASE_URL="postgresql+psycopg://<usuario>:<senha>@<host>:5432/<db>" \
  MINIO_ACCESS_KEY="<access-key-do-provedor-s3-escolhido>" \
  MINIO_SECRET_KEY="<secret-key-do-provedor-s3-escolhido>" \
  FIELD_ENCRYPTION_KEY="$(python scripts/generate_encryption_key.py)" \
  --app hemogest-backend
```

Rode `fly secrets list --app hemogest-backend` depois pra conferir os nomes
setados (os valores nunca aparecem de volta — anote em cofre próprio antes).

**Nunca** commite os valores reais em nenhum arquivo do repositório, nem em
mensagem de commit, nem em print de terminal salvo em algum lugar público.

---

## 3. Banco de dados (Postgres)

A oferta de Postgres gerenciado do Fly **mudou nos últimos tempos** ("Fly
Postgres" legado, baseado em apps Fly comuns rodando Postgres, vs "Managed
Postgres" mais novo, totalmente gerenciado). **Confira no painel do Fly
(`fly postgres create` ou a opção equivalente na dashboard) qual é a oferta
atual no momento em que você for provisionar** — não confie cegamente num
comando específico documentado aqui, ele pode ter mudado.

O que não muda, independente da oferta escolhida:

1. Provisione o banco **na região `gru`** (mesma do backend — evita
   latência cross-region e mantém a residência de dados consistente).
2. Anote a `DATABASE_URL` resultante (ou, se o Fly oferecer "attach"
   automático a um app, ele mesmo seta o secret pra você — confirme com
   `fly secrets list --app hemogest-backend` se `DATABASE_URL` já apareceu).
3. Se precisar setar manualmente: `fly secrets set DATABASE_URL="..." --app hemogest-backend` (nunca em `fly.toml`).
4. O driver usado no `requirements.txt` é `psycopg[binary]` (psycopg 3) —
   a URL precisa começar com `postgresql+psycopg://` (é o formato que já
   está em `.env.example`), não `postgresql://` puro nem `postgres://`.

### 3.1 Anexos (object storage S3-compatível)

`STORAGE_BACKEND=minio` é o default de produção — a lib `minio` do
`requirements.txt` fala o protocolo S3, então funciona com qualquer provedor
S3-compatível, não só MinIO de verdade. Duas opções:

- **Tigris** (object storage nativo do Fly, `fly storage create`): mais
  simples de integrar, mas confirme a política de residência de dados —
  por padrão o Tigris pode replicar globalmente. Se os anexos incluem dado
  clínico sensível (eles incluem: fotos de reação transfusional, laudos de
  descarte), **valide explicitamente se dá pra fixar a região/replicação
  antes de usar em produção**, ou trate isso como uma pendência de
  compliance a resolver com o time jurídico antes do go-live.
- **MinIO auto-hospedado** num app Fly separado, com um Fly Volume anexado
  na região `gru` — mais controle sobre onde o dado físico fica, mais
  trabalho operacional (você vira responsável por backup do volume, upgrade
  da imagem do MinIO, etc.).

Não crie infraestrutura de storage sem decidir essa questão de residência
primeiro — é o mesmo racional que levou a escolher `gru` pro banco.

---

## 4. CORS

`CORS_ORIGINS` (em `app/core/config.py`) é lido pelo `pydantic-settings`
como `List[str]`. Vindo de variável de ambiente, isso precisa ser uma
**string com JSON array**, não uma lista separada por vírgula:

```toml
# fly.toml [env] — já está assim, mas troque o domínio real:
CORS_ORIGINS = '["https://app.hemogest.com.br"]'
```

Se o frontend acabar em mais de um domínio (ex.: um domínio Fly temporário
`hemogest-frontend.fly.dev` + o domínio próprio depois), liste os dois:
`'["https://hemogest-frontend.fly.dev", "https://app.hemogest.com.br"]'`.

Confirme o valor final rodando `fly ssh console --app hemogest-backend -C "env | grep CORS"`
depois do deploy, ou simplesmente teste um request do frontend real e olhe
o console do navegador — CORS errado dá erro bem claro lá.

---

## 5. Migrations (Alembic) contra o banco de produção

Depois que `DATABASE_URL` já está setada como secret, mas **antes** do
primeiro `fly deploy` (ou logo depois — a API vai subir mas vai quebrar em
qualquer endpoint que toque o banco até as tabelas existirem):

```bash
cd hemogest-backend
fly ssh console --app hemogest-backend -C "alembic upgrade head"
```

Se a máquina ainda não tiver sido deployada nenhuma vez (não dá pra `fly ssh
console` num app sem máquina rodando), rode o primeiro `fly deploy` (seção
6) primeiro — a API vai subir com erro 500 em rotas que usam banco até você
rodar essa migration, o que é esperado nesse meio-tempo.

Depois de migrar, rode o seed do primeiro Admin Global (resolve a lacuna já
documentada no `RUNBOOK.md` — não existe endpoint de bootstrap):

```bash
fly ssh console --app hemogest-backend -C \
  "python scripts/seed_admin.py --email admin@suaempresa.com.br --senha 'TrocarImediatamente!23' --nome 'Admin'"
```

**Troque a senha logo no primeiro login** (`POST /api/v1/auth/change-password`)
— o script cria o usuário já com `primeiro_acesso=False`, então nada força
essa troca automaticamente.

---

## 6. Deploy

```bash
# Backend
cd hemogest-backend
fly deploy --app hemogest-backend

# Frontend (Opção A escolhida — ajuste a URL pro domínio real do backend)
cd ../hemogest-frontend
fly deploy --app hemogest-frontend \
  --build-arg VITE_API_BASE_URL=https://hemogest-backend.fly.dev/api/v1
```

Repare que `VITE_API_BASE_URL` é **build arg**, não secret — o Vite embute
esse valor no JavaScript final durante o build. Se trocar o domínio do
backend depois, precisa rodar `fly deploy` do frontend de novo com o novo
valor (trocar só o secret não adianta, porque não existe secret aqui: já
foi embutido no bundle).

---

## 7. Domínio próprio + TLS

```bash
fly certs add app.hemogest.com.br --app hemogest-frontend
fly certs add api.hemogest.com.br --app hemogest-backend
```

Siga a instrução que o comando imprime pra criar o registro DNS (CNAME ou A/AAAA,
dependendo do seu provedor de DNS) apontando pro app do Fly. O Fly emite e
renova o certificado TLS automaticamente depois que o DNS propaga —
`fly certs show <domínio>` mostra o status até ficar `Ready`.

Depois de trocar o domínio do frontend pro definitivo, **atualize
`CORS_ORIGINS`** (seção 4) pra incluir o novo domínio, e re-rode `fly deploy`
do backend pra aplicar.

---

## 8. Checklist pós-deploy

Rode isso depois de cada deploy novo, não só no primeiro:

- [ ] `curl -i https://<seu-backend>.fly.dev/api/v1/health` → `200 {"status":"ok",...}`
- [ ] `curl -i https://<seu-backend>.fly.dev/docs` → **`404`**, não `200`.
      Se vier `200`, `APP_DEBUG` está `true` em produção — schema da API
      exposto publicamente. Corrija (`fly secrets set` ou `[env]` do
      `fly.toml`, conforme o caso) e faça deploy de novo imediatamente.
- [ ] Login (`POST /api/v1/auth/login`) com o Admin Global criado no seed
      funciona e devolve token.
- [ ] Frontend carrega em `https://<seu-frontend>` e consegue logar (valida
      CORS e `VITE_API_BASE_URL` na prática, não só na teoria).
- [ ] `fly logs --app hemogest-backend` sem stack trace repetido de erro de
      conexão com banco ou storage.
- [ ] Testar rate limit: várias tentativas de login errado seguidas devem
      bloquear (confirma que `--proxy-headers` está pegando o IP real do
      cliente e não o do proxy do Fly — se o rate limit nunca disparar
      mesmo martelando, é sinal de que todos os requests estão sendo vistos
      como vindo do mesmo IP interno, o que quebraria também o `ip_origem`
      da auditoria).
- [ ] Upload de um anexo de teste funciona ponta a ponta (valida credenciais
      do object storage).

---

## 9. O que fica pendente / fora do escopo deste documento

- Backup automático do Postgres: confirme no painel do Fly se a oferta de
  Postgres escolhida (seção 3) já inclui snapshot automático, ou se
  precisa configurar separado (`pg_dump` agendado, por exemplo).
- Monitoramento/alerta além do healthcheck do Fly (ex.: Sentry pra
  exceptions, alerta se `fly status` reportar máquina down) — não existe
  ainda, é um próximo passo razoável antes do go-live com usuários reais.
- Rotação de `FIELD_ENCRYPTION_KEY` e `JWT_SECRET_KEY`: nenhum processo
  automatizado existe hoje. Rotação de `FIELD_ENCRYPTION_KEY` em particular
  exige re-criptografia de dados existentes (não é troca simples de secret).
- Confirmação da política de residência de dados do object storage
  escolhido pra anexos (seção 3.1) — trate como bloqueante de compliance,
  não como detalhe técnico, se os anexos incluírem dado clínico.
