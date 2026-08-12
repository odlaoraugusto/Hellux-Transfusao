@echo off
REM HemoGest — inicia a interface (http://localhost:5173). Requer a API
REM rodando (hemogest-backend\start.bat) e setup.bat ja executado aqui.

cd /d "%~dp0"
call npm run dev
pause
