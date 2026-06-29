@echo off
:: Switch to the directory where this script is located
cd /d "%~dp0"

echo ===================================================
echo Starting OpenCode and CodeCaptain for LAN Access
echo ===================================================

echo.
echo [0/2] Cleaning up existing ports (3000, 4096)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4096 "') do taskkill /f /pid %%a >nul 2>&1
:: Small delay to let OS release the ports
timeout /t 2 /nobreak >nul

echo.
echo [1/2] Starting OpenCode Server (Port 4096, LAN)
start "OpenCode Server" cmd /k "cd /d ""%~dp0"" && opencode.cmd serve --port 4096 --hostname 0.0.0.0"

echo.
echo [2/2] Starting CodeCaptain Server (Port 3000, LAN, Password Protected)
start "CodeCaptain Server" powershell -NoExit -Command "Set-Location -LiteralPath '%~dp0'; node packages\web\bin\cli.js serve --lan --ui-password 1234"

echo.
echo Servers are launching in separate windows.
echo - OpenCode API:      http://0.0.0.0:4096
echo - CodeCaptain Web:   http://0.0.0.0:3000
echo.
echo CodeCaptain is protected with password: 1234
echo.
echo You can close this window now. The servers will keep running in their own windows.
echo ===================================================
pause
