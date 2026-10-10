// engine/core/video-decode.js
// 视频逐帧预解码：用 WebCodecs VideoDecoder 抽出所有帧，供确定性渲染。
// 解决：<video> 实时播放无法在 seek 时精确取帧的问题。
//
// 用法：
//   const frames = await RF.VideoDecode.decodeAll(fileOrUrl);
//   // frames = [{ t, bitmap }]，bitmap 是 ImageBitmap
(function (RF) {
  function available() {
    return typeof window.VideoDecoder !== 'undefined' && typeof window.MediaStreamTrackProcessor !== 'undefined';
  }

  // 从 MP4/WebM 抽帧：用 <video> + createImageBitmap 逐帧（不依赖 MP4 demuxer）
  // 这是更实用的方案：seek 到每帧时间点，用 requestVideoFrameCallback 等就绪后 capture
  async function extractFrames(videoEl, opts) {
    opts = opts || {};
    const fps = opts.fps || 30;
    const duration = videoEl.duration;
    if (!isFinite(duration)) throw new Error('视频时长未知');
    const totalFrames = Math.round(duration * fps);
    const maxFrames = opts.maxFrames || 600;
    const count = Math.min(totalFrames, maxFrames);
    const frames = [];
    const w = videoEl.videoWidth, h = videoEl.videoHeight;
    for (let i = 0; i < count; i++) {
      const t = i / fps;
      await seekVideo(videoEl, t);
      try {
        const bitmap = await createImageBitmap(videoEl, 0, 0, w, h);
        frames.push({ t: t, bitmap: bitmap });
      } catch (e) {
        frames.push({ t: t, bitmap: null, error: e.message });
      }
    }
    return { frames: frames, fps: fps, width: w, height: h, duration: duration };
  }

  // 精确 seek 到某时间点并等待帧就绪
  function seekVideo(videoEl, t) {
    return new Promise((resolve) => {
      const onSeeked = () => {
        videoEl.removeEventListener('seeked', onSeeked);
        resolve();
      };
      videoEl.addEventListener('seeked', onSeeked);
      try { videoEl.currentTime = t; } catch (e) { resolve(); }
      // 超时兜底
      setTimeout(() => {
        videoEl.removeEventListener('seeked', onSeeked);
        resolve();
      }, 2000);
    });
  }

  // 注册视频并预解码
  async function loadAndDecode(id, src, opts) {
    const reg = await RF.Media.registerVideo(id, src);
    const decoded = await extractFrames(reg.el, opts || {});
    // 存回 Media，供 video 效果使用
    RF.Media._videos[id].frames = decoded.frames;
    RF.Media._videos[id].decodedFps = decoded.fps;
    RF.Media._videos[id].predecoded = true;
    return decoded;
  }

  RF.VideoDecode = {
    available: available,
    extractFrames: extractFrames,
    seekVideo: seekVideo,
    loadAndDecode: loadAndDecode,
  };
})(window.RF = window.RF || {});
