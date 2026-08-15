#!/usr/bin/env bash
# 人脸记忆 - 一键安装（macOS / Linux）
# 用法：先执行 chmod +x setup.sh，再运行 ./setup.sh
cd "$(dirname "$0")" || exit 1

echo "============================================================"
echo "  人脸记忆 - 一键安装（需要联网下载依赖与模型）"
echo "============================================================"
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

# 用 Python 自身比较版本，避免 macOS BSD 工具不支持 -V 的问题
if ! "$PYTHON_BIN" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'; then
    PY_VER=$("$PYTHON_BIN" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    echo "[错误] 需要 Python 3.10+，当前为 $PY_VER，请升级"
    exit 1
fi

PY_PATH=$("$PYTHON_BIN" -c 'import sys; print(sys.executable)')
echo "[检测] 使用 Python：$PY_PATH"
echo

# ---- 创建虚拟环境 ----
if [ ! -d ".venv" ]; then
    echo "[1/4] 创建虚拟环境 ..."
    "$PYTHON_BIN" -m venv .venv
    if [ $? -ne 0 ]; then
        echo "[错误] 创建虚拟环境失败"
        exit 1
    fi
else
    echo "[1/4] 虚拟环境已存在，跳过"
fi

# 激活虚拟环境（macOS / Linux 均为 bin/activate）
# shellcheck disable=SC1091
source ".venv/bin/activate"

# ---- 安装依赖 ----
echo "[2/4] 安装 Python 依赖（首次约需几分钟）..."
pip install --upgrade pip
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "[错误] 依赖安装失败，请检查网络后重试"
    exit 1
fi

# ---- 下载模型 ----
echo "[3/4] 下载模型文件 ..."
python download_models.py
if [ $? -ne 0 ]; then
    echo "[提示] 模型下载未完整完成，可稍后重跑：python download_models.py"
fi

echo "[4/4] 安装完成！"
echo
echo "使用方法：运行 ./run.sh 启动程序，浏览器将自动打开 http://localhost:8000"
