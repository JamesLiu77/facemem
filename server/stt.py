"""语音识别：faster-whisper 封装。

输入：16kHz 单声道 float32 裸 PCM 字节流
输出：中文文本；失败或无声时返回空字符串。
"""
import io
import threading
from typing import Optional

import numpy as np

from . import config

_model = None
_model_lock = threading.Lock()


def _get_model():
    global _model
    if _model is not None:
        return _model
    with _model_lock:
        if _model is None:
            from faster_whisper import WhisperModel

            print("[stt] 加载 faster-whisper 模型，首次加载可能较慢 ...")
            _model = WhisperModel(
                config.WHISPER_MODEL,
                device=config.WHISPER_DEVICE,
                compute_type=config.WHISPER_COMPUTE_TYPE,
                download_root=str(config.WHISPER_MODELS_DIR),
            )
    return _model


def pcm16k_to_float32(pcm_bytes: bytes) -> np.ndarray:
    """浏览器上传的 float32 LE 裸 PCM -> 1D float32 numpy 数组。"""
    arr = np.frombuffer(pcm_bytes, dtype=np.float32).copy()
    # 防呆：长度明显异常时返回空数组
    if arr.size == 0:
        return arr
    return np.clip(arr, -1.0, 1.0)


def transcribe(pcm_bytes: bytes) -> str:
    """转写音频为中文文本，失败返回空字符串。"""
    try:
        audio = pcm16k_to_float32(pcm_bytes)
        if audio.size == 0:
            return ""
        # 简单 VAD：音量过低视为无有效语音
        if np.max(np.abs(audio)) < config.VAD_THRESHOLD:
            return ""
        model = _get_model()
        segments, _info = model.transcribe(
            audio,
            language=config.WHISPER_LANGUAGE,
            beam_size=1,
            vad_filter=False,
        )
        text = "".join(seg.text for seg in segments).strip()
        return text
    except Exception as exc:  # noqa: BLE001
        print(f"[stt] 转写失败: {exc}")
        return ""
