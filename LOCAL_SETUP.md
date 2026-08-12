# HemoGest — rodando localmente sem Docker (máquina sem privilégios de admin)

Este guia substitui o Docker Compose por duas coisas mais simples que você
já pode baixar: **Python** e **Node.js**. Sem Postgres, sem MinIO, sem
`cmd`/PowerShell como administrador — só arquivos `.bat` normais.

O que muda em relação ao setup "oficial" (`README.md`/`RUNBOOK.md`):

- **Banco de dados:** SQLite em vez de PostgreSQL — um arquivo
  `hemogest.db` dentro de `hemogest-backend/`, criado automaticamente.
- **Anexos:** salvos em disco (`hemogest-backend/storage/`) em vez de
  MinIO, com download protegido por um link assinado e temporário
  (equivalente ao presigned URL do MinIO).
- Tudo o mais (regras de negócio, API, telas) é o mesmo código.

## 1. Instalar Python e Node.js (sem admin)

**Python 3.11 ou superior:**
1. Baixe o instalador em https://www.python.org/downloads/windows/.
2. Ao abrir o instalador, marque **"Add python.exe to PATH"** e escolha
   **"Install Now"** — o instalador oficial do python.org não exige
   privilégios de administrador quando instalado só para o seu usuário
   (ele detecta isso automaticamente se você não tiver permissão de admin).

**Node.js 18 ou superior (LTS):**
1. Baixe em https://nodejs.org/ (versão LTS).
2. Se o instalador `.msi` pedir elevação e não for possível, use a versão
   "Windows Binary (.zip)" em vez do instalador: baixe o `.zip`, extraia em
   uma pasta sua (ex.: `C:\Users\<voce>\node`) e adicione essa pasta à
   variável `PATH` do seu usuário (Painel de Controle → Contas de Usuário
   → "Alterar minhas variáveis de ambiente" — isso também não exige admin).

Para confirmar que deu certo, abra um `cmd` comum (não precisa ser admin) e
rode:
```
python --version
node --version
npm --version
```

## 2. Configurar o projeto (uma vez só)

Dentro da pasta do projeto:

1. Dê dois cliques em `hemogest-backend\setup.bat`.
   Isso cria o ambiente Python (`.venv`), instala as dependências, cria o
   banco SQLite (`hemogest.db`) e já deixa um usuário Administrador Global
   pronto:
   - login: `admin@hemogest.internal`
   - senha: `TrocarSenha123!`
2. Dê dois cliques em `hemogest-frontend\setup.bat`.
   Isso instala as dependências da interface (`npm install`).

Se algum passo falhar, a janela mostra a mensagem de erro e não fecha
sozinha — copie a mensagem se precisar de ajuda.

## 3. Rodar o sistema no dia a dia

Dê dois cliques em `iniciar-tudo.bat` (na raiz do projeto). Ele abre duas
janelas — API e interface — e você acessa tudo em:

http://localhost:5180

Para encerrar, feche as duas janelas.

O HemoGest usa portas não-padrão de propósito (API na 8010, interface na
5180) para não colidir com outros projetos rodando na mesma máquina — como
o MicroGest, que costuma ocupar as portas padrão 8000/5173. Se mesmo assim
uma delas já estiver em uso, veja a seção "Rodando junto com outro
projeto" mais abaixo.

## 4. Trocar a senha do admin

Assim que logar, troque a senha padrão (`TrocarSenha123!`) pela tela de
configurações do usuário, ou via `POST /api/v1/auth/change-password`
(documentação interativa em http://localhost:8010/docs).

## 5. Voltar para Docker/Postgres/MinIO no futuro

Nada foi removido — é só trocar de arquivo de configuração:

```
copy hemogest-backend\.env.docker hemogest-backend\.env
docker compose -f hemogest-backend\docker-compose.yml up --build
```

O backend detecta automaticamente Postgres vs. SQLite pela
`DATABASE_URL`, e MinIO vs. disco local pela variável `STORAGE_BACKEND` —
nenhuma mudança de código é necessária para migrar de um ambiente para o
outro.

## Rodando junto com outro projeto (ex.: MicroGest) na mesma máquina

Não precisa rodar um de cada vez — dois servidores locais convivem numa
mesma máquina desde que usem portas diferentes, e é isso que já está
configurado: HemoGest usa 8010 (API) e 5180 (interface), em vez das portas
mais comuns 8000/5173.

Se ainda assim alguma porta colidir (por exemplo, se o outro projeto
também tiver sido movido para 8010), troque em três lugares:

1. `hemogest-backend\start.bat` — no `--port 8010`.
2. `hemogest-backend\.env` — em `CORS_ORIGINS`, para casar com a nova porta
   da interface.
3. `hemogest-frontend\vite.config.ts` — em `server.port` (interface) e
   `server.proxy["/api"].target` (porta da API).

Cada projeto também deve ter seu próprio banco/armazenamento — como cada
um aqui usa um arquivo SQLite (`hemogest.db`) e uma pasta (`storage/`)
dentro da própria pasta do projeto, não há risco de um projeto sobrescrever
dados do outro.

## O Avast (ou outro antivírus) bloqueou o pip/python

Alguns antivírus marcam como suspeito o `pip.exe`/`uvicorn.exe` que o
`venv` gera automaticamente (são pequenos executáveis "wrapper", um
padrão comum de falso-positivo). Os scripts já foram ajustados para
chamar `python -m pip` e `python -m uvicorn` em vez desses executáveis
gerados, o que resolve a maioria dos bloqueios — se você já tinha rodado
`setup.bat` antes dessa mudança, rode de novo.

Se o Avast ainda assim bloquear (dessa vez o `python.exe` em si, não mais
o `pip.exe`):
1. Normalmente aparece um pop-up do Avast no momento do bloqueio, com a
   opção "Permitir mesmo assim" / "Ignorar" — isso não pede senha de
   administrador do Windows.
2. Se não aparecer pop-up, abra o Avast (ícone na bandeja) →
   **Menu → Configurações → Proteção → Core Shields → Exceções** e
   adicione a pasta do projeto (`hemogest-backend`) como exceção. Essa
   tela normalmente é acessível sem privilégios de administrador do
   Windows, a não ser que o TI da empresa tenha bloqueado as
   configurações do próprio Avast — nesse caso, peça para o suporte de TI
   liberar a pasta.

## O projeto está dentro do OneDrive — cuidado com reinícios/travamentos

Como a pasta do projeto é sincronizada pelo OneDrive, o próprio OneDrive
fica "tocando" arquivos em segundo plano (mesmo sem você mexer em nada).
Isso já causou um problema real: o `uvicorn --reload` ficava reiniciando a
API sozinho porque monitorava a pasta inteira, inclusive `.venv` — já
corrigido em `start.bat` (agora só monitora a pasta `app`).

Se notar outros comportamentos estranhos (travamentos ao salvar dados,
erros de banco), vale excluir da sincronização do OneDrive as pastas que
mudam o tempo todo e não precisam ir para a nuvem:
`hemogest-backend\.venv`, `hemogest-backend\hemogest.db` e
`hemogest-backend\storage`. Isso é feito direto no OneDrive (clique
direito no ícone da bandeja → Configurações → Sincronizar e fazer backup
→ Gerenciar backup, ou clique direito na pasta → "Liberar espaço"/escolher
pastas), sem precisar de admin do Windows.

## Limitações desta configuração local

- SQLite serve bem para uso por poucos usuários simultâneos numa mesma
  máquina; para múltiplos usuários/rede, prefira o Postgres (via Docker,
  quando disponível, ou um Postgres real).
- Os anexos ficam na pasta `hemogest-backend/storage/` — inclua-a nos seus
  backups se for usar isso como ambiente principal.
