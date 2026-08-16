@echo off
chcp 65001 >nul
setlocal
REM 强制 Python 以 UTF-8 输出，避免中文乱码（与 chcp 65001 对齐）
set "PYTHONUTF8=1"
title 人脸记忆 - 一键安装
cd /d "%~dp0"

set "LOG=setup.log"
if exist "%LOG%" del "%LOG%"

echo ============================================================
echo   人脸记忆 - 一键安装（需要联网下载依赖与模型）
echo ============================================================
echo.
echo [提示] 安装过程的详细日志将写入 %LOG%，如遇问题请查看该文件。
echo.

REM ============================================================
REM 1. 定位可用 Python（规避 Microsoft Store 占位版）
REM ============================================================
set "PY_CMD="
where python >nul 2>&1
if not errorlevel 1 (
    REM 若 where 结果包含 WindowsApps，说明是 Microsoft Store 占位版，弃用
    where python | findstr /i "WindowsApps" >nul 2>&1
    if errorlevel 1 set "PY_CMD=python"
)
if not defined PY_CMD (
    py -3 --version >nul 2>&1
    if not errorlevel 1 set "PY_CMD=py -3"
)
if not defined PY_CMD (
    echo [错误] 未检测到 Python，请从 https://www.python.org/downloads/ 安装
    echo        安装时请勾选 "Add Python to PATH"，安装完成后重试本脚本。
    pause
    exit /b 1
)

echo [1/5] 检测 Python ...
echo [1/5] 使用 Python 命令: %PY_CMD% >> "%LOG%"
%PY_CMD% -c "import sys; print('        Python 版本:', sys.version.split()[0])"

REM ============================================================
REM 2. 版本校验（要求 3.10+）
REM ============================================================
%PY_CMD% -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [错误] 需要 Python 3.10 或更高版本，请升级 Python 后重试。
    pause
    exit /b 1
)
echo [检测] Python 版本符合要求（3.10+）
echo.

REM ============================================================
REM 3. 重建不完整 / 创建虚拟环境
REM ============================================================
if exist ".venv" if not exist ".venv\Scripts\python.exe" (
    echo [提示] 检测到不完整的虚拟环境，正在删除并重建 ...
    rmdir /s /q ".venv"
)
if not exist ".venv" (
    echo [2/5] 创建虚拟环境 ...
    %PY_CMD% -m venv .venv >> "%LOG%" 2>&1
    if errorlevel 1 (
        echo [错误] 创建虚拟环境失败，请查看 %LOG%
        pause
        exit /b 1
    )
) else (
    echo [2/5] 虚拟环境已存在，跳过
)
if not exist ".venv\Scripts\python.exe" (
    echo [错误] 虚拟环境异常（缺少 .venv\Scripts\python.exe）
    echo        请手动删除 .venv 文件夹后重新运行 setup.bat
    pause
    exit /b 1
)
set "VPY=%~dp0.venv\Scripts\python.exe"
echo [检测] 虚拟环境就绪：.venv\Scripts\python.exe
echo.

REM ============================================================
REM 4. 安装依赖（统一使用 venv 内 python，不依赖 activate/PATH）
REM ============================================================
echo [3/5] 升级 pip ...
"%VPY%" -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [错误] pip 升级失败，请检查网络后重试，详见 %LOG%
    pause
    exit /b 1
)

echo [3/5] 安装 Python 依赖（首次约需几分钟，请耐心等待）...
"%VPY%" -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络后重试，详见 %LOG%
    pause
    exit /b 1
)
echo [检测] 依赖安装完成
echo.

REM ============================================================
REM 5. 下载模型（venv 内解释器执行）
REM ============================================================
echo [4/5] 下载模型文件（约 190MB，首次需要联网）...
"%VPY%" download_models.py >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [错误] 模型下载未完整完成，可重新运行 setup.bat 补下，详见 %LOG%
)

REM ============================================================
REM 6. 校验与总结
REM ============================================================
"%VPY%" -c "import fastapi, uvicorn, faster_whisper, requests" >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [失败] 依赖校验未通过，请查看 %LOG%
) else (
    echo [5/5] 安装完成！
    echo.
    echo 使用方法：双击 run.bat 启动程序，浏览器将自动打开 http://localhost:8000
)
echo.
echo 若安装失败，请将 %LOG% 文件内容发给开发者排查。
pause
endlocal
