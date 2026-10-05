@echo off
setlocal EnableDelayedExpansion

set REPO=%~dp0
set BACKEND=%REPO%backend
set FRONTEND=%REPO%frontend
set DEMO_PORT=5050

title Service Finder - Demo Launcher

echo ============================================
echo   Service Finder - Demo Startup
echo ============================================
echo.

REM ---------------------------------------------------------------
REM  Step 1: Always rebuild the frontend
REM ---------------------------------------------------------------
echo [1/6] Building frontend...
pushd "%FRONTEND%"
call npm run build
if errorlevel 1 (
  echo.
  echo [X] Frontend build FAILED. Aborting.
  popd
  pause
  exit /b 1
)
popd
echo [OK] Frontend built.
echo.

REM ---------------------------------------------------------------
REM  Step 2: Check that ngrok is installed
REM ---------------------------------------------------------------
echo [2/6] Checking for ngrok...
where ngrok >nul 2>&1
if errorlevel 1 (
  echo [X] ngrok was not found on PATH.
  echo     Install it from https://ngrok.com/download
  pause
  exit /b 1
)
echo [OK] ngrok found.
echo.

REM ---------------------------------------------------------------
REM  Step 3: Clean up stale processes
REM ---------------------------------------------------------------
echo [3/6] Cleaning up stale processes...

taskkill /F /IM ngrok.exe >nul 2>&1

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%DEMO_PORT% ^| findstr LISTENING') do (
  echo     - killing PID %%a on port %DEMO_PORT%
  taskkill /F /PID %%a >nul 2>&1
)

timeout /t 1 /nobreak >nul
echo [OK] Cleanup done.
echo.

REM ---------------------------------------------------------------
REM  Step 4: Start demo server
REM ---------------------------------------------------------------
echo [4/6] Starting demo server on port %DEMO_PORT%...
start "ServiceFinder - Demo Server" cmd /k "cd /d %BACKEND% && npm run dev:demo"

set /a WAIT_COUNT=0
:wait_for_server
timeout /t 1 /nobreak >nul
netstat -ano | findstr :%DEMO_PORT% | findstr LISTENING >nul
if errorlevel 1 (
  set /a WAIT_COUNT+=1
  if !WAIT_COUNT! lss 15 (
    echo     - waiting for port %DEMO_PORT% ... [!WAIT_COUNT!/15]
    goto wait_for_server
  )
  echo [X] Demo server did not start within 15 seconds.
  echo     Check the "ServiceFinder - Demo Server" window for errors.
  pause
  exit /b 1
)
echo [OK] Demo server is listening on port %DEMO_PORT%.
echo.

REM ---------------------------------------------------------------
REM  Step 5: Start ngrok
REM ---------------------------------------------------------------
echo [5/6] Starting ngrok tunnel...
start "ServiceFinder - ngrok" cmd /k "ngrok http 127.0.0.1:%DEMO_PORT%"

timeout /t 3 /nobreak >nul
echo [OK] ngrok window opened.
echo.

REM ---------------------------------------------------------------
REM  Step 6: Done
REM ---------------------------------------------------------------
echo [6/6] All services started.
echo.
echo ============================================
echo   Demo server: http://localhost:%DEMO_PORT%
echo.
echo   ngrok URL:   see the "ServiceFinder - ngrok"
echo                window ^(look for "Forwarding")
echo.
echo   Stop everything:  press S then Enter below
echo                     ^(or close this window^)
echo ============================================
echo.

REM ---------------------------------------------------------------
REM  Interactive launcher loop
REM  Keeps this window alive. Press S + Enter to stop everything
REM  cleanly (kills ngrok and the demo server), then exits.
REM ---------------------------------------------------------------
:main_loop
set "CMD="
set /p "CMD=Press S then Enter to stop the demo, or just Enter to leave it running: "
if /I "!CMD!"=="S" goto shutdown
if /I "!CMD!"=="STOP" goto shutdown
if /I "!CMD!"=="Q" goto shutdown
goto main_loop

:shutdown
echo.
echo Shutting down demo...
taskkill /F /IM ngrok.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%DEMO_PORT% ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>&1
)
echo [OK] All demo processes stopped.
timeout /t 2 /nobreak >nul
exit /b 0