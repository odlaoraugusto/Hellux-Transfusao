@echo off
REM HemoGest — configuracao inicial do frontend.
REM Requisito: Node.js 18+ instalado e no PATH.

cd /d "%~dp0"
echo Instalando dependencias do frontend (pode levar alguns minutos)...
call npm install
if errorlevel 1 (
    echo ERRO ao instalar dependencias. Verifique se "node"/"npm" estao no PATH.
    pause
    exit /b 1
)
echo.
echo Setup concluido! Use start.bat para iniciar a interface.
pause
