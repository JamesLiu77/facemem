#!/usr/bin/env bash
# 人脸记忆 - 启动（macOS / Linux）
# 用法：先执行 chmod +x run.sh，再运行 ./run.sh
cd "$(dirname "$0")" || exit 1

if [ ! -d ".venv" ]; then
    echo "[错误] 未检测到虚拟环境，请先运行 ./setup.sh 完成安装"
    exit 1
fi

# shellcheck disable=SC1091
source ".venv/bin/activate"

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

python -m uvicorn server.main:app --host 127.0.0.1 --port "$PORT"
