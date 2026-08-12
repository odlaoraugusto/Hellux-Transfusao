# 06 — Roadmap.md — HemoGest V1

Status: 📌 Congelado · Última atualização: 23/07/2026

Este documento consolida o cronograma oficial (Fases 0 a 17) já definido
para o projeto, servindo como índice de acompanhamento. Uma decisão
arquitetural relevante em qualquer fase deve gerar um ADR em `07 - ADRs/`.

## Progresso

- [x] **Fase 0 — Engenharia do Projeto** ✅ Concluída
  - [x] Vision.md / SRS.md / DataModel.md / DER.md
  - [x] Architecture.md
  - [x] Roadmap.md
  - [ ] DER gráfico (Crow's Foot) — pendente de ferramenta de diagramação
- [x] **Fase 1 — Infraestrutura do Projeto**
  - [x] Sprint 1.1 — Estrutura do Backend (scaffold FastAPI, Docker, config,
        logging, JWT, MinIO, sistema de config)
  - [x] Sprint 1.2 — Banco de Dados: models `UnidadeHospitalar`, `Setor`,
        `Role`, `Usuario` (Bloco Parametrização/Segurança do DER) + primeira
        migration Alembic (`bf98cf59805f_schema_inicial.py`), com seed dos 4
        perfis fixos (ADMIN_GLOBAL, SUPERVISOR, BIOMEDICO, TECNICO) →
        **entregue neste pacote**

  > ⚠️ Não há PostgreSQL/rede disponível neste ambiente de execução para
  > rodar `alembic upgrade head` de fato. Models e migration foram revisados
  > manualmente (sintaxe validada, FKs e relationships conferidos campo a
  > campo). **Fica como brecha de teste para o momento em que subirmos o
  > `docker compose up`**, igual combinamos no MicroGest: validar a migration
  > contra um Postgres real antes de avançar para o Sprint 2.1.
- [x] **Fase 2 — Segurança**
  - [x] Sprint 2.1 — Roles CRUD (protege os 4 perfis fixos contra exclusão)
  - [x] Sprint 2.2 — Usuários: CRUD, Login, Logout, JWT (access+refresh com
        revogação via tabela `refresh_token`), Recuperação de senha e
        Primeiro acesso (via `password_reset_token`, mesmo fluxo dos dois)
  - [x] Sprint 2.3 — Permissões: RBAC completo (`require_roles` /
        `require_permission` em `app/core/permissions.py`), Admin Global
        sempre passa
  - [x] Sprint 2.4 — Auditoria: tabela `audit_log` (append-only) + helper
        `registrar_auditoria`, já plugado em Roles e Usuários (login,
        logout, login falhou, criação, edição, exclusão lógica). Hooks de
        upload/download entram junto com o módulo de Anexos (Fase 9).
  - Migration `7a3f1c9e2b40_seguranca_tokens_auditoria.py` cobre as 3 tabelas novas.

  > ⚠️ Mesma brecha de teste: sintaxe e relationships revisados manualmente,
  > mas login/refresh/RBAC de ponta a ponta só validam contra Postgres real
  > (`docker compose up` + `alembic upgrade head`). Deixamos para o momento
  > da integração, junto com o teste do Sprint 1.2.

- [x] **Fase 3 — Parametrização**
  - [x] Sprint 3.1 — Unidade Hospitalar: CRUD (criação restrita a Admin
        Global — é o onboarding de um novo tenant no SaaS)
  - [x] Sprint 3.2 — Setores
  - [x] Sprint 3.3 — Hemocomponentes
  - [x] Sprint 3.4 — Motivos de Devolução
  - [x] Sprint 3.5 — Motivos de Descarte
  - [x] Sprint 3.6 — Tipos de Reação
  - [x] Sprint 3.7 — Gravidade
  - [x] Sprint 3.8 — Uploads (logo da unidade via MinIO, com validação de
        tipo/tamanho e URL pré-assinada)

  As 5 entidades de Sprints 3.3–3.7 têm exatamente a mesma forma
  (nome/descrição/cor/ordem/ativo, isoladas por unidade), então usei um
  **router + service genéricos** (`parametrizacao_service.py` +
  `_build_router` em `parametrizacoes.py`) em vez de repetir CRUD 5 vezes.
  Setor ficou fora dessa fábrica por ter forma um pouco diferente (sem
  cor/ordem) — CRUD dedicado em `setor_service.py`.

  **Ajuste de arquitetura**: o Admin Global não pertence a nenhuma unidade
  fixa, mas os endpoints acima têm escopo por unidade. Resolvido com o
  header `X-Unidade-Id` (já previsto em `Settings.DEFAULT_TENANT_HEADER`,
  agora efetivamente usado em `app/core/tenant.py`) — só o Admin Global pode
  usá-lo; para os demais perfis ele é ignorado.

  Migration `2f6b8d4a91c3_parametrizacao.py` cobre as 5 tabelas novas.

  > ⚠️ Mesma brecha de teste das fases anteriores: validado por leitura +
  > sintaxe, teste real fica para quando subirmos o ambiente com Postgres.

- [x] **Fase 4 — Assistencial (Cadastro)**
  - [x] Sprint 4.1 — Pacientes: CRUD completo + pesquisa (nome/nome da mãe
        via `ilike`, CPF, nº prontuário) com paginação (`limit`/`offset`)
  - [x] Sprint 4.2 — Internações: nova internação, alta, histórico de
        mudança de setor (`InternacaoSetorHistorico`, registro append-only
        que mantém o intervalo de cada setor por onde o paciente passou)

  Migration `9d1e5a7c3f28_pacientes_internacoes.py` cobre as 3 tabelas novas.

  > ⚠️ Mesma brecha de teste: validado por leitura + sintaxe; teste real
  > (incluindo a lógica de fechar/abrir histórico de setor) fica para o
  > ambiente com Postgres.

- [x] **Fase 5 — Hemocomponentes** (a bolsa física: `UnidadeHemocomponente`,
      distinta do parâmetro `Hemocomponente` da Fase 3)
  - [x] Cadastro (número, tipo, tipo sanguíneo, validade)
  - [x] Pesquisa/Filtros (status, tipo, número, validade)
  - [x] Status: DISPONIVEL → RESERVADO → TRANSFUNDIDO / DEVOLVIDO / DESCARTADO
  - Regra de negócio implementada: **numeração de bolsas satélites**
    (`fracionar`, sufixos A/B/C... via `codigo_satelite` + `bolsa_mae_id`)

- [x] **Fase 6 — Processo Transfusional**
  - [x] Novo acompanhamento (exige bolsa RESERVADA)
  - [x] Início
  - [x] Sinais Vitais (Pré, 10min, 1h, Final, Extras)
  - [x] Finalização (marca bolsa como TRANSFUNDIDO se não houve intercorrência)
  - [x] Intercorrências (status dedicado, não bloqueia registro de sinais vitais)

- [x] **Fase 7 — Reações Transfusionais**
  - [x] Abertura, Investigação, Notivisa (opcional), Encerramento
  - Fluxo linear reforçado no service (não dá pra pular etapa)

- [x] **Fase 8 — Devoluções e Descartes**
  - [x] Devolução e Descarte (ambos levam a bolsa a status terminal)
  - [x] Anexos — ver Fase 9 (endpoint genérico, aceita `devolucao`/`descarte`/`reacao_transfusional`)

- [x] **Fase 9 — Gerenciador de Anexos**
  - [x] MinIO (reaproveita `StorageService` da Fase 3)
  - [x] Upload, Download (sempre via URL pré-assinada, nunca pública),
        Visualização (listagem por entidade)

- [x] **Fase 10 — Dashboard**
  - [x] Cards (estoque por tipo de hemocomponente)
  - [x] Gráficos (indicadores diários: entradas/saídas/descartes/retornos)
  - [x] Pendências (transfusões em andamento, reações abertas)
  - [x] Alertas (vencimento próximo, estoque crítico, Notivisa)
  - ⚠️ Cards do mockup original sem módulo correspondente na V1
    ("Solicitações pendentes", "Provas cruzadas em andamento") foram
    **omitidos** — dependem de uma fila de solicitação de sangue e de um
    módulo de prova cruzada laboratorial que não estão no DER atual. Fica
    como decisão em aberto: criar esses módulos ou remover os cards do
    design.
  - Atividades Recentes / Pesquisa Global: não implementados (dependem de
    um índice de busca cross-entidade — candidato a ADR futuro).

- [x] **Fase 11 — Relatórios**
  - [x] Pacientes, Internações, Hemocomponentes, Transfusões, Reações,
        Devoluções, Descartes, Auditoria — todos com filtro de período
  - [x] Exportação CSV nativa (`?format=csv`, só stdlib)
  - ⚠️ Exportação PDF/Excel **não implementada**: dependeria de
    `reportlab`/`openpyxl`, que não pude instalar nem validar neste
    ambiente sem rede. O service já retorna dados estruturados prontos
    para plugar essas libs depois sem mudar a assinatura.

- [x] **Fase 12 — Indicadores** (assistenciais, operacionais, qualidade —
      taxas de descarte/devolução/reação por período)

  Migration `5c8e2b0f4a17_fases_5_a_9.py` cobre as tabelas novas das Fases
  5–9. Fases 10–12 são só leitura, sem tabelas novas.

  > ⚠️ Mesma brecha de teste de sempre: validado por leitura + sintaxe;
  > `to_csv` (Fase 11) foi o único trecho testável sem banco e está coberto
  > em `tests/test_relatorio_csv.py`. Todo o resto — inclusive a máquina de
  > estados de bolsa/acompanhamento/reação — só valida de verdade contra
  > Postgres.

- [x] **Fase 13 — Frontend (React + TypeScript)** — início (Sprint 13.1 +
      parte da 13.2/13.3), em `hemogest-frontend/`
  - [x] Layout: Sidebar (espelha o menu do mockup oficial), Navbar, tema
        claro/escuro
  - [x] Cliente HTTP central com refresh automático de JWT e suporte ao
        header `X-Unidade-Id`
  - [x] Componentes base: `Card`, `Badge`, `Button`
  - [x] Telas completas: **Login**, **Dashboard** (consome os 4 endpoints
        de `/dashboard/*`, gráfico via `recharts`), **Pacientes** (pesquisa
        com debounce + tabela)
  - [ ] Demais telas do menu: rota registrada, mas com placeholder
        (`EmBrevePage`) — endpoints já existem no backend, falta só a UI
  - Validado com `tsc --noEmit` contra stubs de tipos temporários (não
    tínhamos rede para `npm install` os pacotes reais); os stubs
    encontraram 2 pontos reais a corrigir (`React.ReactNode` sem import
    explícito) e foram descartados depois — não fazem parte do pacote.

  > ⚠️ Mesma brecha de sempre, agora do lado do frontend: sem `npm install`
  > (sem rede), não deu pra rodar `npm run dev`/`build` de verdade. Fica
  > para quando houver ambiente com Node conectado à internet.

- [ ] **Fase 14 — Testes** (unitários, integração, API, frontend, fluxos)
- [ ] **Fase 14 — Testes** (unitários, integração, API, frontend, fluxos)
- [ ] **Fase 15 — Homologação**
- [ ] **Fase 16 — Deploy** (servidor, backup, HTTPS, domínio, monitoramento)
- [ ] **Fase 17 — V1 Oficial**

## Próximo passo recomendado

**Backend V1 funcionalmente completo (Fases 1–12).** O que falta é de outra
natureza — precisa de ambiente/ferramentas que este espaço de execução não
tinha (rede para instalar pacotes, banco Postgres real, servidor Node para
build de frontend):

- **Fase 13 — Frontend (React + TypeScript)**: layout (sidebar, navbar,
  tema claro/escuro), componentes (tabela, modal, drawer, cards, timeline,
  badges) e telas, usando a paleta e tipografia já congeladas em
  `05-Architecture.md`. É o maior próximo bloco de trabalho — melhor
  abordar como projeto à parte (`npm create vite`, Tailwind, etc.), não faz
  sentido tentar caber num scaffold Python.
- **Fase 14 — Testes**: rodar de fato os testes já escritos
  (`pytest`) e os que ainda faltam (integração/fluxos), o que exige o
  `docker compose up` mencionado nas brechas de teste espalhadas por este
  documento.
- **Fases 15–17 — Homologação, Deploy, V1 Oficial**: dependem de um
  ambiente real (servidor, domínio, HTTPS) e de gente testando o sistema —
  não é algo que se resolve escrevendo mais código.
