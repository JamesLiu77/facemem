@echo off
chcp 65001 >nul
setlocal
REM Force Python to output in UTF-8 to match chcp 65001
set "PYTHONUTF8=1"
title Face Memory - Launch
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo [Error] Virtual environment not detected (.venv\Scripts\python.exe)
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

set "VPY=%~dp0.venv\Scripts\python.exe"

echo Starting Face Memory service ...
echo Browser will automatically open http://localhost:8000
echo Close this window to stop the service.
echo.

REM Poll in background until service is ready, then open browser to avoid opening before connection
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -Command "$t = New-Object Net.Sockets.TcpClient; $i = 0; while (-not $t.Connected -and $i -lt 40) { try { $t.Connect('127.0.0.1', 8000) } catch {}; if (-not $t.Connected) { Start-Sleep -Milliseconds 500; $i++ } }; if ($t.Connected) { Start-Process 'http://localhost:8000' }" >nul 2>&1

"%VPY%" -m uvicorn server.main:app --host 127.0.0.1 --port 8000
if errorlevel 1 (
    echo.
    echo [Error] Service failed to start. Check the error message above.
    pause
)

endlocal
