@echo off
set "ROOT=%~dp0"
cd /d "%ROOT%backend"
start "ERP-Backend" cmd /k "node dist/src/main.js"
cd /d "%ROOT%frontend"
start "ERP-Frontend" cmd /k "npm run start -- --port 3000"
echo Started both servers in separate windows.
pause
