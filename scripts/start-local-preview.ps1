# Opens Apex Moto preview in a new window. Run from repo root or anywhere.
$root = Split-Path -Parent $PSScriptRoot
$site = Join-Path $root "sample-website"
Write-Host "Starting Apex Moto preview at http://localhost:4173" -ForegroundColor Cyan
Write-Host "Leave this window open. Press Ctrl+C to stop." -ForegroundColor Yellow
Set-Location $site
if (-not (Test-Path "dist\index.html")) {
  Write-Host "Building first (dist missing)..." -ForegroundColor Yellow
  npm run build
}
npm run preview
