# scripts/build-and-package.ps1
$ErrorActionPreference = "Stop"

$rootDir = "d:\Textile-Erp-master (1)\Textile-Erp-master (1)\Textile-Erp-master"

Write-Host "=========================================="
Write-Host "1. BUILDING BACKEND..."
Write-Host "=========================================="
Set-Location "$rootDir\backend"
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "Backend build failed with code $LASTEXITCODE" }

Write-Host "=========================================="
Write-Host "2. SYNCING BACKEND TO DESKTOP EMBEDDED..."
Write-Host "=========================================="
Copy-Item -Path "dist\*" -Destination "$rootDir\desktop\embedded\backend\dist" -Recurse -Force
Copy-Item -Path "prisma\schema.prisma" -Destination "$rootDir\desktop\embedded\backend\prisma\schema.prisma" -Force
Write-Host "Backend synced successfully."

Write-Host "=========================================="
Write-Host "3. BUILDING FRONTEND..."
Write-Host "=========================================="
Set-Location "$rootDir\frontend"
if (Test-Path ".next") {
    try {
        Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Warning "Could not completely remove .next, continuing..."
    }
}
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed with code $LASTEXITCODE" }

Write-Host "=========================================="
Write-Host "4. STAGING EMBEDDED FRONTEND..."
Write-Host "=========================================="
Set-Location $rootDir
powershell -ExecutionPolicy Bypass -File "scripts\update-embedded-frontend.ps1"

Write-Host "=========================================="
Write-Host "5. PACKAGING ELECTRON INSTALLER..."
Write-Host "=========================================="
Set-Location "$rootDir\desktop"
& npx.cmd electron-builder
if ($LASTEXITCODE -ne 0) { throw "Electron packaging failed with code $LASTEXITCODE" }

Write-Host "=========================================="
Write-Host "6. DEPLOYING TO USER DESKTOP..."
Write-Host "=========================================="
Set-Location $rootDir
powershell -ExecutionPolicy Bypass -File "scripts\deploy-106.ps1"

Write-Host "=========================================="
Write-Host "BUILD & DEPLOY COMPLETE!"
Write-Host "=========================================="
