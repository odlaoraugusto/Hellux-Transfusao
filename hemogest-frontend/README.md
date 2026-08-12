# HemoGest — Frontend

React + TypeScript + Tailwind, consumindo a API do `hemogest-backend`.

## Status (Sprint 13.1 + parte da 13.2/13.3)

Entregue:
- Layout (Sidebar espelhando o menu do mockup oficial, Navbar, tema
  claro/escuro)
- Cliente HTTP central (`src/lib/api.ts`) com refresh automático de JWT e
  suporte ao header `X-Unidade-Id` (Admin Global)
- Autenticação (`useAuth`) — login, logout, rota protegida
- Componentes base: `Card`, `Badge` (cores por status), `Button`
- Duas telas completas: **Login** e **Dashboard** (consome os 4 endpoints
  de `/dashboard/*` já prontos no backend, com gráfico via `recharts`)
- **Pacientes**: pesquisa com debounce + tabela
- Todas as demais telas do menu têm rota registrada, mas usam
  `EmBrevePage` (placeholder) — os endpoints já existem no backend, falta
  só a UI. Ver `06-Roadmap.md` do backend para o que falta em cada uma.

## Rodando (requer Node — não instalado/validado neste ambiente sem rede)

```bash
npm install
npm run dev
```

O Vite já está configurado para fazer proxy de `/api` para
`http://localhost:8000` (o backend rodando via `docker compose up`).

## Identidade visual

Tokens de cor/tipografia em `tailwind.config.js`, espelhando
`05-Architecture.md` do backend. Não redefinir cores fora desse arquivo.

Assets oficiais (vetores, não mais o print do moodboard):
- `public/brand/hemogest-simbolo.svg` — símbolo isolado (usado na Sidebar)
- `public/brand/hemogest-logo-horizontal.svg` — logotipo completo com
  slogan (usado na tela de Login)
- `public/brand/hemogest-variacoes.svg` — variações de cor (colorida,
  negativa, monocromática, monocromática negativa), referência para
  contextos que ainda não têm tela própria (ex: e-mails, PDFs)
- `public/icons/*.png` — ícones de aplicativo/favicon nos tamanhos oficiais
  (favicon32, ios180, android192, windows256, icone512), já referenciados
  em `index.html` (favicon, apple-touch-icon), `manifest.json` (PWA) e
  `browserconfig.xml` (tiles do Windows)

## Próximos passos sugeridos

Priorizar, nesta ordem, as telas que fecham o fluxo assistencial completo:
1. Hemocomponentes (cadastro de bolsa + fracionamento + reserva)
2. Acompanhamento Transfusional (a tela mais complexa: sinais vitais em
   tempo real, timeline de momentos PRE/10min/1h/Final)
3. Reações Transfusionais (fluxo de 4 etapas)
4. Devoluções/Descartes + upload de anexo
5. Parametrizações, Usuários, Unidade Hospitalar (telas de configuração,
   mais simples — CRUD direto sobre os endpoints já prontos)
