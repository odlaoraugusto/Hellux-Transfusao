# Contribuindo com o Hellux — Módulo de Transfusão

Obrigado por considerar contribuir. O Hellux é um sistema de gestão de Agências
Transfusionais pensado para ser usado por qualquer unidade hospitalar do SUS, não
só pela instituição onde nasceu — então contribuições de profissionais de saúde,
gestores de TI e desenvolvedores de outras unidades são bem-vindas.

Você não precisa ser programador para contribuir: relatar um problema de uso real
no dia a dia de uma agência transfusional, ou sugerir um ajuste de fluxo clínico,
já é uma contribuição valiosa.

## Reportando um problema (issue)

Antes de abrir uma issue nova, procure nas [issues existentes](../../issues) para
ver se o problema já foi relatado.

Ao abrir uma issue, inclua:

- **O que você esperava que acontecesse** e **o que aconteceu de fato**.
- **Passos para reproduzir** (telas visitadas, dados preenchidos, perfil de
  usuário usado — nunca inclua dados reais de paciente, veja a seção de
  privacidade abaixo).
- Prints de tela, se ajudarem a entender o problema.
- Se for um problema de segurança ou vazamento de dados, **não abra uma issue
  pública** — siga o processo descrito em [SECURITY.md](SECURITY.md).

Para sugestões de melhoria (uma funcionalidade nova, um ajuste de fluxo
assistencial), descreva o problema real que a mudança resolveria antes de
descrever a solução — isso ajuda a avaliar o pedido no contexto de outras
unidades, que podem ter rotinas diferentes.

## Nunca inclua dados reais de paciente

Este é um sistema de saúde sujeito à LGPD. Em qualquer issue, print de tela,
log colado, exemplo de banco de dados ou pull request:

- Nunca cole nomes, CPF, CNS, prontuário, endereço ou qualquer dado real de
  paciente, mesmo em ambiente de teste.
- Use os dados fictícios gerados pelo script `scripts/seed_demo.py` (backend)
  para reproduzir problemas e demonstrar funcionalidades.
- Se um print de tela de produção for realmente necessário, borre/oculte todo
  campo que identifique uma pessoa antes de publicar.

## Enviando uma pull request

1. Abra uma issue descrevendo o problema ou a melhoria antes de começar a
   codificar, especialmente para mudanças grandes — isso evita retrabalho se o
   rumo escolhido não for o ideal.
2. Crie um branch a partir de `master` com um nome descritivo.
3. Siga os padrões já usados no código:
   - Backend (`hemogest-backend/`): Python 3.12, FastAPI, SQLAlchemy 2,
     Pydantic 2. Toda migração de schema passa por Alembic
     (`alembic revision --autogenerate`), nunca edite tabelas na mão.
   - Frontend (`hemogest-frontend/`): React 18, TypeScript, Tailwind CSS.
   - Nomes de domínio (models, campos, rotas) em português, consistente com o
     resto do projeto.
   - Dados sensíveis de paciente sempre passam pela camada de criptografia de
     campo já existente (`app/db/encrypted_types.py`) — nunca um campo novo de
     identificação de paciente sem isso.
4. Adicione ou ajuste testes (`hemogest-backend/tests/`) cobrindo a mudança.
   Rode a suíte local antes de abrir o PR:
   ```
   cd hemogest-backend && pytest
   ```
5. Atualize o `CHANGELOG.md` (seção "Não lançado") descrevendo a mudança.
6. Abra o pull request contra `master`, descrevendo o que mudou e por quê, e
   referenciando a issue relacionada.

## Padrão de commits

Mensagens de commit curtas, no imperativo e em português, descrevendo o que a
mudança faz (ex.: "Corrige validação de CPF no formulário público"), seguindo
o padrão já usado no histórico do repositório.

## Dúvidas

Se não tiver certeza de como propor algo, abra uma issue com a dúvida — é
preferível perguntar antes do que descobrir depois de um PR grande que o rumo
não era o esperado.
