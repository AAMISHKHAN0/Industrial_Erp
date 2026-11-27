@echo off
REM ===== Textile ERP - One-shot Production Start =====
REM Builds backend + frontend, then starts both in production mode (fast, stable)
REM Not RAM-efficient on purpose — just works.

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo [1/4] Building backend...
cd /d "%ROOT%backend"
call npm run build
if %ERRORLEVEL% neq 0 ( echo Backend build FAILED & pause & exit /b 1 )

echo [2/4] Building frontend...
cd /d "%ROOT%frontend"
call npm run build
if %ERRORLEVEL% neq 0 ( echo Frontend build FAILED & pause & exit /b 1 )

echo [3/4] Starting backend (port 4000)...
cd /d "%ROOT%backend"
start "ERP-Backend" cmd /k "node dist/src/main.js"

echo [4/4] Starting frontend (port 3000)...
cd /d "%ROOT%frontend"
start "ERP-Frontend" cmd /k "npm run start -- --port 3000"

echo.
echo ============================================
echo  ALL RUNNING
echo  Frontend: http://localhost:3000
echo  Backend : http://localhost:4000
echo  Setup   : http://localhost:3000/setup (first run)
echo  Sign In : http://localhost:3000/login
echo ============================================
echo.
pause
