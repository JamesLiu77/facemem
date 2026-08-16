@echo off
chcp 65001 >nul
setlocal
REM 强制 Python 以 UTF-8 输出，避免中文乱码（与 chcp 65001 对齐）
set "PYTHONUTF8=1"
title 人脸记忆 - 启动
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo [错误] 未检测到虚拟环境（.venv\Scripts\python.exe）
    echo        请先双击运行 setup.bat 完成一键安装，再运行本脚本。
    pause
    exit /b 1
)

set "VPY=%~dp0.venv\Scripts\python.exe"

echo 正在启动人脸记忆服务 ...
echo 浏览器将自动打开 http://localhost:8000
echo 关闭本窗口即停止服务。
echo.

REM 后台轮询等待服务就绪后再打开浏览器，避免浏览器先打开导致连不上
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -Command "$t = New-Object Net.Sockets.TcpClient; $i = 0; while (-not $t.Connected -and $i -lt 40) { try { $t.Connect('127.0.0.1', 8000) } catch {}; if (-not $t.Connected) { Start-Sleep -Milliseconds 500; $i++ } }; if ($t.Connected) { Start-Process 'http://localhost:8000' }" >nul 2>&1

"%VPY%" -m uvicorn server.main:app --host 127.0.0.1 --port 8000

endlocal
