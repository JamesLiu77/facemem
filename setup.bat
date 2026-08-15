@echo off
chcp 65001 >nul
setlocal
title 人脸记忆 - 一键安装

echo ============================================================
echo   人脸记忆 - 一键安装（需要联网下载依赖与模型）
echo ============================================================
echo.

cd /d "%~dp0"

REM 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Python，请先安装 Python 3.10 或更高版本
    echo 下载地址: https://www.python.org/downloads/
    echo 安装时请勾选 "Add Python to PATH"
    pause
    exit /b 1
)

REM 创建虚拟环境
if not exist ".venv" (
    echo [1/4] 创建虚拟环境 ...
    python -m venv .venv
    if errorlevel 1 (
        echo [错误] 创建虚拟环境失败
        pause
        exit /b 1
    )
) else (
    echo [1/4] 虚拟环境已存在，跳过
)

call ".venv\Scripts\activate.bat"

REM 安装依赖
echo [2/4] 安装 Python 依赖（首次约需几分钟）...
pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络后重试
    pause
    exit /b 1
)

REM 下载模型
echo [3/4] 下载模型文件 ...
python download_models.py
if errorlevel 1 (
    echo [错误] 模型下载未完整完成，可稍后重跑：python download_models.py
)

echo [4/4] 安装完成！
echo.
echo 使用方法：双击 run.bat 启动程序，浏览器将自动打开 http://localhost:8000
echo.
pause
endlocal
