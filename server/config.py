"""全局配置：路径、识别参数、语音参数与问候语模板。"""
import os
from pathlib import Path

# HuggingFace 模型下载统一走国内镜像，保证 faster-whisper 首次下载可用
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

# ---------------------------------------------------------------- 基本路径
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
FACE_API_MODELS_DIR = MODELS_DIR / "face-api"
WHISPER_MODELS_DIR = MODELS_DIR / "whisper"       # faster-whisper 模型下载根目录
TTS_CACHE_DIR = DATA_DIR / "tts_cache"             # 问候文案合成结果缓存
FACES_FILE = DATA_DIR / "faces.json"               # 特征库持久化文件

# 确保运行时目录存在
for _d in (DATA_DIR, TTS_CACHE_DIR, FACE_API_MODELS_DIR,
           WHISPER_MODELS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- 服务配置
HOST = "127.0.0.1"
PORT = 8000

# ---------------------------------------------------------------- 人脸识别
MATCH_THRESHOLD = 0.55      # 欧氏距离阈值，越小越严格；0.55 兼顾 1 米距离识别
FACE_INPUT_SIZE = 640       # face-api.js 检测输入尺寸
DETECT_EVERY_N_FRAMES = 2   # 隔帧检测，节省 CPU
SAMPLE_COUNT = 6            # 训练采集样本张数
SAMPLE_INTERVAL = 0.55      # 每张样本间隔（秒）；采集快速完成，配合截断式短语音引导
MIN_FACE_SIZE = 80          # 训练时人脸的像素最小边长（约 1 米距离仍可训练）
MAX_FACE_SIZE = 420         # 人脸像素边长上限，超过提示"离远一点"
DETECT_SCORE_THRESHOLD = 0.5  # face-api.js 检测置信度阈值（TinyFaceDetector 官方推荐值，过高会滤掉真实人脸）
STRANGER_CONFIRM_FRAMES = 4  # 陌生脸需连续 N 帧被识别为未录入，才触发语音提示（滤掉偶发误检）

# ---------------------------------------------------------------- 打招呼
COOLDOWN_SECONDS = 30       # 同一人重复打招呼的冷却时长（秒）
STRANGER_COOLDOWN_SECONDS = 25  # 陌生脸语音提示冷却时长（秒）
VOICE_HINT_INTERVAL = 2.5   # 训练时语音引导的最短间隔（秒）
# 识别到已保存人脸：固定前缀 + 随机寒暄后缀
GREETING_PREFIX = "{name}，你好！"
GREETING_SUFFIXES = [
    "见到你真高兴！",
    "好久不见，我可想你了！",
    "你今天看起来气色真不错！",
    "见到你真是太开心了！",
    "今天也要元气满满哦！",
]
# 检测到未录入人脸的语音提示
STRANGER_HINT = "陌生人你好呀，来试试吧，点击开始训练，完成人脸学习，我就能记住你啦！"
# 训练过程中的语音提示（短句，2~4 字为主，跟随采集节奏，不拖慢流程）
TRAIN_START_HINT = "开始学习"
TRAIN_POSE_HINTS = ["正对镜头", "转头", "眨眼", "张嘴", "远一点", "近一点"]
COLLECT_DONE_HINT = "学习完成，请说出你的名字"
SAVED_HINT = "好的，{name}，我记住你了！"

# ---------------------------------------------------------------- 语音识别
WHISPER_MODEL = "base"          # tiny / base / small / medium
WHISPER_DEVICE = "cpu"
WHISPER_COMPUTE_TYPE = "int8"
WHISPER_LANGUAGE = "zh"
RECORD_SAMPLE_RATE = 16000      # 浏览器采集的 16kHz 单声道 PCM
RECORD_MAX_SECONDS = 5          # 录音上限时长
VAD_THRESHOLD = 0.01            # 音量低于该值视为无有效语音
SILENCE_SECONDS = 0.8           # 检测到静音后提前结束录音

# ---------------------------------------------------------------- 语音合成
# edge-tts：微软在线神经网络音色（需联网）。常用中文音色：
#   zh-CN-XiaoxiaoNeural  晓晓（女声，最自然）
#   zh-CN-XiaoyiNeural    晓伊（女声）
#   zh-CN-YunxiNeural     云希（男声）
#   zh-CN-YunjianNeural   云健（男声）
EDGE_TTS_VOICE = "zh-CN-XiaoxiaoNeural"
EDGE_TTS_RATE = "+0%"              # 语速调整，如 "+10%" 更快、"-10%" 更慢
