@echo off
echo ============================================
echo   SGAL - Frontend  ^|  http://localhost:5173
echo ============================================
set PATH=%PATH%;C:\Program Files\nodejs
cd /d "%~dp0frontend"
npm run dev
pause
