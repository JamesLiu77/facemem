#!/usr/bin/env bash
# 人脸记忆 - 一键安装（macOS / Linux）
# 用法：先执行 chmod +x setup.sh，再运行 ./setup.sh
set -o pipefail
cd "$(dirname "$0")" || exit 1

LOG="setup.log"
: > "$LOG"

echo "============================================================"
echo "  人脸记忆 - 一键安装（需要联网下载依赖与模型）"
echo "============================================================"
echo "[提示] 安装过程的详细日志将写入 $LOG，如遇问题请查看该文件。"
echo

# ---- 检查 Python 3.10+ ----
PYTHON_BIN=""
for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
        PYTHON_BIN="$candidate"
        break
    fi
done

if [ -z "$PYTHON_BIN" ]; then
    echo "[错误] 未检测到 Python，请先安装 Python 3.10 或更高版本"
    echo "下载地址: https://www.python.org/downloads/"
    echo "macOS 也可使用 Homebrew：brew install python@3.12"
    exit 1
fi

echo "[1/5] 检测 Python ..."
echo "[1/5] 使用 Python: $PYTHON_BIN" | tee -a "$LOG"
"$PYTHON_BIN" -c 'import sys; print("        Python 版本:", sys.version.split()[0])'

if ! "$PYTHON_BIN" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>&1 | tee -a "$LOG"; then
    PY_VER=$("$PYTHON_BIN" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    echo "[错误] 需要 Python 3.10+，当前为 $PY_VER，请升级"
    exit 1
fi
echo "[检测] Python 版本符合要求（3.10+）"
echo

# ---- 重建不完整 / 创建虚拟环境 ----
if [ -d ".venv" ] && [ ! -x ".venv/bin/python" ]; then
    echo "[提示] 检测到不完整的虚拟环境，正在删除并重建 ..."
    rm -rf ".venv"
fi
if [ ! -d ".venv" ]; then
    echo "[2/5] 创建虚拟环境 ..." | tee -a "$LOG"
    "$PYTHON_BIN" -m venv .venv 2>&1 | tee -a "$LOG"
else
    echo "[2/5] 虚拟环境已存在，跳过"
fi

# 结果导向验证：不信任 venv 命令的退出码（部分 Python 版本创建成功但返回非零，
# 与 Windows 端实测情况一致），改为等待 .venv/bin/python 出现，最多 30 秒，
# 同时防御 Gatekeeper / Spotlight 索引期间新文件短暂不可见的问题。
echo "[检测] 等待虚拟环境就绪 ..."
VENV_READY=0
for _ in $(seq 1 30); do
    if [ -x ".venv/bin/python" ]; then
        VENV_READY=1
        break
    fi
    sleep 1
done
if [ "$VENV_READY" != "1" ]; then
    echo "[错误] 虚拟环境异常（缺少 .venv/bin/python）"
    echo "        请删除 .venv 目录后重新运行 ./setup.sh"
    exit 1
fi

VPY="$(pwd)/.venv/bin/python"
echo "[检测] 虚拟环境就绪：.venv/bin/python"
echo

# ---- 安装依赖（venv 内 python/pip，显式路径，不依赖 activate）----
echo "[3/5] 升级 pip ..." | tee -a "$LOG"
"$VPY" -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple 2>&1 | tee -a "$LOG"
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "[错误] pip 升级失败，请检查网络后重试，详见 $LOG"
    exit 1
fi

echo "[3/5] 安装 Python 依赖（首次约需几分钟，请耐心等待）..." | tee -a "$LOG"
"$VPY" -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple 2>&1 | tee -a "$LOG"
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "[错误] 依赖安装失败，请检查网络后重试，详见 $LOG"
    exit 1
fi
echo "[检测] 依赖安装完成"
echo

# ---- 下载模型（venv 内解释器执行）----
echo "[4/5] 下载模型文件（约 190MB，首次需要联网）..." | tee -a "$LOG"
"$VPY" download_models.py 2>&1 | tee -a "$LOG"
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "[错误] 模型下载未完整完成，可重新运行 ./setup.sh 补下，详见 $LOG"
fi

# ---- 校验与总结 ----
"$VPY" -c "import fastapi, uvicorn, faster_whisper, requests" >> "$LOG" 2>&1
if [ $? -ne 0 ]; then
    echo "[失败] 依赖校验未通过，请查看 $LOG"
else
    echo "[5/5] 安装完成！"
    echo
    echo "使用方法：运行 ./run.sh 启动程序，浏览器将自动打开 http://localhost:8000"
fi
echo
echo "若安装失败，请将 $LOG 文件内容发给开发者排查。"
