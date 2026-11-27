@echo off
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo Starting PostgreSQL and Redis via Docker Compose...
docker compose up -d

if %ERRORLEVEL% neq 0 (
    echo.
    echo Docker failed to start containers. Please ensure Docker Desktop is running and try again.
    pause
    exit /b 1
)

echo.
echo Database containers are running!
echo Applying Prisma migrations...
cd /d "%ROOT%backend"
call npx prisma db push

echo.
echo Database setup complete!
pause
