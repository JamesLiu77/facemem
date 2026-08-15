/* 人脸引擎：封装 face-api.js 的模型加载、检测、特征提取与匹配 */
const Vision = (() => {
  let modelsLoaded = false;
  let loadingPromise = null;
  let cachedPeople = [];

  async function loadModels() {
    if (modelsLoaded) return true;
    if (loadingPromise) return loadingPromise;
    loadingPromise = (async () => {
      if (!window.faceapi) {
        throw new Error('face-api.js 未加载，请检查 static/js/vendor/face-api.min.js 是否存在');
      }
      const modelUri = '/models';
      await faceapi.nets.tinyFaceDetector.loadFromUri(modelUri);
      await faceapi.nets.faceLandmark68Net.loadFromUri(modelUri);
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelUri);
      modelsLoaded = true;
      return true;
    })().finally(() => { loadingPromise = null; });
    return loadingPromise;
  }

  async function refreshPeople() {
    cachedPeople = await Api.getFaces();
    return cachedPeople;
  }

  function getPeople() {
    return cachedPeople;
  }

  /**
   * 68 关键点几何校验，过滤手掌、玩偶等被误检为"脸"的物体。
   * 只保留最稳定的人脸结构约束（眼睛在嘴上方、眼距/嘴宽比例），
   * 避免低头、仰头、侧脸时误伤真实人脸。
   */
  function isFaceLike(landmarks) {
    const pts = landmarks && landmarks.positions;
    if (!pts || pts.length < 68) return false;
    const leftEye = pts[36];
    const rightEye = pts[45];
    const mouthLeft = pts[48];
    const mouthRight = pts[54];
    if (!leftEye || !rightEye || !mouthLeft || !mouthRight) return false;
    // 眼睛中心必须位于嘴上方（正常人脸 y 坐标小于嘴）
    const eyeY = (leftEye.y + rightEye.y) / 2;
    const mouthY = (mouthLeft.y + mouthRight.y) / 2;
    if (eyeY >= mouthY) return false;
    // 眼距 / 嘴宽 比例：正常人脸约 0.8~1.6，放宽范围以容纳姿态与距离变化
    const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
    const mouthWidth = Math.hypot(mouthLeft.x - mouthRight.x, mouthLeft.y - mouthRight.y);
    if (eyeDist < 1 || mouthWidth < 1) return false;
    const ratio = eyeDist / mouthWidth;
    if (ratio < 0.35 || ratio > 3) return false;
    return true;
  }

  async function detectWithDescriptors(input, opts = {}) {
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: opts.inputSize || 416,
      scoreThreshold: opts.scoreThreshold != null ? opts.scoreThreshold : 0.3,
      minFaceSize: opts.minFaceSize || 40,
    });
    const results = await faceapi
      .detectAllFaces(input, options)
      .withFaceLandmarks()
      .withFaceDescriptors();
    return results
      .filter((r) => isFaceLike(r.landmarks))
      .map((r) => ({
        box: r.detection.box,
        score: r.detection.score,
        descriptor: r.descriptor,
        landmarks: r.landmarks.positions,
      }));
  }

  function distance(a, b) {
    return faceapi.euclideanDistance(a, b);
  }

  function matchDescriptor(descriptor, threshold = 0.5) {
    let best = null;
    for (const person of cachedPeople) {
      if (!person.descriptors || !person.descriptors.length) continue;
      for (const d of person.descriptors) {
        const dist = distance(descriptor, new Float32Array(d));
        if (!best || dist < best.distance) {
          best = { name: person.name, person, distance: dist };
        }
      }
    }
    if (best && best.distance <= threshold) return best;
    return null;
  }

  return {
    loadModels,
    refreshPeople,
    getPeople,
    detectWithDescriptors,
    matchDescriptor,
    distance,
  };
})();
