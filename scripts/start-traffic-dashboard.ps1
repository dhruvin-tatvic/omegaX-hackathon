# Opens bot/human traffic dashboard at http://localhost:3456
$root = Split-Path -Parent $PSScriptRoot
$dash = Join-Path $root "tools\traffic-dashboard"
Set-Location $dash
if (-not (Test-Path ".env")) {
  Write-Host "WARNING: No .env file. Copy .env.example to .env and add RENDER_API_KEY + RENDER_SERVICE_ID." -ForegroundColor Red
}
Write-Host "Dashboard: http://localhost:3456" -ForegroundColor Cyan
npm start
