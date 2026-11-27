# prepare-embedded.ps1 - Assembles all self-contained runtime dependencies for Industrial ERP Desktop
$ErrorActionPreference = "Stop"

$desktopDir = "D:\Textile-Erp-master (1)\Textile-Erp-master (1)\Textile-Erp-master\desktop"
$embeddedDir = Join-Path $desktopDir "embedded"

Write-Host "Creating embedded staging directory: $embeddedDir"
if (Test-Path $embeddedDir) {
    Remove-Item $embeddedDir -Recurse -Force
}
New-Item -ItemType Directory -Path $embeddedDir -Force | Out-Null

# 1. Stage Node.js standalone executable
Write-Host "Staging portable Node.js runtime..."
$nodeDir = Join-Path $embeddedDir "node"
New-Item -ItemType Directory -Path $nodeDir -Force | Out-Null
Copy-Item "C:\Program Files\nodejs\node.exe" -Destination (Join-Path $nodeDir "node.exe") -Force

# 2. Stage portable PostgreSQL 16
Write-Host "Staging portable PostgreSQL distribution..."
$pgDestDir = Join-Path $embeddedDir "pgsql"
$pgSourceDir = "C:\Program Files\Erena Garments ERP\pgsql"
New-Item -ItemType Directory -Path $pgDestDir -Force | Out-Null

Copy-Item (Join-Path $pgSourceDir "bin") -Destination (Join-Path $pgDestDir "bin") -Recurse -Force
Copy-Item (Join-Path $pgSourceDir "lib") -Destination (Join-Path $pgDestDir "lib") -Recurse -Force
Copy-Item (Join-Path $pgSourceDir "share") -Destination (Join-Path $pgDestDir "share") -Recurse -Force

# 3. Stage compiled Backend
Write-Host "Staging compiled NestJS backend and Prisma migrations..."
$backendDestDir = Join-Path $embeddedDir "backend"
New-Item -ItemType Directory -Path $backendDestDir -Force | Out-Null

Copy-Item "backend\dist" -Destination (Join-Path $backendDestDir "dist") -Recurse -Force
Copy-Item "backend\prisma" -Destination (Join-Path $backendDestDir "prisma") -Recurse -Force
Copy-Item "backend\run-migrations.js" -Destination (Join-Path $backendDestDir "run-migrations.js") -Force
Copy-Item "backend\package.json" -Destination (Join-Path $backendDestDir "package.json") -Force
Copy-Item "backend\node_modules" -Destination (Join-Path $backendDestDir "node_modules") -Recurse -Force

# 4. Surgical Pruning of unused dev-dependencies, test fixtures, CLI binaries, and source maps
Write-Host "Pruning unnecessary dev-dependencies and build artifacts from embedded backend..."
$pruneTargets = @(
    "backend\node_modules\@types",
    "backend\node_modules\typescript",
    "backend\node_modules\@babel",
    "backend\node_modules\prettier",
    "backend\node_modules\webpack",
    "backend\node_modules\@angular-devkit",
    "backend\node_modules\prisma",
    "backend\node_modules\jest",
    "backend\node_modules\@jest",
    "backend\node_modules\ts-jest",
    "backend\node_modules\ts-node",
    "backend\node_modules\ts-loader",
    "backend\node_modules\eslint",
    "backend\node_modules\@eslint",
    "backend\node_modules\terser",
    "backend\node_modules\terser-webpack-plugin",
    "backend\node_modules\minimizer-webpack-plugin",
    "backend\node_modules\.bin"
)

foreach ($target in $pruneTargets) {
    $fullPath = Join-Path $embeddedDir $target
    if (Test-Path $fullPath) {
        Remove-Item $fullPath -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Remove non-Windows engine binaries in @prisma
$nonWinEngine = Join-Path $embeddedDir "backend\node_modules\@prisma\engines\schema-engine"
if (Test-Path $nonWinEngine) {
    Remove-Item $nonWinEngine -Force -ErrorAction SilentlyContinue
}

# Remove source maps across backend node_modules
Write-Host "Stripping .map source maps..."
Get-ChildItem -Path (Join-Path $embeddedDir "backend\node_modules") -Recurse -Filter "*.map" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

# 5. Stage standalone Next.js Frontend
Write-Host "Staging standalone Next.js frontend..."
$frontendDestDir = Join-Path $embeddedDir "frontend"
New-Item -ItemType Directory -Path $frontendDestDir -Force | Out-Null

Copy-Item "frontend\.next\standalone\*" -Destination $frontendDestDir -Recurse -Force
$staticTarget = Join-Path $frontendDestDir ".next\static"
New-Item -ItemType Directory -Path $staticTarget -Force | Out-Null
Copy-Item "frontend\.next\static\*" -Destination $staticTarget -Recurse -Force

$publicTarget = Join-Path $frontendDestDir "public"
New-Item -ItemType Directory -Path $publicTarget -Force | Out-Null
Copy-Item "frontend\public\*" -Destination $publicTarget -Recurse -Force

# Strip source maps from frontend
Get-ChildItem -Path (Join-Path $frontendDestDir ".next") -Recurse -Filter "*.map" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "Embedded bundle successfully prepared and optimized!"
