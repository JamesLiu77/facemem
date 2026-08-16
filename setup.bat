@echo off
chcp 65001 >nul
setlocal
REM Force Python to output in UTF-8 to match chcp 65001
set "PYTHONUTF8=1"
title Face Memory - One-click Install
cd /d "%~dp0"

set "LOG=setup.log"
if exist "%LOG%" del "%LOG%"

echo ============================================================
echo   Face Memory - One-click Install (requires internet)
echo ============================================================
echo.
echo [Tip] Detailed log will be written to %LOG%
echo.

REM ============================================================
REM 1. Locate available Python (avoid Microsoft Store placeholder)
REM ============================================================
set "PY_CMD="
where python >nul 2>&1
if not errorlevel 1 (
    REM If where result contains WindowsApps, it's the MS Store placeholder, skip
    where python | findstr /i "WindowsApps" >nul 2>&1
    if errorlevel 1 set "PY_CMD=python"
)
if not defined PY_CMD (
    py -3 --version >nul 2>&1
    if not errorlevel 1 set "PY_CMD=py -3"
)
if not defined PY_CMD (
    echo [Error] Python not detected. Please install from https://www.python.org/downloads/
    echo         Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

echo [1/5] Checking Python ...
echo [1/5] Using Python command: %PY_CMD% >> "%LOG%"
%PY_CMD% -c "import sys; print('        Python version:', sys.version.split()[0])"

REM ============================================================
REM 2. Version check (requires 3.10+)
REM ============================================================
%PY_CMD% -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [Error] Python 3.10 or higher is required. Please upgrade Python and retry.
    pause
    exit /b 1
)
echo [Check] Python version meets requirement (3.10+)
echo.

REM ============================================================
REM 3. Rebuild incomplete / create virtual environment
REM ============================================================
if exist ".venv\Scripts\python.exe" (
    echo [2/5] Virtual environment already exists, skipping
) else (
    if exist ".venv" (
        echo [Tip] Incomplete venv detected, deleting and rebuilding ...
        rmdir /s /q ".venv"
    )
    echo [2/5] Creating virtual environment ...
    %PY_CMD% -m venv .venv >> "%LOG%" 2>&1
    if errorlevel 1 (
        echo [Error] Failed to create venv, see %LOG% for details
        pause
        exit /b 1
    )
)
if not exist ".venv\Scripts\python.exe" (
    echo [Error] Venv creation failed (missing .venv\Scripts\python.exe)
    echo        Please check %LOG% for details
    pause
    exit /b 1
)
set "VPY=%~dp0.venv\Scripts\python.exe"
echo [Check] Virtual environment ready: .venv\Scripts\python.exe
echo.

REM ============================================================
REM 4. Install dependencies (use venv python directly, no activate/PATH needed)
REM ============================================================
echo [3/5] Upgrading pip ...
"%VPY%" -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [Error] pip upgrade failed, check network and retry, see %LOG%
    pause
    exit /b 1
)

echo [3/5] Installing Python dependencies (first run may take a few minutes, please be patient)...
"%VPY%" -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [Error] Dependency installation failed, check network and retry, see %LOG%
    pause
    exit /b 1
)
echo [Check] Dependencies installed
echo.

REM ============================================================
REM 5. Download models (run inside venv interpreter)
REM ============================================================
echo [4/5] Downloading model files (~190MB, first time requires internet)...
"%VPY%" download_models.py >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [Error] Model download incomplete, you can rerun setup.bat to retry, see %LOG%
)

REM ============================================================
REM 6. Verify and summary
REM ============================================================
"%VPY%" -c "import fastapi, uvicorn, faster_whisper, requests" >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [Failed] Dependency check failed, see %LOG%
) else (
    echo [5/5] Installation complete!
    echo.
    echo Usage: Double-click run.bat to start. Browser will automatically open http://localhost:8000
)
echo.
echo If installation fails, please send %LOG% content to developer for troubleshooting.
pause
endlocal
