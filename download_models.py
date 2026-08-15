"""一次性模型下载脚本。

将程序所需的模型下载到本地 models/ 目录：
  1. face-api.js 模型（tiny_face_detector / face_landmark_68 / face_recognition）
  2. faster-whisper base 模型（HuggingFace，由本脚本触发缓存到 models/whisper）

语音合成（TTS）使用 edge-tts 微软在线接口，无需下载本地模型。

用法：python download_models.py
"""
import os
import sys
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parent
FACE_API_MODELS_DIR = BASE_DIR / "models" / "face-api"
WHISPER_MODELS_DIR = BASE_DIR / "models" / "whisper"
VENDOR_DIR = BASE_DIR / "static" / "js" / "vendor"

# face-api.js 运行时库（前端需要，本地托管以保证离线）
FACE_API_JS_URL = (
    "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js"
)
FACE_API_JS_DEST = VENDOR_DIR / "face-api.min.js"

# 优先使用国内可达的 jsdelivr CDN 与 hf-mirror 镜像
FACE_API_BASE = (
    "https://cdn.jsdelivr.net/gh/justadudewhohacks/"
    "face-api.js@0.22.2/weights/"
)
FACE_API_FILES = [
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2",
]

def _download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        print(f"[跳过] 已存在 {dest.name}")
        return
    print(f"[下载] {url}")
    try:
        with requests.get(url, stream=True, timeout=120) as resp:
            resp.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in resp.iter_content(chunk_size=1024 * 256):
                    f.write(chunk)
        print(f"[完成] {dest.name} ({dest.stat().st_size / 1024 / 1024:.1f} MB)")
    except requests.RequestException as exc:
        print(f"[失败] {dest.name}: {exc}")
        # 清理可能的不完整文件，允许重跑
        if dest.exists():
            dest.unlink()


def download_face_api_lib() -> None:
    print("=" * 60)
    print("0/4 下载 face-api.js 运行时库 ...")
    _download(FACE_API_JS_URL, FACE_API_JS_DEST)


def download_face_api() -> None:
    print("=" * 60)
    print("1/3 下载 face-api.js 模型 ...")
    for name in FACE_API_FILES:
        _download(FACE_API_BASE + name, FACE_API_MODELS_DIR / name)


def download_whisper() -> None:
    print("=" * 60)
    print("2/3 下载 faster-whisper base 模型 ...")
    # HuggingFace 官方域名可能不可达，默认走 hf-mirror 国内镜像
    os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
    try:
        from faster_whisper import WhisperModel

        # 触发下载并做一次最小推理，验证模型可用
        model = WhisperModel(
            "base",
            device="cpu",
            compute_type="int8",
            download_root=str(WHISPER_MODELS_DIR),
        )
        print("[验证] 模型加载成功，执行空转写测试 ...")
        import numpy as np

        model.transcribe(np.zeros(1600, dtype=np.float32), language="zh", beam_size=1)
        print("[完成] faster-whisper base 模型就绪")
    except Exception as exc:  # noqa: BLE001
        print(f"[失败] faster-whisper 模型下载失败: {exc}")
        print("请检查网络后重试 `python download_models.py`，"
              "或手动将模型放入 models/whisper 目录。")


def main() -> None:
    os.chdir(BASE_DIR)
    print("人脸记忆 - 离线模型下载工具")
    download_face_api_lib()
    download_face_api()
    download_whisper()
    print("=" * 60)
    print("全部完成！现在可以运行 run.bat 启动程序。")


if __name__ == "__main__":
    sys.exit(main())
