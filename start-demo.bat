@echo off
setlocal

set REPO=%~dp0
set BACKEND=%REPO%backend
set FRONTEND=%REPO%frontend

echo ============================================
echo   Service Finder - Demo Startup
echo ============================================
echo.

REM --- Step 1: Check that frontend/dist exists ---
if not exist "%FRONTEND%\dist\index.html" (
  echo [!] frontend/dist not found. Building frontend first...
  pushd "%FRONTEND%"
  call npm run build
  if errorlevel 1 (
    echo [X] Frontend build failed. Aborting.
    popd
    pause
    exit /b 1
  )
  popd
)

REM --- Step 2: Kill any stale ngrok or demo server on port 5050 ---
echo [1/3] Cleaning up stale processes...
taskkill /F /IM ngrok.exe >nul 2>&1

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5050 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>&1
)

timeout /t 1 /nobreak >nul

REM --- Step 3: Start demo server in its own window ---
echo [2/3] Starting demo server on port 5050...
start "ServiceFinder - Demo Server" cmd /k "cd /d %BACKEND% && npm run dev:demo"

REM --- Give it a moment to bind the port ---
timeout /t 4 /nobreak >nul

REM --- Step 4: Start ngrok in its own window ---
echo [3/3] Starting ngrok tunnel to port 5050...
start "ServiceFinder - ngrok" cmd /k "ngrok http 127.0.0.1:5050"

echo.
echo ============================================
echo   Both services are starting in new windows.
echo.
echo   Demo server: http://localhost:5050
echo   ngrok URL:   check the ngrok window
echo.
echo   To stop everything, close both windows
echo   or run stop-demo.bat
echo ============================================
echo.
pause