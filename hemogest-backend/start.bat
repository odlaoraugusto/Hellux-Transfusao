@echo off
REM HemoGest — inicia a API (http://localhost:8010/docs). Rode setup.bat
REM antes, uma unica vez.
REM Porta 8010 (nao-padrao) para nao colidir com outros projetos rodando
REM na mesma maquina (ex.: MicroGest, que costuma usar 8000).

cd /d "%~dp0"
REM --reload-dir app: limita o "auto-reload" a pasta do codigo. Sem isso, o
REM uvicorn monitora a pasta inteira do projeto, inclusive .venv e storage —
REM e como o projeto fica dentro do OneDrive, a sincronizacao fica tocando
REM arquivos o tempo todo (mesmo dentro do .venv), disparando reload em
REM loop e derrubando a API no meio das requisicoes (ex.: login falhando
REM sem motivo aparente).
call .venv\Scripts\python -m uvicorn app.main:app --reload --reload-dir app --host 127.0.0.1 --port 8010
pause
