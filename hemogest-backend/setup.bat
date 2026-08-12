@echo off
REM HemoGest — configuracao inicial do backend (SQLite + disco local).
REM Nao precisa de Docker nem de privilegios de administrador.
REM Requisito: Python 3.11+ instalado e no PATH (instalacao "so para mim",
REM sem admin, funciona normalmente).

cd /d "%~dp0"

echo [1/4] Criando ambiente virtual (.venv)...
python -m venv .venv
if errorlevel 1 (
    echo ERRO: nao foi possivel criar o ambiente virtual. Verifique se "python" esta no PATH.
    pause
    exit /b 1
)

echo [2/4] Instalando dependencias...
REM Usamos "python -m pip" em vez de chamar pip.exe diretamente: alguns
REM antivirus (ex.: Avast) bloqueiam o pip.exe gerado dentro do venv por
REM heuristica de falso-positivo. Rodar pip como modulo do python.exe evita
REM esse bloqueio.
call .venv\Scripts\python -m pip install --upgrade pip
call .venv\Scripts\python -m pip install -r requirements-dev.txt
if errorlevel 1 (
    echo ERRO ao instalar dependencias.
    pause
    exit /b 1
)

echo [3/4] Criando as tabelas do banco (SQLite local: hemogest.db)...
call .venv\Scripts\python -m alembic upgrade head
if errorlevel 1 (
    echo ERRO ao rodar as migrations. Veja a mensagem acima.
    pause
    exit /b 1
)

echo [4/4] Criando o primeiro usuario Administrador Global...
call .venv\Scripts\python scripts\seed_admin.py

echo.
echo Setup concluido!
echo Login:  admin@hemogest.internal
echo Senha:  TrocarSenha123!
echo (troque a senha apos o primeiro login)
echo.
echo Use start.bat para iniciar a API.
pause
