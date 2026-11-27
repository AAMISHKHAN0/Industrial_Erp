param(
    [int]$ProcessId
)

$source = @"
using System;
using System.Runtime.InteropServices;
public class WinHungCheck {
    [DllImport("user32.dll")]
    public static extern bool IsHungAppWindow(IntPtr hWnd);
}
"@

if (-not ([System.Management.Automation.PSTypeName]'WinHungCheck').Type) {
    Add-Type -TypeDefinition $source -ErrorAction SilentlyContinue
}

$proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
if (-not $proc) {
    Write-Output "NO_PROCESS"
    exit 0
}

if ($proc.MainWindowHandle -eq [IntPtr]::Zero) {
    Write-Output "NO_WINDOW"
    exit 0
}

$isHung = [WinHungCheck]::IsHungAppWindow($proc.MainWindowHandle)
$title = $proc.MainWindowTitle
Write-Output "$title|$isHung"
