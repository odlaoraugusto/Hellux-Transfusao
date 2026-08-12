# 05 — Architecture.md — HemoGest

Status: 📌 Congelado após esta versão · Última atualização: 23/07/2026

## 1. Visão Geral

HemoGest é um SaaS multitenant para gestão de Agências Transfusionais.
Arquitetura em três camadas: **API (FastAPI)**, **Banco de Dados
(PostgreSQL)** e **Frontend (React + TypeScript)**, com armazenamento de
objetos (**MinIO**) para anexos, tudo orquestrado via **Docker**.

## 2. Stack Tecnológica (congelada)

| Camada | Tecnologia |
|---|---|
| Backend | FastAPI (Python 3.12) |
| ORM | SQLAlchemy 2.x |
| Migrations | Alembic |
| Banco de Dados | PostgreSQL 16 |
| Autenticação | JWT (access + refresh token) |
| Armazenamento de anexos | MinIO (S3-compatible) |
| Frontend | React + TypeScript |
| Orquestração | Docker / Docker Compose |

## 3. Multitenancy

Isolamento por `unidade_hospitalar_id` presente em toda entidade
assistencial (mixin `TenantMixin`). O contexto de tenant é resolvido a
partir do usuário autenticado — nunca confiar apenas em header de request.
Um Administrador Global pode operar sobre múltiplas unidades; os demais
perfis (Supervisor, Biomédico, Técnico) ficam restritos à sua unidade.

## 4. Camadas do Backend

```
Request → Router (api/v1) → Dependency (auth + tenant) → Service → Model (SQLAlchemy) → PostgreSQL
                                                    ↘ Service → MinIO (anexos)
```

- `app/api` — rotas HTTP, validação de entrada via Pydantic (`schemas/`).
- `app/core` — configuração, segurança (JWT), logging, contexto de tenant.
- `app/services` — regras de negócio, orquestra models + storage.
- `app/models` — entidades SQLAlchemy, seguindo as convenções do DER.
- `app/db` — engine, sessão, mixins (UUID, soft delete, auditoria, UTC).

## 5. Convenções de Dados (herdadas do DER)

- PK em UUID (`UUIDPrimaryKeyMixin`).
- Soft delete via `deleted_at` (`SoftDeleteMixin`) — sem exclusão física.
- Timestamps sempre em UTC (`TimestampMixin`).
- Auditoria de autor (`created_by` / `updated_by`) + tabela `audit_log`
  central para login, logout, criação, edição, exclusão lógica, upload e
  download.

## 6. Segurança

- Autenticação via JWT (access token curto + refresh token).
- RBAC com 4 perfis: Administrador Global, Supervisor, Biomédico, Técnico.
- Senhas com hashing bcrypt (`passlib`).
- Toda ação sensível gera registro de auditoria.

## 7. Anexos (MinIO)

Bucket único (`hemogest-anexos`) com objetos nomeados por
`unidade/{modulo}/{entidade_id}/{arquivo}`. URLs de acesso são sempre
pré-assinadas com expiração curta — nunca públicas.

## 8. Frontend — Identidade Visual Oficial

Fonte única de verdade: **vetores SVG**, não mais o print do moodboard.

| Arquivo | Uso |
|---|---|
| `assets/brand/hemogest-simbolo.svg` | Símbolo isolado (favicon, ícone de app, Sidebar) |
| `assets/brand/hemogest-logo-horizontal.svg` | Logotipo completo com slogan (telas de login, e-mails) |
| `assets/brand/hemogest-variacoes.svg` | 4 variações de cor: colorida, negativa (fundo escuro), monocromática, monocromática negativa |
| `assets/icons/favicon32.png` | Favicon 32×32 |
| `assets/icons/ios180.png` | Apple touch icon (iOS) |
| `assets/icons/android192.png` | Ícone PWA/Android 192×192 |
| `assets/icons/windows256.png` | Tile do Windows 256×256 |
| `assets/icons/icone512.png` | Ícone PWA de alta resolução 512×512 |
| `assets/hemogest-moodboard-original.jpeg` | Referência histórica (paleta/tipografia/mockups) — mantido só como contexto, não usar como asset de produção |

**Paleta oficial**
| Cor | Hex | Uso |
|---|---|---|
| Vermelho Hemo | `#C62828` | Cor primária, ações e destaques |
| Vermelho Escuro | `#8E1B1B` | Hover / estados ativos |
| Vermelho Claro | `#E57373` | Alertas leves / incompatibilidades |
| Fundo | `#F7F8FA` | Background geral |
| Branco | `#FFFFFF` | Cards / superfícies |
| Cinza Texto | `#616161` | Texto secundário |
| Sucesso | `#2E7D32` | Confirmações |
| Atenção | `#F9A825` | Vencimentos, pendências |
| Erro | `#D32F2F` | Erros críticos |

**Tipografia:** Poppins. **Estilo de ícones:** outline, minimalista,
consistente. **Conceito da marca:** bolsa de sangue estilizada formando um
escudo — proteção, segurança transfusional e cuidado com o paciente. As 4
variações oficiais (`hemogest-variacoes.svg`) cobrem: uso padrão (colorida,
fundo claro), fundo vermelho escuro sólido (negativa), monocromática
(documentos em preto e branco) e monocromática negativa (fundo preto).

Esses tokens devem alimentar diretamente o design system do frontend
(Fase 13) — sem redefinição de cores fora deste documento.

## 9. Deploy (visão preliminar — detalhado na Fase 16)

Docker Compose para desenvolvimento; produção com HTTPS, domínio próprio,
backup automatizado do PostgreSQL e monitoramento/logs centralizados.

## 10. O que fica congelado a partir deste documento

Arquitetura SaaS multitenant, stack tecnológica, identidade visual,
estrutura de módulos, modelo de dados, convenções de nomenclatura,
estratégias de auditoria/anexos/autenticação. Mudanças exigem revisão
formal (novo ADR em `07 - ADRs/`).
