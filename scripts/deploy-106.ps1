$src = 'desktop\dist\Industrial ERP Setup 1.0.6.exe'
$dst = 'C:\Users\Aamishkhan\Desktop\Industrial ERP Setup 1.0.6.exe'

Copy-Item -Path $src -Destination $dst -Force

$hash = (Get-FileHash -Path $dst -Algorithm SHA256).Hash
$item = Get-Item $dst
$mb = [math]::Round($item.Length / 1MB, 2)

Write-Host "Installer: $dst"
Write-Host "Size: $($item.Length) bytes ($mb MB)"
Write-Host "SHA256: $hash"

# Remove 1.0.5 setup from desktop
if (Test-Path 'C:\Users\Aamishkhan\Desktop\Industrial ERP Setup 1.0.5.exe') {
    Remove-Item 'C:\Users\Aamishkhan\Desktop\Industrial ERP Setup 1.0.5.exe' -Force
    Write-Host "Removed old 1.0.5 Setup from Desktop."
}

# Clean any lingering Fresh Test shortcuts from Desktop & Public Desktop
Get-ChildItem -Path ([Environment]::GetFolderPath('Desktop')), 'C:\Users\Public\Desktop' -Filter '*Fresh Test*' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "`n--- Current Desktop Items matching Industrial ---"
Get-ChildItem -Path ([Environment]::GetFolderPath('Desktop')), 'C:\Users\Public\Desktop' -Filter '*Industrial*' | Select-Object FullName
