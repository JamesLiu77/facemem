#!/usr/bin/env bash
# 人脸记忆 - 启动（macOS / Linux）
# 用法：先执行 chmod +x run.sh，再运行 ./run.sh
cd "$(dirname "$0")" || exit 1

VPY="$(pwd)/.venv/bin/python"

# 通过执行来验证 venv 可用，不依赖文件存在性检查（与 Windows 版 run.bat 一致：
# 文件系统索引/安全扫描期间新文件可能短暂不可见，但解释器能跑起来就是成功）。
# 最多重试 5 次，每次间隔 1 秒。
VENV_OK=0
for _ in $(seq 1 5); do
    if "$VPY" -c 'import sys; print("venv python", sys.version.split()[0])' >/dev/null 2>&1; then
        VENV_OK=1
        break
    fi
    sleep 1
done
if [ "$VENV_OK" != "1" ]; then
    echo "[错误] 无法执行 venv 内的 Python：$VPY"
    echo "        请先运行 ./setup.sh 完成一键安装，再运行本脚本。"
    echo
    echo "[Diag] 当前目录: $(pwd)"
    if [ -d ".venv" ]; then
        echo "[Diag] .venv 目录存在"
        echo "[Diag] .venv/bin 内容:"
        ls -la ".venv/bin" 2>/dev/null || echo "        （无法列出）"
    else
        echo "[Diag] 当前目录下不存在 .venv 目录"
    fi
    exit 1
fi
echo "[检测] 虚拟环境就绪"

PORT=8000
echo "正在启动人脸记忆服务 ..."
echo "浏览器将自动打开 http://localhost:$PORT"
echo "按 Ctrl+C 停止服务。"
echo

# 后台轮询等待服务就绪后再打开浏览器，避免浏览器先打开导致连不上
open_browser() {
    if command -v open >/dev/null 2>&1; then
        open "http://localhost:$PORT" 2>/dev/null
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "http://localhost:$PORT" >/dev/null 2>&1
    fi
}

ready() {
    if command -v curl >/dev/null 2>&1; then
        curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/" && return 0
    elif command -v python3 >/dev/null 2>&1; then
        python3 -c "import urllib.request,sys; urllib.request.urlopen('http://127.0.0.1:$PORT/', timeout=1)" 2>/dev/null && return 0
    fi
    return 1
}

(
    for _ in $(seq 1 40); do
        if ready; then
            open_browser
            break
        fi
        sleep 0.5
    done
) &

"$VPY" -m uvicorn server.main:app --host 127.0.0.1 --port "$PORT"
if [ $? -ne 0 ]; then
    echo
    echo "[错误] 服务启动失败，请检查上方错误信息。可尝试手动运行："
    echo "       $VPY -m uvicorn server.main:app --host 127.0.0.1 --port $PORT"
fi
