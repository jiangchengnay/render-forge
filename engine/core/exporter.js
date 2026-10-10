// engine/core/exporter.js
// WebCodecs 导出：canvas -> VideoFrame -> VideoEncoder -> muxer -> mp4/webm
// 可选音轨：音频文件 -> decodeAudioData -> AudioEncoder(AAC/Opus) -> muxer
(function (RF) {
  // muxer 路径（从页面根解析）
  function muxerUrl(name) {
    var base = "";
    try { base = new URL("vendor/" + name, location.href).href; } catch (e) { base = "vendor/" + name; }
    return base;
  }

  async function detectCodecs() {
    if (typeof VideoEncoder === "undefined") return { available: false };
    const out = { available: true, codecs: {} };
    const list = [
      { codec: "avc1.640028", name: "h264-high", ext: "mp4" },
      { codec: "avc1.4D401F", name: "h264-main", ext: "mp4" },
      { codec: "vp09.00.10.08", name: "vp9", ext: "webm" },
      { codec: "av01.0.04M.08", name: "av1", ext: "mp4" },
    ];
    for (const c of list) {
      try {
        const s = await VideoEncoder.isConfigSupported({ codec: c.codec, width: 1080, height: 1080, bitrate: 8000000 });
        out.codecs[c.name] = { codec: c.codec, ext: c.ext, supported: s.supported };
      } catch (e) { out.codecs[c.name] = { supported: false, error: e.message }; }
    }
    return out;
  }

  async function pickBest(w, h, fps, bitrate) {
    if (typeof VideoEncoder === "undefined") return null;
    const candidates = [
      { codec: "avc1.640028", container: "mp4" },
      { codec: "avc1.4D401F", container: "mp4" },
      { codec: "avc1.42E01E", container: "mp4" },
      { codec: "vp09.00.10.08", container: "webm" },
      { codec: "av01.0.04M.08", container: "mp4" },
    ];
    for (const c of candidates) {
      try {
        const cfg = { codec: c.codec, width: w, height: h, bitrate: bitrate || 8000000, framerate: fps || 30 };
        const s = await VideoEncoder.isConfigSupported(cfg);
        if (s.supported) return Object.assign({}, c, { config: cfg });
      } catch (e) {}
    }
    return null;
  }

  // 解码音频文件为 AudioBuffer
  async function decodeAudio(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("音频加载失败: HTTP " + res.status);
    const buf = await res.arrayBuffer();
    const AC = window.AudioContext || window.webkitAudioContext;
    const actx = new AC();
    try {
      return await actx.decodeAudioData(buf.slice(0));
    } finally {
      await actx.close();
    }
  }

  // 把 AudioBuffer 编成 AAC(mp4)/Opus(webm) 并写入 muxer
  async function encodeAudioTrack(muxer, audioBuffer, container) {
    if (typeof AudioEncoder === "undefined") throw new Error("AudioEncoder 不可用");
    const sampleRate = audioBuffer.sampleRate;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const codec = container === "webm" ? "opus" : "mp4a.40.2";
    const errors = [];
    const encoder = new AudioEncoder({
      output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta); } catch (e) { errors.push("amux:" + e.message); } },
      error: (e) => { errors.push("aenc:" + e.message); },
    });
    encoder.configure({ codec, sampleRate, numberOfChannels, bitrate: 128000 });

    const frameSize = 1024;
    const length = audioBuffer.length;
    const chans = [];
    for (let c = 0; c < numberOfChannels; c++) chans.push(audioBuffer.getChannelData(c));
    for (let offset = 0; offset < length; offset += frameSize) {
      const n = Math.min(frameSize, length - offset);
      const planar = new Float32Array(n * numberOfChannels);
      for (let c = 0; c < numberOfChannels; c++) planar.set(chans[c].subarray(offset, offset + n), c * n);
      const data = new AudioData({
        format: "f32-planar", sampleRate, numberOfFrames: n, numberOfChannels,
        timestamp: Math.round((offset / sampleRate) * 1e6), data: planar,
      });
      encoder.encode(data);
      data.close();
      if (encoder.encodeQueueSize > 20) await new Promise((r) => setTimeout(r, 0));
    }
    await encoder.flush();
    encoder.close();
    return { sampleRate, numberOfChannels, codec, errors };
  }

  async function exportVideo(opts) {
    const rt = opts.runtime || window.__rf_runtime;
    if (!rt) throw new Error("no runtime");
    const fps = opts.fps || 30;
    const W = rt.canvas.width, H = rt.canvas.height;
    const bitrate = opts.bitrate || Math.round(W * H * fps * 0.12);
    const targetDur = opts.targetDuration != null ? opts.targetDuration : rt.duration;
    const totalFrames = Math.max(1, Math.round(targetDur * fps));

    let chosen = null;
    if (opts.codec && opts.container) {
      chosen = { codec: opts.codec, container: opts.container, config: { codec: opts.codec, width: W, height: H, bitrate, framerate: fps } };
    } else {
      chosen = await pickBest(W, H, fps, bitrate);
    }
    if (!chosen) throw new Error("无可用编码器");

    // 先解码音频（拿到采样率/声道数才能建 muxer）
    let audioBuffer = null;
    if (opts.audioUrl) audioBuffer = await decodeAudio(opts.audioUrl);

    let muxer, bufferTarget;
    if (chosen.container === "mp4") {
      const url = opts.muxerUrl || muxerUrl("mp4-muxer.mjs");
      const mod = await import(url);
      bufferTarget = new mod.ArrayBufferTarget();
      const mopts = { target: bufferTarget, video: { codec: "avc", width: W, height: H }, fastStart: "in-memory" };
      if (audioBuffer) mopts.audio = { codec: "aac", numberOfChannels: audioBuffer.numberOfChannels, sampleRate: audioBuffer.sampleRate };
      muxer = new mod.Muxer(mopts);
    } else {
      const url = opts.muxerUrl || muxerUrl("webm-muxer.mjs");
      const mod = await import(url);
      bufferTarget = new mod.ArrayBufferTarget();
      const mopts = { target: bufferTarget, video: { codec: "V_VP9", width: W, height: H, frameRate: fps } };
      if (audioBuffer) mopts.audio = { codec: "A_OPUS", numberOfChannels: audioBuffer.numberOfChannels, sampleRate: audioBuffer.sampleRate };
      muxer = new mod.Muxer(mopts);
    }

    let frameCount = 0;
    const encodeErrors = [];
    const encoder = new VideoEncoder({
      output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta); } catch (e) { encodeErrors.push("mux:" + e.message); } },
      error: (e) => { encodeErrors.push("enc:" + e.message); },
    });
    encoder.configure(chosen.config);

    const t0 = performance.now();
    const keyInterval = fps * 2;
    for (let i = 0; i < totalFrames; i++) {
      rt.seek(Math.min(i / fps, rt.duration - 1e-3));
      const frame = new VideoFrame(rt.canvas, { timestamp: Math.round((i / fps) * 1e6), duration: Math.round(1e6 / fps) });
      encoder.encode(frame, { keyFrame: (i % keyInterval) === 0 });
      frame.close();
      frameCount++;
      if (encoder.encodeQueueSize > 30) await new Promise((r) => setTimeout(r, 0));
      if (opts.onProgress && i % 30 === 0) opts.onProgress({ frame: i, total: totalFrames, pct: Math.round((i / totalFrames) * 100) });
    }
    await encoder.flush();
    encoder.close();

    // 音轨（视频编码完成后写入；muxer 按时间戳自行交织）
    let audioInfo = null;
    if (audioBuffer) {
      audioInfo = await encodeAudioTrack(muxer, audioBuffer, chosen.container);
      if (audioInfo.errors && audioInfo.errors.length) encodeErrors.push.apply(encodeErrors, audioInfo.errors);
    }

    muxer.finalize();

    const totalMs = performance.now() - t0;
    const buffer = bufferTarget.buffer;
    if (encodeErrors.length) console.warn("[RF Export] 警告:", encodeErrors.slice(0, 5));
    return {
      blob: new Blob([buffer]), buffer, container: chosen.container, codec: chosen.codec,
      frames: frameCount, bytes: buffer.byteLength, totalMs, msPerFrame: totalMs / frameCount,
      audio: audioInfo ? { codec: audioInfo.codec, sampleRate: audioInfo.sampleRate, channels: audioInfo.numberOfChannels } : null,
    };
  }

  RF.Exporter = { detectCodecs, pickBest, exportVideo, decodeAudio };
})(window.RF = window.RF || {});
