<#
  Copilot Dash - Start Script
  Starts the backend server (which serves the built frontend).
#>

param(
  [switch]$Tray,
  [switch]$Dev
)

$root = Split-Path -Parent $PSScriptRoot

if ($Dev) {
  Write-Host "Starting in development mode..." -ForegroundColor Yellow
  Push-Location $root
  npm run dev
  Pop-Location
}
elseif ($Tray) {
  Write-Host "Starting with system tray icon..." -ForegroundColor Yellow
  Push-Location $root
  npm run start:tray
  Pop-Location
}
else {
  Write-Host "Starting Copilot Dash server..." -ForegroundColor Yellow
  Push-Location $root
  npm start
  Pop-Location
}
