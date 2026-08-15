"""语音合成：edge-tts 微软在线神经网络 TTS。

输出 MP3 字节流；相同文案缓存到 data/tts_cache 避免重复请求。
需要联网；网络不可用时 synthesize 返回 None，由上层返回 500。
"""
import asyncio
import hashlib
from pathlib import Path
from typing import Optional

import edge_tts

from . import config


def _cache_path(text: str) -> Path:
    digest = hashlib.md5(text.encode("utf-8")).hexdigest()
    return config.TTS_CACHE_DIR / f"{digest}.mp3"


async def _synthesize_edge(text: str) -> bytes:
    """调用 edge-tts 拉取音频流，返回完整 MP3 字节。"""
    communicate = edge_tts.Communicate(
        text, config.EDGE_TTS_VOICE, rate=config.EDGE_TTS_RATE
    )
    chunks: list[bytes] = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            chunks.append(chunk["data"])
    return b"".join(chunks)


def synthesize(text: str) -> Optional[bytes]:
    """合成语音，返回 MP3 字节流；失败返回 None。"""
    text = (text or "").strip()
    if not text:
        return None

    cache = _cache_path(text)
    if cache.exists() and cache.stat().st_size > 0:
        return cache.read_bytes()

    try:
        data = asyncio.run(_synthesize_edge(text))
        if not data:
            return None
        try:
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_bytes(data)
        except OSError:
            pass
        return data
    except Exception as exc:  # noqa: BLE001
        print(f"[tts] 合成失败: {exc}")
        return None
