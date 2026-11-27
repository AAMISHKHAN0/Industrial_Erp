@echo off
title Textuile ERP Launcher
setlocal

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

echo ============================================
echo   Textuile ERP - Production Launcher
echo ============================================
echo.

echo [1/2] Building backend...
cd /d "%BACKEND%"
call npm run build
if %errorlevel% neq 0 (
  echo BACKEND BUILD FAILED - aborting.
  pause
  exit /b 1
)

echo [2/2] Building frontend...
cd /d "%FRONTEND%"
call npm run build
if %errorlevel% neq 0 (
  echo FRONTEND BUILD FAILED - aborting.
  pause
  exit /b 1
)

echo.
echo Starting services in separate windows (keep them open)...
echo   Backend  : http://localhost:4000
echo   Frontend : http://localhost:3000
echo.

start "Textuile ERP - Backend" cmd /k "cd /d "%BACKEND%" && npm run start:prod"
start "Textuile ERP - Frontend" cmd /k "cd /d "%FRONTEND%" && npm start"

echo Both servers launched. Close their windows to stop them.
echo You can close this window.
timeout /t 3 >nul
