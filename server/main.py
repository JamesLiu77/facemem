"""FastAPI 本地服务入口：静态托管 + AI 推理接口 + 特征库 CRUD。

启动: uvicorn server.main:app --host 127.0.0.1 --port 8000
"""
import random
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import config, store as store_mod, stt, tts

# ---------------------------------------------------------------- 数据模型
class FaceAddRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=30)
    descriptors: list = Field(..., min_length=1)
    force: bool = False  # 同名覆盖确认


class TTSRequest(BaseModel):
    text: str = Field(..., max_length=100)


# ---------------------------------------------------------------- 生命周期
@asynccontextmanager
async def lifespan(_app: FastAPI):
    global store
    store = store_mod.FaceStore()
    # 预加载轻量资源：特征库已加载；whisper 懒加载（首次调用时）
    print(f"[main] 特征库已加载，共 {len(store.list_people())} 位已录入人员")
    print(f"[main] 服务地址: http://{config.HOST}:{config.PORT}")
    yield


app = FastAPI(title="人脸记忆", lifespan=lifespan)
store: store_mod.FaceStore


# ---------------------------------------------------------------- 特征库 API
@app.get("/api/faces")
def list_faces():
    return {"people": store.all_people()}


@app.post("/api/faces")
def add_face(req: FaceAddRequest):
    result = store.add_person(req.name, req.descriptors, force=req.force)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.delete("/api/faces/{person_id}")
def delete_face(person_id: str):
    if not store.delete_person(person_id):
        raise HTTPException(status_code=404, detail="人员不存在")
    return {"ok": True}


# ---------------------------------------------------------------- 语音 API
@app.post("/api/transcribe")
async def transcribe(request: Request):
    """接收 16kHz 单声道 float32 裸 PCM，返回转写文本。"""
    payload = await request.body()
    text = await _run_in_thread(stt.transcribe, payload)
    return {"text": text}


@app.post("/api/tts")
async def speak(req: TTSRequest):
    mp3 = await _run_in_thread(tts.synthesize, req.text)
    if mp3 is None:
        raise HTTPException(status_code=500, detail="语音合成失败")
    return Response(content=mp3, media_type="audio/mpeg")


@app.get("/api/greeting")
def greeting(name: str = "朋友"):
    """生成一条随机热情问候文案：固定前缀 + 随机寒暄后缀。"""
    prefix = config.GREETING_PREFIX.format(name=name)
    suffix = random.choice(config.GREETING_SUFFIXES)
    return {"text": prefix + suffix}


@app.get("/api/config")
def get_config():
    """前端需要的可调参数。"""
    return {
        "match_threshold": config.MATCH_THRESHOLD,
        "sample_count": config.SAMPLE_COUNT,
        "sample_interval": config.SAMPLE_INTERVAL,
        "cooldown_seconds": config.COOLDOWN_SECONDS,
        "min_face_size": config.MIN_FACE_SIZE,
        "max_face_size": config.MAX_FACE_SIZE,
        "detect_score_threshold": config.DETECT_SCORE_THRESHOLD,
        "stranger_confirm_frames": config.STRANGER_CONFIRM_FRAMES,
        "stranger_cooldown_seconds": config.STRANGER_COOLDOWN_SECONDS,
        "stranger_hint": config.STRANGER_HINT,
        "voice_hint_interval": config.VOICE_HINT_INTERVAL,
        "greeting_prefix": config.GREETING_PREFIX,
        "greeting_suffixes": config.GREETING_SUFFIXES,
        "train_start_hint": config.TRAIN_START_HINT,
        "train_pose_hints": config.TRAIN_POSE_HINTS,
        "collect_done_hint": config.COLLECT_DONE_HINT,
        "saved_hint": config.SAVED_HINT,
        "record_max_seconds": config.RECORD_MAX_SECONDS,
        "silence_seconds": config.SILENCE_SECONDS,
    }


# ---------------------------------------------------------------- 工具
import asyncio
import functools


async def _run_in_thread(func, *args, **kwargs):
    """将 CPU 密集推理放入线程池，避免阻塞事件循环。"""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, functools.partial(func, *args, **kwargs))


# face-api.js 模型托管（必须早于 "/" 挂载，保证 /models 优先命中）
app.mount(
    "/models",
    StaticFiles(directory=config.FACE_API_MODELS_DIR),
    name="face-api-models",
)

# 静态托管（放在最后，保证 /api 路由优先匹配）
app.mount(
    "/",
    StaticFiles(directory=config.STATIC_DIR, html=True),
    name="static",
)
