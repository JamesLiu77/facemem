/* 音频模块：WebAudio 录音（16kHz 单声道 Float32 PCM）与 WAV 播放 */
const AudioService = (() => {
  const TARGET_RATE = 16000;
  const VOICE_LEVEL = 0.02; // 认为"有人说话"的音量阈值

  /**
   * 录制一段语音。
   * @returns {Promise<ArrayBuffer>} 16kHz 单声道 float32 LE 裸 PCM
   */
  async function record({ maxSeconds = 5, silenceSeconds = 0.8 } = {}) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('当前浏览器不支持麦克风录音');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const rate = ctx.sampleRate;
    const ratio = rate / TARGET_RATE;

    let samples = [];          // 16k 降采样后的数据
    let hasSpeech = false;
    let lastVoiceAt = 0;
    let finished = false;

    const processorNode = processor;

    return await new Promise((resolve, reject) => {
      const cleanup = () => {
        finished = true;
        try { processorNode.disconnect(); } catch (_) {}
        try { source.disconnect(); } catch (_) {}
        try { ctx.close(); } catch (_) {}
        stream.getTracks().forEach((t) => t.stop());
      };

      const finish = () => {
        if (finished) return;
        cleanup();
        const buf = new Float32Array(samples);
        // 转为小端 float32 ArrayBuffer
        const ab = new ArrayBuffer(buf.length * 4);
        new Float32Array(ab).set(buf);
        resolve(ab);
      };

      const fail = (err) => {
        if (finished) return;
        cleanup();
        reject(err);
      };

      processorNode.onaudioprocess = (e) => {
        if (finished) return;
        const input = e.inputBuffer.getChannelData(0);
        for (let i = 0; i < input.length; i += ratio) {
          const idx = Math.floor(i);
          if (idx >= input.length) break;
          const s = input[idx];
          samples.push(s);
          if (Math.abs(s) > VOICE_LEVEL) {
            hasSpeech = true;
            lastVoiceAt = samples.length / TARGET_RATE;
          }
        }
        const now = samples.length / TARGET_RATE;
        if (now >= maxSeconds) finish();
        else if (hasSpeech && now - lastVoiceAt >= silenceSeconds) finish();
      };

      processorNode.connect(ctx.destination); // 触发 onaudioprocess（输出保持静音，无回音）
      source.connect(processorNode);
    });
  }

  /** 播放一段语音 blob（MP3），可被 stopSpeaking 随时截断 */
  let currentAudio = null;
  let speakToken = 0;

  async function playBlob(blob) {
    if (!blob || !blob.size) throw new Error('没有可播放的音频');
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    try {
      await new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        audio.onended = finish;
        audio.onerror = finish;
        audio.onpause = finish; // 被 stopSpeaking() 截断时也能尽快放行队列
        audio.play().catch(finish);
      });
    } finally {
      if (currentAudio === audio) currentAudio = null;
      URL.revokeObjectURL(url);
    }
  }

  /** 立即停止正在播放的语音，并作废仍在合成中的句子（用于以数据采集为准的截断） */
  function stopSpeaking() {
    speakToken++;
    if (currentAudio) {
      try { currentAudio.pause(); } catch (_) {}
      try { currentAudio.currentTime = 0; } catch (_) {}
    }
  }

  /** 合成并播放一句话；被 stopSpeaking() 打断后自动放弃 */
  async function speak(text) {
    const token = ++speakToken;
    const blob = await Api.tts(text);
    if (token !== speakToken) return; // 合成期间已被新语音取代，直接丢弃
    await playBlob(blob);
  }

  return { record, playBlob, speak, stopSpeaking };
})();
