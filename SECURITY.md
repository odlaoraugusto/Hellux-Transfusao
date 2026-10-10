# Política de Segurança

O Hellux — Módulo de Transfusão processa dados sensíveis de pacientes (nome,
CPF, CNS, prontuário, diagnóstico, histórico transfusional) e está sujeito à
Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018), com tratamento
especial de dados de saúde conforme o art. 11 da LGPD.

## Reportando uma vulnerabilidade

**Não abra uma issue pública** para relatar uma vulnerabilidade de segurança
ou um possível vazamento de dados — isso exporia o problema antes de existir
uma correção.

Em vez disso, reporte de forma privada:

- Pelo [recurso de advisory privado do GitHub](../../security/advisories/new)
  neste repositório (se disponível), **ou**
- Por e-mail diretamente para o mantenedor: **odlaor.augusto@gmail.com**.

Inclua, se possível:

- Descrição do problema e seu impacto potencial (ex.: acesso a dados de outra
  unidade hospitalar, bypass de autenticação, exposição de dado de paciente).
- Passos para reproduzir.
- Versão/commit onde foi observado.

Você receberá uma confirmação de recebimento em até 5 dias úteis. O prazo para
uma primeira avaliação do impacto é de até 10 dias úteis. Correções para
vulnerabilidades críticas (acesso indevido a dados de paciente, quebra de
isolamento multitenant, bypass de autenticação) têm prioridade máxima.

Pedimos que você não divulgue publicamente o problema até que uma correção
esteja disponível e implantada pelas instituições que usam o sistema.

## Escopo do que é considerado vulnerabilidade de segurança

- Quebra do isolamento multitenant (uma unidade hospitalar acessando dados de
  outra).
- Bypass de autenticação/autorização, ou escalonamento de privilégio entre
  perfis (Técnico, Biomédico, Supervisor, Administrador Global).
- Exposição de dados de paciente sem autenticação, incluindo nos campos
  criptografados (`app/db/encrypted_types.py`) ou em logs.
- Falhas que permitam injeção (SQL, XSS, etc.) ou acesso indevido a arquivos
  (anexos no MinIO/disco local).
- Segredos (chaves JWT, chave de criptografia de campo, credenciais de banco)
  expostos em código, repositório ou resposta de API.

Problemas de usabilidade, bugs funcionais sem impacto de segurança e
sugestões de melhoria devem ser reportados como issue normal, seguindo o
[CONTRIBUTING.md](CONTRIBUTING.md).

## Práticas adotadas pelo projeto

- Dados identificadores de paciente (nome, CPF, CNS, prontuário, telefone) são
  cifrados em campo no banco (`FIELD_ENCRYPTION_KEY`, derivação de subchaves
  via HKDF) — nunca armazenados em texto claro.
- Senhas de usuário são armazenadas com hash (`bcrypt`), nunca em texto claro.
- Autenticação por JWT com access e refresh token; `JWT_SECRET_KEY` e
  `FIELD_ENCRYPTION_KEY` são segredos de ambiente, nunca versionados — o
  `.gitignore` do repositório bloqueia `.env` e bancos locais.
- Isolamento multitenant: toda entidade assistencial é vinculada a uma
  `unidade_hospitalar`, e o acesso é filtrado por ela em cada requisição.
- Trilha de auditoria (`audit_log`) para ações sensíveis.

## Responsabilidade de quem implanta o sistema

Cada instituição que coloca o Hellux em produção é responsável, como
controladora dos dados dos seus pacientes, por:

- Gerar `JWT_SECRET_KEY` e `FIELD_ENCRYPTION_KEY` próprios e únicos (nunca
  reaproveitar os valores de exemplo do `.env.example`), usando
  `scripts/generate_encryption_key.py`.
- Restringir o acesso de rede ao banco de dados, MinIO e à API em produção.
- Manter backups e um plano de resposta a incidentes próprio, conforme as
  exigências da LGPD para dados de saúde.
