<# 
  Copilot Dash - Full Install Script
  Installs all dependencies and builds the project.
#>

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "  Copilot Dash - Install" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

$root = Split-Path -Parent $PSScriptRoot

# 1. Install root dependencies
Write-Host "[1/5] Installing root dependencies..." -ForegroundColor Yellow
Push-Location $root
npm install
Pop-Location

# 2. Install server dependencies
Write-Host "[2/5] Installing server dependencies..." -ForegroundColor Yellow
Push-Location "$root\server"
npm install
Pop-Location

# 3. Install web dependencies
Write-Host "[3/5] Installing web dependencies..." -ForegroundColor Yellow
Push-Location "$root\web"
npm install
Pop-Location

# 4. Build the web UI
Write-Host "[4/5] Building web UI..." -ForegroundColor Yellow
Push-Location "$root\web"
npm run build
Pop-Location

# 5. Build the server
Write-Host "[5/5] Building server..." -ForegroundColor Yellow
Push-Location "$root\server"
npm run build
Pop-Location

Write-Host ""
Write-Host "=================================" -ForegroundColor Green
Write-Host "  Install complete!" -ForegroundColor Green
Write-Host "================================="  -ForegroundColor Green
Write-Host ""
Write-Host "To start the server:" -ForegroundColor White
Write-Host "  cd $root && npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "For development:" -ForegroundColor White
Write-Host "  cd $root && npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "To start with system tray:" -ForegroundColor White
Write-Host "  cd $root && npm run start:tray" -ForegroundColor Gray
Write-Host ""
