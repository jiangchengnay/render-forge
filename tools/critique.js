// tools/critique.js
// 批评工具：对当前 storyboard 生成结构化报告。
// 输出：关键帧截图 + lint 警告 + 每帧质量指标（亮度/对比度/色彩数/边缘密度）。
// 用法：await RF.critique({ frames: 6 })
(function (RF) {
  // 分析一张画布的图像特征
  function analyzeCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    // 降采样到 128x128 分析（快）
    const tw = 128, th = 128;
    const small = document.createElement("canvas");
    small.width = tw; small.height = th;
    const sc = small.getContext("2d");
    sc.drawImage(canvas, 0, 0, tw, th);
    const img = sc.getImageData(0, 0, tw, th).data;

    let sumLum = 0, sumLum2 = 0;
    let minLum = 255, maxLum = 0;
    const colorBuckets = {};
    let edgeSum = 0;
    const lum = new Float32Array(tw * th);

    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const i = (y * tw + x) * 4;
        const r = img[i], g = img[i + 1], b = img[i + 2];
        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        lum[y * tw + x] = L;
        sumLum += L;
        sumLum2 += L * L;
        if (L < minLum) minLum = L;
        if (L > maxLum) maxLum = L;
        // 颜色桶（量化到 4bit）
        const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        colorBuckets[key] = (colorBuckets[key] || 0) + 1;
      }
    }
    const n = tw * th;
    const avgLum = sumLum / n;
    const variance = sumLum2 / n - avgLum * avgLum;
    const contrast = Math.sqrt(Math.max(0, variance));

    // 边缘密度（Sobel 简易版）
    for (let y = 1; y < th - 1; y++) {
      for (let x = 1; x < tw - 1; x++) {
        const gx = lum[(y - 1) * tw + x - 1] + 2 * lum[y * tw + x - 1] + lum[(y + 1) * tw + x - 1]
                 - lum[(y - 1) * tw + x + 1] - 2 * lum[y * tw + x + 1] - lum[(y + 1) * tw + x + 1];
        const gy = lum[(y - 1) * tw + x - 1] + 2 * lum[(y - 1) * tw + x] + lum[(y - 1) * tw + x + 1]
                 - lum[(y + 1) * tw + x - 1] - 2 * lum[(y + 1) * tw + x] - lum[(y + 1) * tw + x + 1];
        edgeSum += Math.hypot(gx, gy);
      }
    }
    const edgeDensity = edgeSum / n;

    // 色彩丰富度（颜色桶数量）
    const colorCount = Object.keys(colorBuckets).length;
    // 主色占比（最大桶 / 总像素）
    let maxBucket = 0;
    for (const k in colorBuckets) if (colorBuckets[k] > maxBucket) maxBucket = colorBuckets[k];
    const dominantRatio = maxBucket / n;

    return {
      avgLum: +avgLum.toFixed(1),
      contrast: +contrast.toFixed(1),
      minLum: +minLum.toFixed(0),
      maxLum: +maxLum.toFixed(0),
      edgeDensity: +edgeDensity.toFixed(2),
      colorCount: colorCount,
      dominantRatio: +dominantRatio.toFixed(3),
    };
  }

  // 根据指标生成批评意见（含可执行修复建议）
  function judge(metrics, t, total) {
    const issues = [];
    const fixes = [];
    if (metrics.avgLum < 15) {
      issues.push("画面过暗");
      fixes.push({ path: "post bloom.amount", from: "默认", to: "提高 0.1-0.2 或降低 threshold 到 0.6" });
    }
    if (metrics.avgLum > 220) {
      issues.push("画面过曝");
      fixes.push({ path: "post bloom.amount", from: "默认", to: "降低 0.2 或提高 threshold 到 0.8" });
    }
    if (metrics.contrast < 12) {
      issues.push("对比度低，画面平淡");
      fixes.push({ path: "background", from: "当前", to: "加深外圈颜色，或增加 1-2 层不同 blend 的 clip" });
    }
    if (metrics.edgeDensity < 3) {
      issues.push("视觉元素稀疏");
      fixes.push({ path: "tracks", from: "当前", to: "加 dotGrid / geoShapes 等装饰层" });
    }
    if (metrics.edgeDensity > 40) {
      issues.push("视觉过载，元素堆叠");
      fixes.push({ path: "tracks", from: "当前", to: "减少同时活跃的 clip，或降低各 clip 的 opacity" });
    }
    if (metrics.colorCount > 200) {
      issues.push("颜色过多，可能杂乱");
      fixes.push({ path: "palette", from: "当前", to: "换更克制的调色板（monochrome / deepSea）" });
    }
    if (metrics.dominantRatio > 0.85) {
      issues.push("单色占比过高，缺少层次");
      fixes.push({ path: "tracks", from: "当前", to: "加 1-2 层 lighter 混合的元素" });
    }
    return { issues, fixes };
  }

  // 主入口
  RF.critique = async function (opts) {
    opts = opts || {};
    const rt = window.__rf_runtime;
    if (!rt) return { error: "no runtime" };

    const frames = opts.frames || 8;
    const W = rt.canvas.width, H = rt.canvas.height;
    const duration = rt.duration;

    // 采样时间点：包含起承转合
    const times = [];
    for (let i = 0; i < frames; i++) {
      times.push((i / (frames - 1)) * duration);
    }

    const results = [];
    for (const t of times) {
      rt.seek(t);
      const m = analyzeCanvas(rt.canvas);
      const j = judge(m, t, duration);
      const issues = j.issues;
      const fixes = j.fixes;
      // 抓一张缩略图（240px）
      const thumb = document.createElement("canvas");
      thumb.width = 240; thumb.height = 240;
      thumb.getContext("2d").drawImage(rt.canvas, 0, 0, 240, 240);
      results.push({
        t: +t.toFixed(2),
        metrics: m,
        issues: issues,
        fixes: fixes,
        thumb: thumb.toDataURL("image/jpeg", 0.7),
      });
    }

    // lint 警告
    const warns = (typeof RF.lintStoryboard === "function") ? RF.lintStoryboard(rt.storyboard) : [];

    // 汇总问题
    const issueCount = {};
    results.forEach((r) => r.issues.forEach((i) => { issueCount[i] = (issueCount[i] || 0) + 1; }));
    const sortedIssues = Object.keys(issueCount).sort((a, b) => issueCount[b] - issueCount[a]);

    return {
      duration: +duration.toFixed(2),
      frames: results,
      lintWarnings: warns,
      summary: {
        totalFrames: frames,
        framesWithIssues: results.filter((r) => r.issues.length > 0).length,
        topIssues: sortedIssues.slice(0, 5).map((k) => ({ issue: k, count: issueCount[k] })),
      },
      runtimeErrors: rt.errors,
    };
  };

  // 生成拼图（一张 contact sheet）
  RF.critiqueContactSheet = async function (opts) {
    opts = opts || {};
    const r = await RF.critique(opts);
    if (r.error) return r;
    const cols = opts.cols || 4;
    const rows = Math.ceil(r.frames.length / cols);
    const cell = 240;
    const cvs = document.createElement("canvas");
    cvs.width = cell * cols;
    cvs.height = cell * rows;
    const c = cvs.getContext("2d");
    c.fillStyle = "#000";
    c.fillRect(0, 0, cvs.width, cvs.height);
    for (let i = 0; i < r.frames.length; i++) {
      const dx = (i % cols) * cell;
      const dy = Math.floor(i / cols) * cell;
      const img = new Image();
      await new Promise((res) => { img.onload = res; img.src = r.frames[i].thumb; });
      c.drawImage(img, dx, dy, cell, cell);
      // 标注时间 + 问题数
      c.fillStyle = "rgba(0,0,0,0.75)";
      c.fillRect(dx + 4, dy + 4, 130, 18);
      c.fillStyle = r.frames[i].issues.length ? "#ff5d73" : "#00ffa3";
      c.font = "11px monospace";
      c.fillText("t=" + r.frames[i].t + "s  " + (r.frames[i].issues.length || "OK"), dx + 7, dy + 16);
    }
    r.contactSheet = cvs.toDataURL("image/jpeg", 0.85);
    return r;
  };
})(window.RF = window.RF || {});
