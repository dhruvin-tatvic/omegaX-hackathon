# Build + preview locally, then print tunnel commands for LLM testing.
$root = Split-Path -Parent $PSScriptRoot
$site = Join-Path $root "sample-website"
Set-Location $site

if (-not (Test-Path "dist\index.html")) {
  Write-Host "Building dist..." -ForegroundColor Yellow
  npm run build
}

Write-Host ""
Write-Host "1) Start preview in THIS window (keep open):" -ForegroundColor Cyan
Write-Host "   npm run preview"
Write-Host ""
Write-Host "2) In a SECOND terminal, expose port 4173:" -ForegroundColor Cyan
Write-Host "   ngrok http 4173"
Write-Host "   OR:  npx localtunnel --port 4173"
Write-Host "   OR:  cloudflared tunnel --url http://localhost:4173"
Write-Host ""
Write-Host "3) Give the HTTPS tunnel URL to ChatGPT / Perplexity." -ForegroundColor Green
Write-Host "   See docs/ALTERNATE_TESTING.md"
Write-Host ""

npm run preview
