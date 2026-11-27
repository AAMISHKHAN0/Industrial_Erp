@echo off
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ===================================================
echo   Industrial ERP - Desktop Launcher (Digital Erena)
echo ===================================================
echo.
echo Checking environment and launching desktop application...
call npx.cmd electron desktop/main.js
if %ERRORLEVEL% neq 0 (
  echo.
  echo [ERROR] Failed to start Electron desktop shell.
  echo Please check error messages above.
  pause
)
