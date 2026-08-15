# 记卿容颜 · 人脸识别训练本地模型体验

一个智能的「人脸记忆」程序：调用本地摄像头进行人脸识别训练，你对着摄像头说出（或输入）自己的名字，此后程序再次扫到你的脸时，就会用语音热情地打招呼。

采用 **浏览器前端 + Python 本地服务** 的混合架构：人脸检测/识别在浏览器内用本地 face-api.js 实时完成，语音识别（Whisper）与语音合成（edge-tts 微软在线神经网络音色）由本地 Python 服务完成。**除语音合成需联网外，其余全部在本地完成。**

---

## 功能特性

- 🎯 **训练模式**：采集 6 张不同角度的人脸样本 → 说出或输入名字 → 保存至本地特征库，支持多人、同名覆盖
- 👋 **识别模式**：实时扫描人脸并与特征库匹配，命中后高亮显示名字并用语音热情打招呼（30 秒内不重复打扰）
- ✨ **新朋友提示**：检测到未录入的人脸时提示，可一键转入训练
- 🗑 **人员管理**：已录入人员列表，可随时删除
- 🔊 **自然语音**：语音合成使用 edge-tts（微软在线神经网络音色，接近真人），同一文案自动缓存避免重复请求
- 🌙 **简洁深色科技风界面**：玻璃卡片、渐变、微动画

## 技术架构

```
浏览器前端 (static/)                Python 本地服务 (server/)
┌─────────────────────┐           ┌──────────────────────────┐
│ 摄像头 getUserMedia │           │ FastAPI + uvicorn        │
│ face-api.js 人脸识别 │  HTTP     │ ├─ /api/faces 特征库 CRUD │
│ 128 维特征匹配       │ ────────► │ ├─ /api/transcribe Whisper│
│ WebAudio 录音 16kHz  │           │ ├─ /api/tts     edge-tts │
│ Audio 播放打招呼语音  │           │ └─ 静态资源 / 模型托管     │
└─────────────────────┘           └──────────────────────────┘
```

| 环节 | 技术 | 运行位置 |
|---|---|---|
| 人脸检测/识别 | face-api.js（Tiny Face Detector + 128 维描述子） | ✅ 本地 |
| 语音识别 | faster-whisper（base 模型，CPU int8） | ✅ 本地 |
| 语音合成 | edge-tts（微软在线神经网络音色，需联网） | ⚠️ 在线 |
| 数据存储 | `data/faces.json`（名字 + 128 维特征向量） | ✅ 本地 |

## 环境要求

- Windows 10/11 或 macOS（Apple Silicon / Intel 均可）
- Python 3.10+（macOS 需自行安装，见下文）
- 摄像头与麦克风
- 推荐使用 Chrome / Edge 浏览器（Firefox / Safari 亦可）
- 语音打招呼功能需要联网（TTS 走 edge-tts 在线接口）

## 安装（首次需联网）

### Windows

1. 双击 `setup.bat`，脚本将自动：
   - 创建虚拟环境 `.venv`
   - 安装全部 Python 依赖（含 edge-tts）
   - 下载本地模型到 `models/`（约 190 MB，一次性；TTS 无需下载模型）
2. 若模型下载中断，可随时重新运行 `python download_models.py`（断点续传）。

### macOS / Linux

1. 先安装 Python 3.10+（macOS 不自带）：
   - 官网 pkg：<https://www.python.org/downloads/>
   - 或 Homebrew：`brew install python@3.12`
2. 打开「终端」，进入项目目录后执行：

   ```bash
   chmod +x setup.sh run.sh
   ./setup.sh
   ```

   `setup.sh` 会自动创建虚拟环境、安装依赖并下载模型。
3. 若模型下载中断，可随时重新运行 `python download_models.py`（断点续传）。

> 模型来源均已适配国内可达镜像（jsdelivr CDN、hf-mirror.com），无需额外配置代理。

## 启动

### Windows

双击 `run.bat`，浏览器会自动打开 `http://localhost:8000`。关闭窗口即停止服务。

### macOS / Linux

在「终端」中执行 `./run.sh`，浏览器会自动打开 `http://localhost:8000`。按 `Ctrl+C` 停止服务。

## 使用指南

### 训练（录入新面孔）
1. 点击 **「🎯 开始训练」**，允许浏览器使用摄像头
2. 正对摄像头，保持不动，画面中出现采样进度环；**轻微变换角度** 以提高识别准确率
3. 采集满 6 张后，点击 **「🎤 说出名字」** 并大声说出自己的名字，或直接在输入框输入
4. 点击 **「💾 保存」** → 录入完成，名字出现在右侧「已录入人员」列表

### 识别（打招呼）
1. 点击 **「👋 开始识别」**
2. 走到摄像头前，识别命中后画面出现**青绿色高亮框 + 名字**，并语音问候（如「张三，你好！见到你真高兴！」）
3. 同一人 30 秒内不会重复打扰；
4. 侦测到未录入的人脸显示灰色「新朋友」标签，并语音邀请体验人脸学习录入过程。

### 管理
- 右侧人员列表可查看每个名字的样本数并删除

## 常见问题

| 问题 | 解决方式 |
|---|---|
| 安装依赖失败 | 检查网络后重跑 `setup.bat`（Windows）或 `./setup.sh`（macOS）；如 dlib 相关报错可忽略（本项目不依赖 dlib） |
| 模型下载失败 | 重跑 `python download_models.py`，支持断点续传 |
| 摄像头黑屏/报错 | 确认浏览器地址为 `localhost`（`getUserMedia` 安全要求），并允许摄像头权限；检查摄像头是否被其他程序占用 |
| macOS 摄像头无画面 | 首次调用会弹系统授权窗口；若曾拒绝，前往「系统设置 → 隐私与安全性 → 摄像头」允许浏览器使用 |
| macOS 没有 Python | macOS 不自带 Python 3.10+，请先安装：`brew install python@3.12` 或官网 pkg |
| 听不清名字 | 靠近麦克风，或直接用键盘输入；多次识别失败时可重说 |
| 识别率低 | 训练时多变换角度；或在 `server/config.py` 中调大 `MATCH_THRESHOLD`（默认 0.55） |
| 打招呼没声音 | 检查系统音量与网络（TTS 需联网）；同一文案会缓存到 `data/tts_cache`，无网时新文案无法合成 |

## 目录结构

```
facemem/
├── .gitignore              # Git 忽略规则（隐私/模型/大文件）
├── GITHUB_UPLOAD.md        # GitHub 上传指引
├── run.bat / run.sh        # 一键启动（Windows / macOS-Linux）
├── setup.bat / setup.sh    # 一键安装（依赖 + 模型；Windows / macOS-Linux）
├── download_models.py      # 本地模型下载（jsdelivr / hf-mirror）
├── requirements.txt
├── server/                 # Python 本地服务
│   ├── main.py             # FastAPI 入口与全部 API
│   ├── config.py           # 全局配置（阈值/采样/冷却/问候语/TTS）
│   ├── store.py            # 特征库持久化
│   ├── stt.py              # faster-whisper 语音识别
│   └── tts.py              # edge-tts 语音合成（含缓存）
├── static/                 # 浏览器前端
│   ├── index.html
│   ├── css/style.css       # 深色科技风样式
│   └── js/                 # app.js / vision.js / audio.js / api.js / vendor/
├── models/                 # 本地模型（首次下载）
│   ├── face-api/           # face-api.js 权重
│   └── whisper/            # faster-whisper 语音识别模型
└── data/                   # 运行时数据（特征库、TTS 缓存）
```

## 可调参数（server/config.py）

- `MATCH_THRESHOLD`：识别距离阈值（0.55），越小越严格
- `SAMPLE_COUNT`：训练采样张数（6）
- `COOLDOWN_SECONDS`：打招呼冷却时长（30 秒）
- `EDGE_TTS_VOICE`：TTS 音色（默认 `zh-CN-XiaoxiaoNeural` 晓晓-女声，可换云希等）
- `EDGE_TTS_RATE`：语速（`"+0%"` 正常，`"+10%"` 更快）
- `GREETING_TEMPLATES`：热情问候语模板（随机选取）
- `PORT`：服务端口（8000）

## 隐私说明

人脸特征向量、姓名、特征库等数据仅保存在本机；语音合成文案会发送至微软 edge-tts 在线服务。
