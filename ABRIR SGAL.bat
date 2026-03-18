@echo off
title SGAL - Sistema de Gestao de Alvaras e Licencas

echo.
echo  =====================================================
echo    SGAL - Sistema de Gestao de Alvaras e Licencas
echo  =====================================================
echo.

:: Mata processos antigos nas portas do sistema
echo  Encerrando processos anteriores...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " 2^>nul') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul

echo  Iniciando Backend...
start "SGAL - Backend" cmd /k "cd /d "%~dp0backend" && call .venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000"

echo  Aguardando backend...
timeout /t 5 /nobreak >nul

echo  Iniciando Frontend...
start "SGAL - Frontend" cmd /k "set PATH=%PATH%;C:\Program Files\nodejs && cd /d "%~dp0frontend" && npm run dev"

echo  Aguardando frontend...
timeout /t 6 /nobreak >nul

echo  Abrindo navegador...
start "" "http://localhost:5173"

echo.
echo  Sistema iniciado com sucesso!
echo  Feche as janelas Backend e Frontend para encerrar.
echo.
timeout /t 2 /nobreak >nul
exit
