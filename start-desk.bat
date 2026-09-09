@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "URL=http://127.0.0.1:8787"

where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 22 from https://nodejs.org then click the icon again.
  start "" "https://nodejs.org"
  pause
  exit /b 1
)

if not exist "package.json" (
  echo AGENT 2.0 folder is missing package.json. Unzip the whole folder, not just this file.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies — first run only...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

curl -s -o nul --max-time 2 %URL% >nul 2>&1
if not errorlevel 1 (
  echo Desk already running. Opening it.
  start "" %URL%
  exit /b 0
)

echo Starting AGENT 2.0 on port 8787...
start "AGENT 2.0" cmd /k "cd /d "%~dp0" && npm run desk"

set /a n=0
:wait
set /a n+=1
if %n% GTR 40 (
  echo Server did not come up. Check the AGENT 2.0 window for errors.
  pause
  exit /b 1
)
timeout /t 2 /nobreak >nul
curl -s -o nul --max-time 2 %URL% >nul 2>&1
if errorlevel 1 goto wait

start "" %URL%
exit /b 0
