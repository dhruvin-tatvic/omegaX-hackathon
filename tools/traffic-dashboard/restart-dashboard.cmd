@echo off
echo Stopping anything on port 3456...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3456 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
cd /d "%~dp0"
where npm >nul 2>&1
if errorlevel 1 (
  for %%I in ("%ProgramFiles%\nodejs\npm.cmd") do set "NPM=%%~I"
  if not exist "%NPM%" (
    echo npm not found. Install Node.js or run from a terminal where npm works.
    exit /b 1
  )
) else (
  set "NPM=npm"
)
echo Starting dashboard...
call "%NPM%" start
