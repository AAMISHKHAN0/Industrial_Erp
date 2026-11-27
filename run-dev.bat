@echo off
set "ROOT=%~dp0"

echo ============================================
echo   Textile ERP - Development Launcher
echo ============================================
echo.
echo Starting Backend on port 4000...
start "ERP-Backend" cmd /k "cd /d "%ROOT%backend" && npm run start:dev"

echo Starting Frontend on port 3000...
start "ERP-Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo.
echo ============================================
echo  Frontend : http://localhost:3000
echo  Backend  : http://localhost:4000
echo  Security : Industrial Offline Identity
echo ============================================
pause
