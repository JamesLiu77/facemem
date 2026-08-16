@echo off
chcp 65001 >nul
setlocal
REM Force Python to output in UTF-8 to match chcp 65001
set "PYTHONUTF8=1"
title Face Memory - Launch
cd /d "%~dp0"

set "VPY=%~dp0.venv\Scripts\python.exe"

REM Verify the venv by EXECUTING it, not by checking file existence.
REM cmd's "if exist" can report false negatives while Windows Defender is
REM scanning freshly created executables (dir lists the file but if exist
REM says missing). But if the interpreter actually runs, the venv is usable.
set "VENV_OK=0"
set /a VENV_TRY=0
:venv_detect
"%VPY%" -c "import sys; print('venv python', sys.version.split()[0])" >nul 2>&1
if not errorlevel 1 set "VENV_OK=1"
if "%VENV_OK%"=="1" goto :venv_found
set /a VENV_TRY+=1
if %VENV_TRY% lss 5 (
    timeout /t 1 /nobreak >nul
    goto :venv_detect
)
:venv_found
if not "%VENV_OK%"=="1" (
    echo [Error] Cannot execute venv python: %VPY%
    echo        Please run setup.bat first to complete installation, then run this script.
    echo.
    echo [Diag] Current folder: %CD%
    if exist ".venv" (
        echo [Diag] .venv folder exists
        echo [Diag] Content of .venv\Scripts:
        dir /b ".venv\Scripts"
    ) else (
        echo [Diag] .venv folder does NOT exist in the current folder
    )
    pause
    exit /b 1
)
echo [Check] Virtual environment detected

echo Starting Face Memory service ...
echo Browser will automatically open http://localhost:8000
echo Close this window to stop the service.
echo.

REM ============================================================
REM 6. Start uvicorn (tee output to console and log for diagnosis)
REM ============================================================
set "RUN_LOG=run.log"
if exist "%RUN_LOG%" del "%RUN_LOG%"

REM Background poller: open browser once 127.0.0.1:8000 is ready
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -Command "$t = New-Object Net.Sockets.TcpClient; $i = 0; while (-not $t.Connected -and $i -lt 40) { try { $t.Connect('127.0.0.1', 8000) } catch {}; if (-not $t.Connected) { Start-Sleep -Milliseconds 500; $i++ } }; if ($t.Connected) { Start-Process 'http://localhost:8000' }" >nul 2>&1

echo [Launch] %date% %time% > "%RUN_LOG%"
"%VPY%" -m uvicorn server.main:app --host 127.0.0.1 --port 8000 2>&1 | powershell -NoProfile -Command "Get-Content | Tee-Object -FilePath '%RUN_LOG%' -Append"
if errorlevel 1 (
    echo.
    echo [Error] Service failed to start.  Last lines from %RUN_LOG%:
    type "%RUN_LOG%"
    echo.
    echo [Hint] If the browser did not open, try manually visiting http://localhost:8000
    pause
)

endlocal
