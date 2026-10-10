// engine/core/audio.js
// 音频分析与节拍检测。零依赖：自实现 FFT + 谱通量 + 峰值检测 + 分频段 + 段落 + VAD。
(function (RF) {
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; const t2 = im[i]; im[i] = im[j]; im[j] = t2; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k];
          const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
          const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi;
          re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = ncr;
        }
      }
    }
  }

  function normalizeArr(arr) {
    let max = 0;
    for (let i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i];
    if (max <= 0) return;
    for (let i = 0; i < arr.length; i++) arr[i] = arr[i] / max;
  }

  function median(arr) {
    if (!arr.length) return 0;
    const sorted = Array.from(arr).sort((a, b) => a - b);
    const m = sorted.length >> 1;
    return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
  }

  function analyzeChannel(channel, sampleRate, opts) {
    opts = opts || {};
    const frameSize = opts.frameSize || 2048;
    const hopSize = opts.hopSize || 512;
    const N = channel.length;
    const numFrames = Math.max(0, Math.floor((N - frameSize) / hopSize) + 1);
    const rms = new Float32Array(numFrames);
    const flux = new Float32Array(numFrames);
    const energy = new Float32Array(numFrames);
    const bass = new Float32Array(numFrames);
    const mid = new Float32Array(numFrames);
    const treble = new Float32Array(numFrames);
    const halfN = frameSize / 2;
    const hzToBin = (hz) => Math.round(hz * frameSize / sampleRate);
    const bassEnd = Math.min(halfN, hzToBin(250));
    const midEnd = Math.min(halfN, hzToBin(4000));
    const win = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) win[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (frameSize - 1)));
    let prevMag = new Float32Array(halfN);
    for (let f = 0; f < numFrames; f++) {
      const off = f * hopSize;
      const re = new Float32Array(frameSize);
      const im = new Float32Array(frameSize);
      let sumSq = 0;
      for (let i = 0; i < frameSize; i++) { const v = channel[off + i] * win[i]; re[i] = v; sumSq += v * v; }
      rms[f] = Math.sqrt(sumSq / frameSize);
      fft(re, im);
      const mag = new Float32Array(halfN);
      for (let i = 0; i < halfN; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
      let eB = 0, eM = 0, eT = 0, eAll = 0;
      for (let i = 1; i < halfN; i++) {
        const p = mag[i] * mag[i];
        eAll += p;
        if (i <= bassEnd) eB += p; else if (i <= midEnd) eM += p; else eT += p;
      }
      bass[f] = eB; mid[f] = eM; treble[f] = eT; energy[f] = eAll;
      let fl = 0;
      for (let i = 0; i < halfN; i++) { const d = mag[i] - prevMag[i]; if (d > 0) fl += d; }
      flux[f] = fl;
      prevMag = mag;
    }
    normalizeArr(flux); normalizeArr(energy); normalizeArr(bass); normalizeArr(mid); normalizeArr(treble);
    const onsets = [];
    const winLen = opts.peakWindow || 20;
    const factor = opts.peakFactor || 1.5;
    for (let i = 1; i < flux.length - 1; i++) {
      let sum = 0, cnt = 0;
      for (let k = Math.max(0, i - winLen); k < Math.min(flux.length, i + winLen); k++) { sum += flux[k]; cnt++; }
      const th = (sum / cnt) * factor + 0.05;
      if (flux[i] > th && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1]) {
        const t = (i * hopSize) / sampleRate;
        const minInterval = opts.minInterval || 0.15;
        if (!onsets.length || t - onsets[onsets.length - 1].t >= minInterval) onsets.push({ t, strength: flux[i] });
      }
    }
    let tempo = 0;
    let downbeats = [];
    if (flux.length > 64) {
      const minLag = Math.max(2, Math.floor((60 / 200) / (hopSize / sampleRate)));
      const maxLag = Math.min(Math.floor(flux.length / 2), Math.ceil((60 / 60) / (hopSize / sampleRate)));
      let mean = 0; for (let i = 0; i < flux.length; i++) mean += flux[i]; mean /= flux.length;
      const centered = new Float32Array(flux.length);
      for (let i = 0; i < flux.length; i++) centered[i] = flux[i] - mean;
      let bestLag = 0, bestCorr = -Infinity;
      for (let lag = minLag; lag <= maxLag; lag++) {
        let corr = 0, norm = 0;
        for (let i = 0; i < flux.length - lag; i++) { corr += centered[i] * centered[i + lag]; norm += centered[i] * centered[i]; }
        const nc = norm > 0 ? corr / norm : 0;
        if (nc > bestCorr) { bestCorr = nc; bestLag = lag; }
      }
      if (bestLag > 0) { tempo = 60 / (bestLag * hopSize / sampleRate); while (tempo < 60) tempo *= 2; while (tempo > 200) tempo /= 2; }
    }
    if (tempo > 0 && onsets.length >= 4) {
      const period = 60 / tempo;
      const anchor = onsets[0].t;
      const bs = {};
      onsets.forEach((o) => { const bi = Math.round((o.t - anchor) / period); bs[bi] = (bs[bi] || 0) + (o.strength || 1); });
      const idxs = Object.keys(bs).map(Number).sort((a, b) => a - b);
      for (let i = 0; i < idxs.length; i += 4) {
        let best = idxs[i], bestS = bs[idxs[i]] || 0;
        for (let k = 1; k < 4 && i + k < idxs.length; k++) { const s = bs[idxs[i + k]] || 0; if (s > bestS) { bestS = s; best = idxs[i + k]; } }
        downbeats.push(anchor + best * period);
      }
    }
    const duration = N / sampleRate;
    const hopDuration = hopSize / sampleRate;
    const beats = [];
    if (tempo > 0) {
      const period = 60 / tempo;
      let t = onsets.length ? onsets[0].t : 0;
      while (t - period >= 0) t -= period;
      while (t <= duration) { if (t >= 0) beats.push(t); t += period; }
    }
    const sections = detectSections(energy, numFrames, hopDuration, duration);
    return {
      duration, sampleRate, tempo,
      onsets: onsets.map((o) => o.t),
      onsetStrengths: onsets.map((o) => o.strength),
      beats, downbeats,
      rms: Array.from(rms), flux: Array.from(flux), energy: Array.from(energy),
      bands: { bass: Array.from(bass), mid: Array.from(mid), treble: Array.from(treble) },
      sections, hopDuration,
    };
  }

  function detectSections(energy, numFrames, hopDuration, duration) {
    const sections = [];
    if (!energy.length || numFrames < 4) return sections;
    const winFrames = Math.max(1, Math.round(1.5 / hopDuration));
    const smooth = new Float32Array(numFrames);
    for (let i = 0; i < numFrames; i++) {
      let s = 0, c = 0;
      for (let k = Math.max(0, i - winFrames); k < Math.min(numFrames, i + winFrames); k++) { s += energy[k]; c++; }
      smooth[i] = s / c;
    }
    const med = median(smooth);
    const minFrames = Math.max(1, Math.round(0.8 / hopDuration));
    const labels = new Uint8Array(numFrames);
    for (let i = 0; i < numFrames; i++) labels[i] = smooth[i] > med ? 1 : 0;
    let runs = [];
    let cur = labels[0], start = 0;
    for (let i = 1; i <= numFrames; i++) {
      if (i === numFrames || labels[i] !== cur) { runs.push({ label: cur, start, end: i }); if (i < numFrames) { cur = labels[i]; start = i; } }
    }
    for (let i = 0; i < runs.length; i++) {
      if ((runs[i].end - runs[i].start) < minFrames) {
        if (i > 0) runs[i - 1].end = runs[i].end; else if (i + 1 < runs.length) runs[i + 1].start = runs[i].start;
      }
    }
    const merged = [];
    for (let i = 0; i < runs.length; i++) {
      if (merged.length && merged[merged.length - 1].label === runs[i].label) merged[merged.length - 1].end = runs[i].end;
      else merged.push({ label: runs[i].label, start: runs[i].start, end: runs[i].end });
    }
    for (let i = 1; i < merged.length; i++) merged[i].start = Math.max(merged[i].start, merged[i - 1].end);
    merged.forEach((r, i) => {
      const s = r.start * hopDuration;
      const e = Math.min(duration, r.end * hopDuration);
      if (e - s < 0.3) return;
      let type = 'unknown';
      if (r.label === 1) type = 'chorus';
      else { if (i === 0) type = 'intro'; else if (i === merged.length - 1) type = 'outro'; else type = 'verse'; }
      sections.push({ start: +s.toFixed(3), end: +e.toFixed(3), type, energy: r.label });
    });
    return sections;
  }

  function analyzeBuffer(audioBuffer, opts) {
    const ch0 = audioBuffer.getChannelData(0);
    let mono = ch0;
    if (audioBuffer.numberOfChannels > 1) {
      const ch1 = audioBuffer.getChannelData(1);
      mono = new Float32Array(ch0.length);
      for (let i = 0; i < ch0.length; i++) mono[i] = (ch0[i] + ch1[i]) * 0.5;
    }
    return analyzeChannel(mono, audioBuffer.sampleRate, opts);
  }

  async function decodeBlob(blob) {
    const arrayBuf = blob instanceof ArrayBuffer ? blob : await blob.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    try { const buf = await ctx.decodeAudioData(arrayBuf.slice(0)); await ctx.close(); return buf; }
    catch (e) { await ctx.close(); throw e; }
  }

  const _cache = new Map();
  function fileKey(f) {
    if (f && f.name) return f.name + ':' + (f.size || 0) + ':' + (f.lastModified || 0);
    return 'buf:' + (f && f.byteLength || 0);
  }
  async function analyzeFile(f, opts) {
    const key = fileKey(f);
    if (_cache.has(key)) return _cache.get(key);
    const buf = await decodeBlob(f);
    const result = analyzeBuffer(buf, opts);
    _cache.set(key, result);
    return result;
  }
  function clearCache() { _cache.clear(); }

  function beatAt(analysis, t) {
    if (!analysis || !analysis.beats.length) return -1;
    const beats = analysis.beats;
    let lo = 0, hi = beats.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (beats[mid] < t) lo = mid + 1; else hi = mid; }
    return lo;
  }

  function resolveTime(spec, analysis, fallback) {
    if (spec == null) return fallback != null ? fallback : 0;
    if (typeof spec === 'number') return spec;
    if (typeof spec === 'object' && spec.beat != null) {
      const beats = analysis && analysis.beats;
      if (beats && beats.length) { const idx = Math.max(0, Math.min(beats.length - 1, Math.floor(spec.beat) - 1)); return beats[idx] + (spec.offset || 0); }
      return (spec.beat - 1) * 0.5 + (spec.offset || 0);
    }
    if (typeof spec === 'string') {
      let m = spec.match(/^beat:([\d.]+)(?:([+-])([\d.]+))?$/);
      if (m) {
        const beatNum = parseFloat(m[1]);
        const sign = m[2] === '-' ? -1 : 1;
        const offset = m[3] ? sign * parseFloat(m[3]) : 0;
        return resolveTime({ beat: beatNum, offset }, analysis, fallback);
      }
      m = spec.match(/^phrase:(\d+)$/);
      if (m) { const idx = parseInt(m[1], 10) - 1; const v = analysis && analysis.vocal; if (v && v.phrases && v.phrases[idx]) return v.phrases[idx].start; return fallback != null ? fallback : 0; }
      m = spec.match(/^interlude:(\d+)$/);
      if (m) { const idx = parseInt(m[1], 10) - 1; const v = analysis && analysis.vocal; if (v && v.interludes && v.interludes[idx]) return v.interludes[idx].start; return fallback != null ? fallback : 0; }
      m = spec.match(/^section:([a-z]+)(?::(\d+))?$/);
      if (m) {
        const type = m[1];
        const idx = m[2] ? parseInt(m[2], 10) - 1 : 0;
        const secs = analysis && analysis.sections;
        if (secs && secs.length) {
          const matched = secs.filter((s) => s.type === type);
          if (matched[idx]) return matched[idx].start;
          if (matched[0]) return matched[0].start;
        }
        return fallback != null ? fallback : 0;
      }
    }
    const n = parseFloat(spec);
    return isNaN(n) ? (fallback != null ? fallback : 0) : n;
  }

  function sampleAt(analysis, arr, t) {
    if (!analysis || !arr || !arr.length) return 0;
    const hop = analysis.hopDuration || 1 / 60;
    const idx = Math.max(0, Math.min(arr.length - 1, Math.round(t / hop)));
    return arr[idx];
  }

  function inSection(analysis, t, type) {
    if (!analysis || !analysis.sections) return 0;
    for (const s of analysis.sections) { if (s.type === type && t >= s.start && t <= s.end) return 1; }
    return 0;
  }

  // ========== VAD（人声活动检测）==========
  function detectVocal(channel, sampleRate, opts) {
    opts = opts || {};
    const frameSize = opts.frameSize || 2048;
    const hopSize = opts.hopSize || 512;
    const N = channel.length;
    const numFrames = Math.max(0, Math.floor((N - frameSize) / hopSize) + 1);
    const rms = new Float32Array(numFrames);
    const win = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) win[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (frameSize - 1)));
    for (let f = 0; f < numFrames; f++) {
      const off = f * hopSize;
      let s = 0;
      for (let i = 0; i < frameSize; i++) { const v = channel[off + i] * win[i]; s += v * v; }
      rms[f] = Math.sqrt(s / frameSize);
    }
    // 自适应阈值：10 分位作噪声底，取 (噪声底, 峰值) 之间 15% 处
    let peak = 0; for (let i = 0; i < numFrames; i++) if (rms[i] > peak) peak = rms[i];
    const sorted = Array.from(rms).sort((a, b) => a - b);
    const p10 = sorted[Math.floor(sorted.length * 0.1)] || 0;
    const factor = opts.vadFactor != null ? opts.vadFactor : 0.15;
    const th = p10 + (peak - p10) * factor;
    const hopDuration = hopSize / sampleRate;
    const active = new Uint8Array(numFrames);
    for (let i = 0; i < numFrames; i++) active[i] = rms[i] > th ? 1 : 0;
    const minActiveFrames = Math.max(1, Math.round((opts.minActive || 0.2) / hopDuration));
    const minGapFrames = Math.max(1, Math.round((opts.minGap || 0.3) / hopDuration));
    let i = 0;
    while (i < numFrames) {
      if (active[i] === 0) {
        let j = i; while (j < numFrames && active[j] === 0) j++;
        if (i > 0 && j < numFrames && (j - i) < minGapFrames) for (let k = i; k < j; k++) active[k] = 1;
        i = j;
      } else i++;
    }
    i = 0;
    while (i < numFrames) {
      if (active[i] === 1) {
        let j = i; while (j < numFrames && active[j] === 1) j++;
        if ((j - i) < minActiveFrames) for (let k = i; k < j; k++) active[k] = 0;
        i = j;
      } else i++;
    }
    const phrases = [], interludes = [];
    let totalActive = 0;
    i = 0;
    while (i < numFrames) {
      const cur = active[i];
      let j = i; while (j < numFrames && active[j] === cur) j++;
      const start = i * hopDuration;
      const end = j * hopDuration;
      if (cur === 1) { totalActive += (end - start); phrases.push({ start: +start.toFixed(3), end: +end.toFixed(3), energy: 0 }); }
      else if (start > 0 && end < N / sampleRate) interludes.push({ start: +start.toFixed(3), end: +end.toFixed(3) });
      i = j;
    }
    const duration = N / sampleRate;
    return { rms: Array.from(rms), active: Array.from(active), phrases, interludes,
      coverage: duration > 0 ? +(totalActive / duration).toFixed(3) : 0,
      reliable: opts.reliable !== false, hopDuration };
  }

  async function analyzeStems(vocalsBlob, instrumentalBlob, opts) {
    opts = opts || {};
    const vBuf = await decodeBlob(vocalsBlob);
    const vMono = monoFromBuffer(vBuf);
    let analysis;
    if (instrumentalBlob) {
      const iBuf = await decodeBlob(instrumentalBlob);
      const iMono = monoFromBuffer(iBuf);
      const sr = Math.max(vBuf.sampleRate, iBuf.sampleRate);
      const vR = resampleLinear(vMono, vBuf.sampleRate, sr);
      const iR = resampleLinear(iMono, iBuf.sampleRate, sr);
      const len = Math.max(vR.length, iR.length);
      analysis = analyzeChannel(padTo(iR, len), sr, opts);
      analysis.vocal = detectVocal(padTo(vR, len), sr, opts);
      analysis.vocal.reliable = true;
    } else {
      analysis = analyzeChannel(vMono, vBuf.sampleRate, opts);
      analysis.vocal = detectVocal(vMono, vBuf.sampleRate, opts);
      analysis.vocal.reliable = false;
    }
    return analysis;
  }

  function monoFromBuffer(buf) {
    const c0 = buf.getChannelData(0);
    if (buf.numberOfChannels > 1) {
      const c1 = buf.getChannelData(1);
      const m = new Float32Array(c0.length);
      for (let i = 0; i < c0.length; i++) m[i] = (c0[i] + c1[i]) * 0.5;
      return m;
    }
    return c0;
  }

  function resampleLinear(input, fromRate, toRate) {
    if (fromRate === toRate) return input;
    const ratio = toRate / fromRate;
    const outLen = Math.round(input.length * ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const src = i / ratio, i0 = Math.floor(src), i1 = Math.min(input.length - 1, i0 + 1), fr = src - i0;
      out[i] = input[i0] * (1 - fr) + input[i1] * fr;
    }
    return out;
  }

  function padTo(arr, len) {
    if (arr.length >= len) return arr.subarray(0, len);
    const out = new Float32Array(len); out.set(arr); return out;
  }
  RF.Audio = {
    analyzeChannel, analyzeBuffer, analyzeFile, decodeBlob,
    beatAt, resolveTime, clearCache, sampleAt, inSection,
    detectVocal, analyzeStems, monoFromBuffer, resampleLinear,
    current: null,
  };
})(window.RF = window.RF || {});
