# Creates "AGENT 2.0.lnk" on the current user's Desktop.
# Run from the unzipped agent-2.0-desk folder:
#   powershell -ExecutionPolicy Bypass -File .\pin-to-desktop.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bat = Join-Path $root "start-desk.bat"
$ico = Join-Path $root "public\agent.ico"
if (-not (Test-Path $bat)) { throw "start-desk.bat not found in $root" }

$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "AGENT 2.0.lnk"

$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($lnkPath)
$lnk.TargetPath = $bat
$lnk.WorkingDirectory = $root
$lnk.WindowStyle = 1
$lnk.Description = "AGENT 2.0 paper hunter desk"
if (Test-Path $ico) { $lnk.IconLocation = $ico }
$lnk.Save()

Write-Host "Desktop icon written:"
Write-Host "  $lnkPath"
Write-Host "Double-click AGENT 2.0 on the Desktop."
