@echo off
REM HemoGest — abre a API e a interface, cada uma na sua propria janela.
REM Rode primeiro (uma unica vez): hemogest-backend\setup.bat e
REM hemogest-frontend\setup.bat. Depois é so usar este arquivo no dia a dia.

cd /d "%~dp0"
start "HemoGest - API" cmd /k "cd /d %~dp0hemogest-backend && start.bat"
timeout /t 3 /nobreak >nul
start "HemoGest - Interface" cmd /k "cd /d %~dp0hemogest-frontend && start.bat"

echo.
echo Duas janelas foram abertas: API (porta 8010) e Interface (porta 5180).
echo Acesse http://localhost:5180 no navegador.
echo Feche as duas janelas para encerrar o sistema.
