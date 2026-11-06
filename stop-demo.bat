@echo off
setlocal EnableDelayedExpansion
set DEMO_PORT=5050

title Service Finder - Stop Demo

echo ============================================
echo   Service Finder - Stopping Demo
echo ============================================
echo.

REM 1. Kill the ngrok process by name
taskkill /F /IM ngrok.exe >nul 2>&1
if errorlevel 1 (
  echo     - ngrok: not running
) else (
  echo     - ngrok: killed
)

REM 2. Kill whatever is listening on the demo port
set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%DEMO_PORT% ^| findstr LISTENING') do (
  echo     - demo server on port %DEMO_PORT%: killing PID %%a
  taskkill /F /PID %%a >nul 2>&1
  set FOUND=1
)
if !FOUND!==0 echo     - demo server on port %DEMO_PORT%: not running

REM 3. Kill the spawned cmd windows by title (in case the PIDs above
REM    were reused or the wrapper shell survived)
taskkill /F /FI "WINDOWTITLE eq ServiceFinder - Demo Server*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq ServiceFinder - ngrok*" >nul 2>&1

echo.
echo [OK] Demo stopped.
echo.
ping -n 3 127.0.0.1 >nul
exit /b 0