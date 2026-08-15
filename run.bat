@echo off
chcp 65001 >nul
setlocal
title 人脸记忆 - 启动
cd /d "%~dp0"

if not exist ".venv" (
    echo [错误] 未检测到虚拟环境，请先运行 setup.bat 完成安装
    pause
    exit /b 1
)

call ".venv\Scripts\activate.bat"

echo 正在启动人脸记忆服务 ...
echo 浏览器将自动打开 http://localhost:8000
echo 关闭本窗口即停止服务。
echo.

REM 后台轮询等待服务就绪后再打开浏览器，避免浏览器先打开导致连不上
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -Command "$t = New-Object Net.Sockets.TcpClient; $i = 0; while (-not $t.Connected -and $i -lt 40) { try { $t.Connect('127.0.0.1', 8000) } catch {}; if (-not $t.Connected) { Start-Sleep -Milliseconds 500; $i++ } }; if ($t.Connected) { Start-Process 'http://localhost:8000' }" >nul 2>&1

python -m uvicorn server.main:app --host 127.0.0.1 --port 8000

endlocal
