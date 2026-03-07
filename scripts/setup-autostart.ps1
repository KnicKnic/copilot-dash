<#
  Copilot Dash - Setup Auto-Start on Windows Login
  
  Creates a Windows Task Scheduler task that runs the server on user login.
  Also creates a VBS wrapper for hidden window execution.
#>

param(
  [switch]$Remove,
  [string]$TaskName = "CopilotDash"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $root "server"

if ($Remove) {
  Write-Host "Removing auto-start task '$TaskName'..." -ForegroundColor Yellow
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "✓ Task removed." -ForegroundColor Green
  exit 0
}

# ── Install dependencies & build ──
Write-Host "[1/4] Installing root dependencies..." -ForegroundColor Yellow
Push-Location $root
npm install
Pop-Location

Write-Host "[2/4] Installing server dependencies..." -ForegroundColor Yellow
Push-Location $serverDir
npm install
Pop-Location

$webDir = Join-Path $root "web"
Write-Host "[3/4] Installing & building web UI..." -ForegroundColor Yellow
Push-Location $webDir
npm install
npm run build
Pop-Location

Write-Host "[4/4] Generating extension icons..." -ForegroundColor Yellow
$extDir = Join-Path $root "extension"
if (Test-Path (Join-Path $extDir "generate-icons.js")) {
  Push-Location $extDir
  node generate-icons.js
  Pop-Location
}

# Create a VBS wrapper to run node hidden (no console window)
$vbsPath = Join-Path $root "scripts\start-hidden.vbs"
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$serverDir"
WshShell.Run "cmd /c npx tsx src/tray.ts > ""%USERPROFILE%\.copilot-dash\server.log"" 2>&1", 0, False
"@
Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII

Write-Host "Setting up auto-start task '$TaskName'..." -ForegroundColor Yellow

# Create the scheduled task
$action = New-ScheduledTaskAction `
  -Execute "wscript.exe" `
  -Argument "`"$vbsPath`"" `
  -WorkingDirectory $serverDir

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Copilot Dash - Background server for viewing Copilot CLI run results" `
  -Force

# Start the task immediately
Write-Host "Starting Copilot Dash now..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $TaskName

Write-Host ""
Write-Host "✓ Auto-start configured and server started!" -ForegroundColor Green
Write-Host ""
Write-Host "The server will start automatically when you log in." -ForegroundColor White
Write-Host "Logs: %USERPROFILE%\.copilot-dash\server.log" -ForegroundColor Gray
Write-Host ""
Write-Host "To remove: .\scripts\setup-autostart.ps1 -Remove" -ForegroundColor Gray
Write-Host "To test:   schtasks /run /tn $TaskName" -ForegroundColor Gray
Write-Host ""
