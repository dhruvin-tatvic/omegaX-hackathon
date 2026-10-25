# LLM comparison dashboard (default http://localhost:3457)
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  $node = "$env:LOCALAPPDATA\Programs\cursor\resources\app\resources\helpers\node.exe"
}
Set-Location (Join-Path $PSScriptRoot "..\tools\comparison-dashboard")
& $node server.js
