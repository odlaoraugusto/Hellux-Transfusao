# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e o projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado
- `LICENSE` (Apache 2.0), `CONTRIBUTING.md`, `SECURITY.md` e este `CHANGELOG.md`,
  preparando o projeto para publicação acadêmica e uso por outras unidades do SUS.
- Identidade institucional (logos e nomes) desacoplada de uma unidade fixa:
  agora configurável por variável de ambiente no frontend, com um padrão
  genérico quando nenhuma é definida.
- `scripts/seed_demo.py`: popula o sistema com dados inteiramente fictícios
  (unidade, estoque, pacientes, transfusões, descartes) para demonstração e
  revisão, sem necessidade de cadastro manual.
- `scripts/criar_env_local.py`, chamado por `setup.bat`: gera o `.env` do
  setup local sem Docker com chaves de segurança já geradas, em vez de
  exigir que a pessoa crie o arquivo à mão.

### Corrigido
- Validado o setup do zero (instalação limpa), tanto via Docker Compose
  quanto via `setup.bat` (sem Docker) — corrigidos os problemas abaixo,
  encontrados nesse processo:
  - `requirements.txt`: `psycopg[binary]==3.2.1` não tem mais wheel
    publicada; atualizado para `3.2.2`.
  - `setup.bat` nunca criava o `.env` antes de rodar as migrations —
    instalação do zero, seguindo exatamente o `LOCAL_SETUP.md`, falhava de
    cara (ver `scripts/criar_env_local.py` acima).
  - `setup.bat` rodava `alembic upgrade head` contra SQLite, mas uma
    migration usa `ALTER COLUMN` fora do modo batch do Alembic (só
    funciona em Postgres) — trocado para o atalho `seed_admin.py
    --create-tables`, já pensado para o setup local sem Docker.
  - `LOCAL_SETUP.md`: corrigido o login de exemplo do Admin Global
    (`admin`, não `admin@hemogest.internal` — o model não usa mais e-mail
    como login) e a referência a um `.env.docker` que não existe no repo.
  - `hemogest-frontend/package.json`: `pdf-lib` é importado em
    `lib/gerarPdfSolicitacao.ts` mas nunca estava declarado como
    dependência — `npm ci` instalava sem erro, mas o build falhava.
  - `tests/test_security.py` não coletava (`generate_opaque_token` não
    existe mais em `app.core.security`).

## [1.0.0] — 2026-10-08

Primeira versão consolidada do sistema, cobrindo o ciclo completo de uma
Agência Transfusional hospitalar, do pedido do setor à transfusão no paciente.

### Adicionado
- Cadastro multitenant de unidades hospitalares, setores, usuários e papéis
  (Administrador Global, Supervisor, Biomédico, Técnico), com sistema de
  permissões configurável por papel.
- Cadastro de pacientes e internações, com dados identificadores
  criptografados em campo (nome, CPF, CNS, prontuário, telefone).
- Cadastro de médicos e validação de CPF.
- Gestão de hemocomponentes (bolsas): entrada com número, tipo sanguíneo e
  validade, fracionamento em bolsas satélites, reserva para paciente e
  controle de status (disponível, reservado, transfundido, devolvido,
  descartado).
- Formulário público de solicitação de transfusão (sem login), em
  `/solicitar/<id da unidade>`, com impressão do PDF oficial da Solicitação
  de Transfusão de Hemocomponentes (STH) e da Folha de Hemotransfusão.
- Painel de solicitações do dia, com atualização automática e alerta sonoro
  para pedidos novos (toque diferenciado para emergência).
- Entrega de hemocomponentes ao setor, com verificação de compatibilidade
  ABO/Rh, prova cruzada, temperatura de transporte e bloqueio automático de
  entregas incompatíveis (liberação com ressalva exige autorização do
  hemoterapeuta).
- Acompanhamento transfusional (sinais vitais pré, 10 minutos, 1 hora, final
  e extras), com registro de intercorrência.
- Fluxo de reações transfusionais em quatro etapas (aberta, investigação,
  NOTIVISA, encerrada).
- Devoluções e descartes de bolsas, com motivos parametrizados.
- Upload e download seguro de anexos (MinIO/S3 ou disco local).
- Dashboard com estoque por hemocomponente, alertas de validade/estoque
  crítico e indicadores dos últimos dias.
- Relatórios (pacientes, internações, hemocomponentes, transfusões, reações,
  devoluções, descartes, auditoria) em JSON ou CSV.
- Trilha de auditoria de ações sensíveis.
- Autenticação por JWT (access e refresh token), com fluxo de troca de senha
  e primeiro acesso.
- Configuração de deploy via Docker Compose, com variante para VPS (Traefik)
  e para Fly.io.

### Corrigido
- Diversas correções de fluxo e validação acumuladas ao longo do
  desenvolvimento (ver histórico de commits anterior a esta versão).
