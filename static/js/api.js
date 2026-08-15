/* API 封装：与 Python 本地服务交互 */
const Api = {
  async _request(url, options = {}) {
    const resp = await fetch(url, options);
    if (!resp.ok) {
      const detail = await resp.text().catch(() => resp.statusText);
      throw new Error(`请求失败 ${resp.status}: ${detail}`);
    }
    return resp;
  },

  // 特征库
  async getFaces() {
    const resp = await this._request('/api/faces');
    return (await resp.json()).people || [];
  },

  async addFace(name, descriptors, force = false) {
    const resp = await this._request('/api/faces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, descriptors, force }),
    });
    return resp.json();
  },

  async deleteFace(id) {
    await this._request(`/api/faces/${id}`, { method: 'DELETE' });
  },

  // 语音识别：上传 16kHz 单声道 float32 裸 PCM
  async transcribe(pcmBuffer) {
    const resp = await this._request('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: pcmBuffer,
    });
    return (await resp.json()).text || '';
  },

  // 语音合成：文本 -> WAV blob
  async tts(text) {
    const resp = await this._request('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return resp.blob();
  },

  // 随机热情问候文案
  async greeting(name) {
    const resp = await this._request(`/api/greeting?name=${encodeURIComponent(name)}`);
    return (await resp.json()).text;
  },

  // 服务端可调参数
  async getConfig() {
    const resp = await this._request('/api/config');
    return resp.json();
  },
};
