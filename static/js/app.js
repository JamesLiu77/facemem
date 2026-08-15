/* 应用主逻辑：训练/识别状态机、视频循环、界面交互 */
(() => {
  'use strict';

  // ---------------------------------------------------------------- DOM
  const $ = (id) => document.getElementById(id);
  const video = $('video');
  const canvas = $('canvas');
  const ctx2d = canvas.getContext('2d');
  const modeBadge = $('modeBadge');
  const statusText = $('statusText');
  const logList = $('logList');
  const btnTrain = $('btnTrain');
  const btnRecognize = $('btnRecognize');
  const btnStop = $('btnStop');
  const trainSection = $('trainSection');
  const nameInput = $('nameInput');
  const btnVoiceName = $('btnVoiceName');
  const btnSaveName = $('btnSaveName');
  const btnCancelTrain = $('btnCancelTrain');
  const voiceStatus = $('voiceStatus');
  const peopleList = $('peopleList');
  const progressOverlay = $('progressOverlay');
  const ringBar = $('ringBar');
  const progressText = $('progressText');
  const progressHint = $('progressHint');
  const cameraPlaceholder = $('cameraPlaceholder');

  const RING_CIRCUMFERENCE = 326.7; // 2πr, r=52

  // ---------------------------------------------------------------- 状态
  const state = {
    mode: 'idle', // idle | training | recognizing
    cameraOn: false,
    cfg: {
      match_threshold: 0.5,
      sample_count: 6,
      sample_interval: 0.55,
      cooldown_seconds: 30,
      min_face_size: 100,
      max_face_size: 420,
      detect_score_threshold: 0.5,
      stranger_confirm_frames: 4,
      stranger_cooldown_seconds: 25,
      stranger_hint: '陌生人你好呀，来试试吧，点击开始训练，完成人脸学习，我就能记住你啦！',
      voice_hint_interval: 2.5,
      greeting_prefix: '{name}，你好！',
      greeting_suffixes: ['见到你真高兴！', '好久不见，我可想你了！', '你今天看起来气色真不错！', '见到你真是太开心了！', '今天也要元气满满哦！'],
      train_start_hint: '开始学习',
      train_pose_hints: ['正对镜头', '转头', '眨眼', '张嘴', '远一点', '近一点'],
      collect_done_hint: '学习完成，请说出你的名字',
      saved_hint: '好的，{name}，我记住你了！',
      record_max_seconds: 5,
      silence_seconds: 0.8,
    },
    collecting: false,
    trainDescriptors: [],
    lastSampleAt: 0,
    greetCooldown: new Map(),
    strangerCooldown: 0,
  };
  let frameCount = 0;
  let rafId = null;
  let busy = false;
  let lastVoiceHintAt = 0; // 训练语音引导的最近播报时间，避免频繁打扰

  // ---------------------------------------------------------------- 界面反馈
  function log(msg) {
    const li = document.createElement('li');
    li.textContent = msg;
    logList.appendChild(li);
    while (logList.children.length > 12) logList.removeChild(logList.firstChild);
    logList.scrollLeft = logList.scrollWidth;
  }

  function setStatus(text, cls = 'idle') {
    statusText.textContent = text;
    statusText.className = 'status-pill ' + cls;
  }

  function setModeBadge(mode) {
    const map = { idle: '待机', training: '训练中', recognizing: '识别中' };
    modeBadge.textContent = map[mode] || '待机';
    modeBadge.className = 'mode-badge ' + mode;
  }

  function showCameraPlaceholder(show) {
    cameraPlaceholder.classList.toggle('hidden', !show);
  }

  // ---------------------------------------------------------------- 摄像头
  // 等待 video 真正有画面（readyState>=2 或 loadeddata/playing），最多等 3 秒。
  // 第二次开启摄像头时，video 元素复用，旧流刚停止，新流可能还没开始出帧，
  // 若直接 play() 就返回，检测会一直对着黑屏/旧帧，导致“卡在 0/6”。
  function waitForVideoReady(videoEl, timeoutMs = 3000) {
    return new Promise((resolve) => {
      if (videoEl.readyState >= 2) return resolve(true);
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        cleanup();
        resolve(ok);
      };
      const onReady = () => {
        if (videoEl.readyState >= 2) finish(true);
      };
      const cleanup = () => {
        videoEl.removeEventListener('loadeddata', onReady);
        videoEl.removeEventListener('playing', onReady);
      };
      videoEl.addEventListener('loadeddata', onReady);
      videoEl.addEventListener('playing', onReady);
      setTimeout(() => finish(false), timeoutMs);
    });
  }

  async function startCamera() {
    if (state.cameraOn) return true;
    try {
      // 彻底重置 video 元素，避免上一次的流/画面残留
      try { video.pause(); } catch (_) {}
      if (video.srcObject) {
        video.srcObject.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = stream;
      state.cameraOn = true;
      showCameraPlaceholder(false);
      await waitForVideoReady(video);
      await video.play();
      return true;
    } catch (e) {
      setStatus('摄像头开启失败，请检查权限与设备', 'idle');
      log('摄像头错误: ' + e.message);
      return false;
    }
  }

  function stopCamera() {
    try { video.pause(); } catch (_) {}
    if (video.srcObject) {
      video.srcObject.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
    state.cameraOn = false;
    showCameraPlaceholder(true);
  }

  // ---------------------------------------------------------------- 绘制
  function ensureCanvasSize() {
    if (video.videoWidth && canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
  }

  function drawFace(box, name, matched, ts) {
    const color = matched ? '#00C9A7' : '#A8B2C1';
    ctx2d.strokeStyle = color;
    ctx2d.lineWidth = 3;
    ctx2d.shadowColor = color;
    ctx2d.shadowBlur = matched ? 18 : 6;
    if (matched) {
      ctx2d.globalAlpha = 0.82 + 0.18 * Math.sin(ts * 0.004);
    } else {
      ctx2d.globalAlpha = 1;
    }
    ctx2d.strokeRect(box.x, box.y, box.width, box.height);
    ctx2d.shadowBlur = 0;
    ctx2d.globalAlpha = 1;

    const label = matched ? name : '新朋友';
    const fontSize = Math.max(14, Math.round(box.width / 8));
    ctx2d.font = `600 ${fontSize}px "Microsoft YaHei", sans-serif`;
    const tw = ctx2d.measureText(label).width + 18;
    const th = fontSize + 12;
    const ty = box.y - th > 0 ? box.y - th : box.y + box.height + 4;
    ctx2d.fillStyle = color;
    ctx2d.beginPath();
    if (typeof ctx2d.roundRect === 'function') {
      ctx2d.roundRect(box.x, ty, tw, th, 6);
    } else {
      ctx2d.rect(box.x, ty, tw, th);
    }
    ctx2d.fill();
    ctx2d.fillStyle = matched ? '#06281f' : '#1e2430';
    ctx2d.fillText(label, box.x + 9, ty + fontSize + 3);
  }

  // ---------------------------------------------------------------- 识别
  let strangerConfirm = 0; // 未录入脸连续出现帧数，达到阈值才提示，滤掉偶发误检

  async function runRecognition(ts) {
    const faces = await Vision.detectWithDescriptors(video, {
      scoreThreshold: state.cfg.detect_score_threshold,
    });
    if (!faces.length) {
      strangerConfirm = 0;
      return;
    }

    let matchedAny = false;
    for (const f of faces) {
      const match = Vision.matchDescriptor(f.descriptor, state.cfg.match_threshold);
      if (match) {
        matchedAny = true;
        drawFace(f.box, match.name, true, ts);
        maybeGreet(match.name, match.distance);
      } else {
        drawFace(f.box, null, false, ts);
      }
    }
    if (matchedAny) {
      strangerConfirm = 0;
    } else {
      // 手掌等被误检时通常只闪一帧，连续多帧仍未匹配才当陌生脸处理
      strangerConfirm++;
      const need = state.cfg.stranger_confirm_frames || 3;
      if (strangerConfirm >= need) {
        strangerConfirm = 0;
        maybeHintStranger();
      }
    }
  }

  // 语音串行队列，避免语音重叠；可随时清空（以数据采集为准，截断滞后的播报）
  let greetingChain = Promise.resolve();
  let voiceGeneration = 0; // 语音"代次"，clearGreetingQueue 时递增，旧队列项自动跳过
  function queueGreeting(text) {
    const gen = voiceGeneration;
    greetingChain = greetingChain
      .then(() => {
        if (gen !== voiceGeneration) return; // 队列已被清空，跳过本句
        return AudioService.speak(text);
      })
      .catch((e) => log('语音播报失败: ' + e.message));
  }
  function clearGreetingQueue() {
    voiceGeneration++;
    AudioService.stopSpeaking(); // 截断正在播放/合成中的句子
  }

  function maybeGreet(name, distance) {
    const now = Date.now();
    const last = state.greetCooldown.get(name) || 0;
    if (now - last < state.cfg.cooldown_seconds * 1000) return;
    state.greetCooldown.set(name, now);
    setStatus(`识别到：${name}（距离 ${distance.toFixed(2)}）`, 'recognizing');
    log(`👋 识别到 ${name}`);
    // 固定前缀「XXX，你好！」+ 随机寒暄后缀
    const prefix = (state.cfg.greeting_prefix || '{name}，你好！').replace('{name}', name);
    const suffixes = state.cfg.greeting_suffixes || ['见到你真高兴！'];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const greeting = prefix + suffix;
    log(`🗣 语音问候：${greeting}`);
    queueGreeting(greeting);
  }

  function maybeHintStranger() {
    const now = Date.now();
    const cd = (state.cfg.stranger_cooldown_seconds || 10) * 1000;
    if (now - state.strangerCooldown < cd) return;
    state.strangerCooldown = now;
    setStatus('检测到新朋友，可点击「开始训练」录入', 'idle');
    log('✨ 检测到未录入的人脸');
    queueGreeting(state.cfg.stranger_hint);
  }

  // ---------------------------------------------------------------- 训练文字引导
  // 短提示语（两三个字一句），跟随采集进度轮换，与人脸数据采集需求一致
  function guideNextPose(n) {
    const hints = state.cfg.train_pose_hints || ['正对镜头', '转头', '眨眼', '张嘴', '远一点', '近一点'];
    const guide = hints[n - 1] || hints[hints.length - 1];
    progressHint.textContent = `采集 ${n}/${state.cfg.sample_count}，${guide}`;
    // 短句语音按间隔播报，避免每张都念
    speakShort(guide);
  }

  // 按最短间隔播报一条短语音（用于训练引导，不拖慢采集流程）
  function speakShort(text) {
    const now = Date.now();
    const interval = (state.cfg.voice_hint_interval || 2.5) * 1000;
    if (now - lastVoiceHintAt >= interval) {
      lastVoiceHintAt = now;
      queueGreeting(text);
    }
  }

  // ---------------------------------------------------------------- 训练采集
  async function runTrainingSample() {
    // 画面还没出帧（第二次开启摄像头时常见），给出明确提示而不是误报“无人脸”
    if (!state.cameraOn || video.readyState < 2 || !video.videoWidth) {
      progressHint.textContent = '正在打开摄像头画面，请稍候…';
      return;
    }
    const faces = await Vision.detectWithDescriptors(video, {
      scoreThreshold: state.cfg.detect_score_threshold,
    });
    if (!faces.length) {
      progressHint.textContent = '未检测到人脸，请正对摄像头';
      return;
    }
    const face = faces.reduce((a, b) => (a.box.width > b.box.width ? a : b));
    drawFace(face.box, `样本 ${state.trainDescriptors.length}`, true, performance.now());
    if (face.box.width < state.cfg.min_face_size) {
      progressHint.textContent = '请靠近一些，让脸部占满画面';
      speakShort('近一点');
      return;
    }
    if (face.box.width > state.cfg.max_face_size) {
      progressHint.textContent = '请离远一点，让脸部完整入画';
      speakShort('远一点');
      return;
    }
    const now = performance.now();
    if (now - state.lastSampleAt >= state.cfg.sample_interval * 1000) {
      state.lastSampleAt = now;
      state.trainDescriptors.push(face.descriptor);
      updateProgress();
      const n = state.trainDescriptors.length;
      progressHint.textContent = `采集 ${n}/${state.cfg.sample_count}，请轻微变换角度`;
      guideNextPose(n);
      if (n >= state.cfg.sample_count) {
        finishCollecting();
      }
    }
  }

  function updateProgress() {
    const n = state.trainDescriptors.length;
    const total = state.cfg.sample_count;
    progressText.textContent = `${n} / ${total}`;
    const frac = Math.min(1, n / total);
    ringBar.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - frac);
  }

  function finishCollecting() {
    state.collecting = false;
    progressOverlay.classList.add('hidden');
    trainSection.classList.remove('hidden');
    nameInput.value = '';
    btnSaveName.disabled = true;
    setStatus('请说出或输入你的名字', 'training');
    log('📸 人脸样本采集完成，请说出或输入名字');
    // 以数据采集为准：截断尚未播完的训练引导，直接提示输入姓名
    clearGreetingQueue();
    queueGreeting(state.cfg.collect_done_hint);
    nameInput.focus();
  }

  // ---------------------------------------------------------------- 语音录名
  async function recordName() {
    if (state.mode !== 'training') return;
    btnVoiceName.disabled = true;
    voiceStatus.textContent = '录音中…请说出你的名字';
    voiceStatus.className = 'voice-status recording';
    try {
      const pcm = await AudioService.record({
        maxSeconds: state.cfg.record_max_seconds,
        silenceSeconds: state.cfg.silence_seconds,
      });
      voiceStatus.textContent = '语音识别中…';
      const text = await Api.transcribe(pcm);
      if (text) {
        nameInput.value = text;
        btnSaveName.disabled = false;
        voiceStatus.textContent = `听到：「${text}」`;
        voiceStatus.className = 'voice-status ok';
        log(`🎤 语音识别到名字：${text}`);
      } else {
        voiceStatus.textContent = '没听清，请再说一次或直接输入';
        voiceStatus.className = 'voice-status warn';
      }
    } catch (e) {
      voiceStatus.textContent = '录音失败：' + e.message;
      voiceStatus.className = 'voice-status warn';
    } finally {
      btnVoiceName.disabled = false;
    }
  }

  // ---------------------------------------------------------------- 保存人员
  async function savePerson() {
    const name = nameInput.value.trim();
    if (!name) return;
    btnSaveName.disabled = true;
    try {
      const descriptors = state.trainDescriptors.map((d) => Array.from(d));
      let res = await Api.addFace(name, descriptors, false);
      if (res.conflict) {
        const ok = window.confirm(`已存在同名人员「${res.existing.name}」，是否覆盖？`);
        if (!ok) {
          btnSaveName.disabled = false;
          return;
        }
        res = await Api.addFace(name, descriptors, true);
      }
      if (res.error) throw new Error(res.error);
      log(`💾 已保存 ${name}（${descriptors.length} 张样本）`);
      setStatus(`录入成功：${name}`, 'success');
      clearGreetingQueue();
      queueGreeting((state.cfg.saved_hint || '好的，{name}，我记住你了！').replace('{name}', name));
      await refreshPeople();
      finishTraining();
    } catch (e) {
      log('保存失败: ' + e.message);
      btnSaveName.disabled = false;
    }
  }

  // ---------------------------------------------------------------- 人员列表
  async function refreshPeople() {
    await Vision.refreshPeople();
    const people = Vision.getPeople();
    peopleList.innerHTML = '';
    if (!people.length) {
      peopleList.innerHTML = '<li class="empty-tip">暂无已录入人员</li>';
      return;
    }
    for (const p of people) {
      const li = document.createElement('li');
      li.className = 'person-item';
      const avatar = document.createElement('div');
      avatar.className = 'person-avatar';
      avatar.textContent = (p.name || '?')[0];
      const meta = document.createElement('div');
      meta.className = 'person-meta';
      const nm = document.createElement('div');
      nm.className = 'person-name';
      nm.textContent = p.name;
      const sp = document.createElement('div');
      sp.className = 'person-samples';
      sp.textContent = `${p.samples || (p.descriptors ? p.descriptors.length : 0)} 张样本`;
      meta.append(nm, sp);
      const del = document.createElement('button');
      del.className = 'person-del';
      del.textContent = '✕';
      del.title = '删除此人';
      del.onclick = async () => {
        if (!window.confirm(`确认删除「${p.name}」？`)) return;
        try {
          await Api.deleteFace(p.id);
          log(`🗑 已删除 ${p.name}`);
          await refreshPeople();
        } catch (e) {
          log('删除失败: ' + e.message);
        }
      };
      li.append(avatar, meta, del);
      peopleList.appendChild(li);
    }
  }

  // ---------------------------------------------------------------- 模式切换
  async function startTraining() {
    if (state.mode === 'recognizing') cancelTraining();
    const ok = await startCamera();
    if (!ok) return;
    state.mode = 'training';
    setModeBadge('training');
    state.collecting = true;
    state.trainDescriptors = [];
    state.lastSampleAt = 0;
    lastVoiceHintAt = 0;
    frameCount = 0;
    busy = false;
    btnTrain.disabled = true;
    btnRecognize.disabled = true;
    btnStop.classList.remove('hidden');
    trainSection.classList.add('hidden');
    progressOverlay.classList.remove('hidden');
    updateProgress();
    progressHint.textContent = '请正对摄像头…';
    setStatus('正在采集人脸样本…', 'training');
    log('🎯 开始训练：请正对摄像头');
    clearGreetingQueue();
    queueGreeting(state.cfg.train_start_hint);
    startLoopIfNeeded();
  }

  async function startRecognizing() {
    clearGreetingQueue();
    if (state.mode === 'training') cancelTraining();
    const ok = await startCamera();
    if (!ok) return;
    state.mode = 'recognizing';
    setModeBadge('recognizing');
    frameCount = 0;
    busy = false;
    btnTrain.disabled = false;
    btnRecognize.disabled = true;
    btnStop.classList.remove('hidden');
    trainSection.classList.add('hidden');
    progressOverlay.classList.add('hidden');
    setStatus('正在识别…', 'recognizing');
    log('👋 开始识别模式');
    startLoopIfNeeded();
  }

  function cancelTraining() {
    state.mode = 'idle';
    setModeBadge('idle');
    state.collecting = false;
    trainSection.classList.add('hidden');
    progressOverlay.classList.add('hidden');
    stopAllControls();
    stopCamera();
    stopLoop();
    setStatus('系统就绪', 'idle');
  }

  function finishTraining() {
    cancelTraining();
    log('✅ 训练流程完成');
  }

  function stopAll() {
    clearGreetingQueue();
    state.mode = 'idle';
    setModeBadge('idle');
    state.collecting = false;
    trainSection.classList.add('hidden');
    progressOverlay.classList.add('hidden');
    stopAllControls();
    stopCamera();
    stopLoop();
    setStatus('系统就绪', 'idle');
    log('⏹ 已停止');
  }

  function stopAllControls() {
    btnTrain.disabled = false;
    btnRecognize.disabled = false;
    btnStop.classList.add('hidden');
  }

  // ---------------------------------------------------------------- 视频循环
  function startLoopIfNeeded() {
    if (!rafId) rafId = requestAnimationFrame(videoLoop);
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  async function videoLoop(ts) {
    rafId = requestAnimationFrame(videoLoop);
    if (!state.cameraOn || !video.readyState) return;
    ensureCanvasSize();
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    if (busy) return;
    busy = true;
    try {
      frameCount++;
      if (frameCount % 2 !== 0) return;
      if (state.mode === 'recognizing') {
        await runRecognition(ts);
      } else if (state.mode === 'training' && state.collecting) {
        await runTrainingSample();
      }
    } catch (e) {
      log('识别帧错误: ' + e.message);
    } finally {
      busy = false;
    }
  }

  // ---------------------------------------------------------------- 事件绑定
  btnTrain.addEventListener('click', startTraining);
  btnRecognize.addEventListener('click', startRecognizing);
  btnStop.addEventListener('click', stopAll);
  btnCancelTrain.addEventListener('click', () => {
    clearGreetingQueue();
    cancelTraining();
    log('↩ 已取消训练');
  });
  btnVoiceName.addEventListener('click', recordName);
  btnSaveName.addEventListener('click', savePerson);
  nameInput.addEventListener('input', () => {
    btnSaveName.disabled = !nameInput.value.trim();
  });
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && nameInput.value.trim()) savePerson();
  });

  // ---------------------------------------------------------------- 初始化
  async function init() {
    try {
      state.cfg = Object.assign(state.cfg, await Api.getConfig());
    } catch (e) {
      log('读取配置失败，使用默认参数');
    }
    try {
      await Vision.loadModels();
      log('🧠 人脸识别模型就绪');
    } catch (e) {
      log('模型加载失败：' + e.message);
    }
    try {
      await refreshPeople();
    } catch (e) {
      log('读取人员列表失败：' + e.message);
    }
    setStatus('系统就绪', 'idle');
    log('🚀 人脸记忆已启动');
  }

  init();
})();
