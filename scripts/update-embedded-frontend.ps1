# update-embedded-frontend.ps1
$ErrorActionPreference = "Stop"

$baseDir = "D:\Textile-Erp-master (1)\Textile-Erp-master (1)\Textile-Erp-master"
$frontendDir = Join-Path $baseDir "frontend"
$standaloneDir = Join-Path $frontendDir ".next\standalone"
$desktopEmbeddedFrontend = Join-Path $baseDir "desktop\embedded\frontend"

Write-Host "1. Staging static assets into standalone..."
$standaloneStatic = Join-Path $standaloneDir ".next\static"
if (!(Test-Path $standaloneStatic)) {
    New-Item -ItemType Directory -Path $standaloneStatic -Force | Out-Null
}
Copy-Item (Join-Path $frontendDir ".next\static\*") -Destination $standaloneStatic -Recurse -Force

$standalonePublic = Join-Path $standaloneDir "public"
if (!(Test-Path $standalonePublic)) {
    New-Item -ItemType Directory -Path $standalonePublic -Force | Out-Null
}
Copy-Item (Join-Path $frontendDir "public\*") -Destination $standalonePublic -Recurse -Force

Write-Host "2. Updating desktop/embedded/frontend..."
if (!(Test-Path $desktopEmbeddedFrontend)) {
    New-Item -ItemType Directory -Path $desktopEmbeddedFrontend -Force | Out-Null
}
$destNext = Join-Path $desktopEmbeddedFrontend ".next"
if (Test-Path $destNext) {
    Remove-Item $destNext -Recurse -Force
}

Copy-Item (Join-Path $standaloneDir "*") -Destination $desktopEmbeddedFrontend -Recurse -Force

$destStatic = Join-Path $desktopEmbeddedFrontend ".next\static"
if (Test-Path $destStatic) {
    Remove-Item $destStatic -Recurse -Force
}
New-Item -ItemType Directory -Path $destStatic -Force | Out-Null
Copy-Item (Join-Path $frontendDir ".next\static\*") -Destination $destStatic -Recurse -Force

$destPublic = Join-Path $desktopEmbeddedFrontend "public"
if (Test-Path $destPublic) {
    Remove-Item $destPublic -Recurse -Force
}
New-Item -ItemType Directory -Path $destPublic -Force | Out-Null
Copy-Item (Join-Path $frontendDir "public\*") -Destination $destPublic -Recurse -Force

Write-Host "3. Stripping .map files from desktop/embedded/frontend/.next..."
Get-ChildItem -Path (Join-Path $desktopEmbeddedFrontend ".next") -Recurse -Filter "*.map" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "Staging complete! Verifying contents of desktop/embedded/frontend:"
Get-ChildItem $desktopEmbeddedFrontend
Write-Host "Static directory contents:"
Get-ChildItem $destStatic
