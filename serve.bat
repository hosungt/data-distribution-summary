@echo off
cd /d "%~dp0"
echo Starting http-server on http://localhost:8088 ...
echo (close this window to stop the server)
echo.
npx --yes http-server . -p 8088 -c-1
echo.
echo Server stopped. Press any key to exit.
pause >nul
