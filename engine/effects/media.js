// engine/effects/media.js
// 素材导入：图片、视频、SVG。
// 这些是"真做产品片"的刚需——放 logo、截图、录屏、图标。
//
// 用法：先在浏览器里注册素材，再在 DSL 里引用：
//   RF.Media.register("logo", file);   // File/Blob 或 URL
//   RF.Media.registerVideo("demo", videoFile);
//   { "effect": "image", "params": { "src": "logo", ... } }

(function (RF) {
  const IMAGES = {};   // id -> HTMLImageElement
  const VIDEOS = {};   // id -> HTMLVideoElement
  const SVGS = {};     // id -> { svgEl, serialized }

  function ready() { return document.fonts ? document.fonts.ready : Promise.resolve(); }

  // —— 注册图片 ——
  async function registerImage(id, src) {
    let url;
    if (src instanceof Blob || src instanceof File) {
      url = URL.createObjectURL(src);
    } else if (typeof src === "string") {
      url = src;
    } else {
      throw new Error("unsupported image src");
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = (e) => rej(new Error("image load failed: " + id));
      img.src = url;
    });
    IMAGES[id] = { el: img, url: url, w: img.naturalWidth, h: img.naturalHeight };
    return IMAGES[id];
  }

  // —— 注册视频 ——
  async function registerVideo(id, src) {
    let url;
    if (src instanceof Blob || src instanceof File) {
      url = URL.createObjectURL(src);
    } else {
      url = src;
    }
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    await new Promise((res, rej) => {
      v.onloadeddata = res;
      v.onerror = () => rej(new Error("video load failed: " + id));
      v.src = url;
    });
    VIDEOS[id] = { el: v, url: url, w: v.videoWidth, h: v.videoHeight, duration: v.duration };
    return VIDEOS[id];
  }

  // —— 注册 SVG（字符串或 URL）——
  async function registerSVG(id, src) {
    let text;
    if (typeof src === "string" && src.trim().startsWith("<")) {
      text = src;
    } else {
      const url = (src instanceof Blob || src instanceof File) ? URL.createObjectURL(src) : src;
      const res = await fetch(url);
      text = await res.text();
    }
    const img = new Image();
    const blob = new Blob([text], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error("svg load failed: " + id));
      img.src = url;
    });
    SVGS[id] = { el: img, url: url, svg: text, w: img.naturalWidth, h: img.naturalHeight };
    return SVGS[id];
  }

  // —— 统一入口：按类型自动识别 ——
  async function register(id, fileOrUrl) {
    if (fileOrUrl instanceof File) {
      if (fileOrUrl.type.startsWith("image/svg")) return registerSVG(id, fileOrUrl);
      if (fileOrUrl.type.startsWith("image/")) return registerImage(id, fileOrUrl);
      if (fileOrUrl.type.startsWith("video/")) return registerVideo(id, fileOrUrl);
      throw new Error("unsupported file type: " + fileOrUrl.type);
    }
    if (typeof fileOrUrl === "string") {
      // 以内联 SVG 源码字符串传入（以 < 开头）→ 走 SVG 注册
      if (fileOrUrl.trim().startsWith("<")) return registerSVG(id, fileOrUrl);
      if (/\.svg($|\?)/i.test(fileOrUrl)) return registerSVG(id, fileOrUrl);
      if (/\.(mp4|webm|mov|m4v)($|\?)/i.test(fileOrUrl)) return registerVideo(id, fileOrUrl);
      return registerImage(id, fileOrUrl);
    }
    if (fileOrUrl instanceof Blob) return registerImage(id, fileOrUrl);
    throw new Error("unsupported source");
  }

  function get(id) { return IMAGES[id] || VIDEOS[id] || SVGS[id] || null; }
  function list() { return { images: Object.keys(IMAGES), videos: Object.keys(VIDEOS), svgs: Object.keys(SVGS) }; }

  // —— 加载分镜 assets 清单 ——
  // storyboard.assets = [{ id, src, type? }, ...]，src 为相对分镜的路径或 URL。
  // 根据扩展名/type 自动路由到 registerImage / registerVideo / registerSVG。
  // 返回 Promise，resolve 已加载数量；单个失败不阻断（记入 errors）。
  async function loadStoryboardAssets(assets, baseUrl) {
    const arr = Array.isArray(assets) ? assets : [];
    const results = { loaded: 0, errors: [] };
    const base = baseUrl || (typeof location !== "undefined" ? location.href : "");
    for (const a of arr) {
      if (!a || !a.id || !a.src) { results.errors.push("asset 缺 id 或 src"); continue; }
      try {
        let src = a.src;
        // 相对路径 → 绝对（相对分镜/base）
        if (typeof src === "string" && !/^(https?:|data:|blob:|file:)/i.test(src) && base) {
          try { src = new URL(src, base).href; } catch (e) {}
        }
        const t = a.type || "";
        if (t === "video" || /\.(mp4|webm|mov|m4v)($|\?)/i.test(a.src)) {
          // 视频：预解码（若可用）以获得确定性
          if (RF.VideoDecode && RF.VideoDecode.available && RF.VideoDecode.loadAndDecode) {
            try { await RF.VideoDecode.loadAndDecode(a.id, src); }
            catch (e) { await registerVideo(a.id, src); }
          } else {
            await registerVideo(a.id, src);
          }
        } else if (t === "svg" || /\.svg($|\?)/i.test(a.src)) {
          await registerSVG(a.id, src);
        } else if (t === "font") {
          if (RF.Typography && RF.Typography.loadFont) {
            await RF.Typography.loadFont(a.family || a.id, src, a);
          }
        } else {
          await registerImage(a.id, src);
        }
        results.loaded++;
      } catch (e) {
        results.errors.push("asset '" + a.id + "' 加载失败: " + e.message);
      }
    }
    return results;
  }

  // —— 通用变换/适配计算 ——
  // 把素材按 fit 模式放到目标区域内，返回 { dx, dy, dw, dh }
  function fitSize(srcW, srcH, boxW, boxH, fit) {
    fit = fit || "contain";
    const srcRatio = srcW / srcH;
    const boxRatio = boxW / boxH;
    if (fit === "stretch") return { dx: 0, dy: 0, dw: boxW, dh: boxH };
    if (fit === "cover") {
      if (srcRatio > boxRatio) {
        const dh = boxH;
        const dw = dh * srcRatio;
        return { dx: (boxW - dw) / 2, dy: 0, dw, dh };
      } else {
        const dw = boxW;
        const dh = dw / srcRatio;
        return { dx: 0, dy: (boxH - dh) / 2, dw, dh };
      }
    }
    // contain
    if (srcRatio > boxRatio) {
      const dw = boxW;
      const dh = dw / srcRatio;
      return { dx: 0, dy: (boxH - dh) / 2, dw, dh };
    } else {
      const dh = boxH;
      const dw = dh * srcRatio;
      return { dx: (boxW - dw) / 2, dy: 0, dw, dh };
    }
  }

  // ================= 效果：image =================
  RF.effects.register("image", {
    meta: { category: "media", desc: "显示注册过的图片素材。", params: {
      src: { type: "string", desc: "注册时的 id" },
      x: { type: "number", default: 0.5, desc: "中心 x（0-1）" },
      y: { type: "number", default: 0.5, desc: "中心 y（0-1）" },
      w: { type: "number", default: 0.4, desc: "区域宽（相对画布）" },
      h: { type: "number", default: 0.4, desc: "区域高" },
      fit: { type: "string", default: "contain", range: ["contain","cover","stretch"], desc: "适配方式" },
      opacity: { type: "number", default: 1 },
      rotate: { type: "number", default: 0, desc: "旋转（弧度）" },
      scale: { type: "number", default: 1, desc: "额外缩放" },
      shadow: { type: "boolean", default: false, desc: "是否加阴影" },
      radius: { type: "number", default: 0, desc: "圆角（像素）" },
      grayscale: { type: "boolean", default: false }
    }},
    draw(ctx, f, params, env) {
      const asset = get(params.src);
      if (!asset || !asset.el) return;
      const W = f.W, H = f.H;
      const cx = (params.x != null ? params.x : 0.5) * W;
      const cy = (params.y != null ? params.y : 0.5) * H;
      const bw = (params.w != null ? params.w : 0.4) * W;
      const bh = (params.h != null ? params.h : 0.4) * H;
      const fit = fitSize(asset.w, asset.h, bw, bh, params.fit);
      const scale = params.scale != null ? params.scale : 1;
      const rot = params.rotate || 0;

      ctx.save();
      ctx.globalAlpha = (params.opacity != null ? params.opacity : 1) * f.easedP;
      if (params.shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 12;
      }
      if (params.grayscale) ctx.filter = "grayscale(1)";
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      const dx = -bw / 2 + fit.dx;
      const dy = -bh / 2 + fit.dy;
      if (params.radius > 0) {
        const r = params.radius;
        ctx.beginPath();
        const x0 = dx, y0 = dy, x1 = dx + fit.dw, y1 = dy + fit.dh;
        ctx.moveTo(x0 + r, y0);
        ctx.arcTo(x1, y0, x1, y1, r);
        ctx.arcTo(x1, y1, x0, y1, r);
        ctx.arcTo(x0, y1, x0, y0, r);
        ctx.arcTo(x0, y0, x1, y0, r);
        ctx.closePath();
        ctx.clip();
      }
      ctx.drawImage(asset.el, dx, dy, fit.dw, fit.dh);
      ctx.restore();
    },
  });

  // ================= 效果：video =================
  RF.effects.register("video", {
    meta: { category: "media", desc: "播放注册过的视频素材（逐帧 drawImage）。", params: {
      src: { type: "string", desc: "注册时的 id" },
      x: { type: "number", default: 0.5 }, y: { type: "number", default: 0.5 },
      w: { type: "number", default: 0.4 }, h: { type: "number", default: 0.4 },
      fit: { type: "string", default: "cover" },
      loop: { type: "boolean", default: true },
      muted: { type: "boolean", default: true },
      startAt: { type: "number", default: 0, desc: "从视频第几秒开始" },
      opacity: { type: "number", default: 1 }
    }},
    init(ctx, params, env) {
      const asset = get(params.src);
      return { asset, lastSyncT: -1 };
    },
    draw(ctx, f, params, env) {
      const st = f.state;
      const asset = st.asset;
      if (!asset) return;
      const v = asset.el;

      const W = f.W, H = f.H;
      const cx = (params.x != null ? params.x : 0.5) * W;
      const cy = (params.y != null ? params.y : 0.5) * H;
      const bw = (params.w != null ? params.w : 0.4) * W;
      const bh = (params.h != null ? params.h : 0.4) * H;

      // 优先用预解码帧（确定性）
      if (asset.predecoded && asset.frames && asset.frames.length) {
        const fps = asset.decodedFps || 30;
        const targetT = (params.startAt || 0) + f.local;
        const idx = Math.min(asset.frames.length - 1, Math.max(0, Math.floor(targetT * fps)));
        const frame = asset.frames[idx];
        if (frame && frame.bitmap) {
          const vw = frame.bitmap.width;
          const vh = frame.bitmap.height;
          const fit = fitSize(vw, vh, bw, bh, params.fit);
          ctx.save();
          ctx.globalAlpha = (params.opacity != null ? params.opacity : 1) * f.easedP;
          ctx.translate(cx, cy);
          ctx.drawImage(frame.bitmap, -bw / 2 + fit.dx, -bh / 2 + fit.dy, fit.dw, fit.dh);
          ctx.restore();
          return;
        }
      }

      // 回落：实时 <video>（不确定，仅预览用）
      if (!v) return;
      const targetTime = (params.startAt || 0) + f.local;
      if (Math.abs(v.currentTime - (targetTime % (v.duration || 1e9))) > 0.1) {
        try { v.currentTime = targetTime % (v.duration || 1e9); } catch (e) {}
      }
      if (v.paused) { try { v.play().catch(() => {}); } catch (e) {} }
      const vw = v.videoWidth || 16;
      const vh = v.videoHeight || 9;
      const fit = fitSize(vw, vh, bw, bh, params.fit);
      ctx.save();
      ctx.globalAlpha = (params.opacity != null ? params.opacity : 1) * f.easedP;
      ctx.translate(cx, cy);
      ctx.drawImage(v, -bw / 2 + fit.dx, -bh / 2 + fit.dy, fit.dw, fit.dh);
      ctx.restore();
    },
  });

  // ================= 效果：svg =================
  RF.effects.register("svg", {
    meta: { category: "media", desc: "显示 SVG 素材。", params: {
      src: { type: "string", desc: "注册 id" },
      x: { type: "number", default: 0.5 }, y: { type: "number", default: 0.5 },
      w: { type: "number", default: 0.3 }, h: { type: "number", default: 0.3 },
      fit: { type: "string", default: "contain" },
      opacity: { type: "number", default: 1 }
    }},
    draw(ctx, f, params, env) {
      const asset = get(params.src);
      if (!asset || !asset.el) return;
      const W = f.W, H = f.H;
      const cx = (params.x != null ? params.x : 0.5) * W;
      const cy = (params.y != null ? params.y : 0.5) * H;
      const bw = (params.w != null ? params.w : 0.3) * W;
      const bh = (params.h != null ? params.h : 0.3) * H;
      const fit = fitSize(asset.w || 1, asset.h || 1, bw, bh, params.fit || "contain");
      ctx.save();
      ctx.globalAlpha = (params.opacity != null ? params.opacity : 1) * f.easedP;
      ctx.translate(cx, cy);
      ctx.drawImage(asset.el, -bw / 2 + fit.dx, -bh / 2 + fit.dy, fit.dw, fit.dh);
      ctx.restore();
    },
  });

  // ================= 效果：imageMask（用图片当遮罩） =================
  RF.effects.register("imageMask", {
    meta: { category: "media", desc: "用图片作为遮罩裁切下层。", params: {
      src: { type: "string" }, x: { type: "number", default: 0.5 }, y: { type: "number", default: 0.5 },
      w: { type: "number", default: 0.6 }, h: { type: "number", default: 0.6 },
      feather: { type: "number", default: 0 }
    }},
    draw(ctx, f, params, env) {
      const asset = get(params.src);
      if (!asset || !asset.el) return;
      const W = f.W, H = f.H;
      const cx = (params.x != null ? params.x : 0.5) * W;
      const cy = (params.y != null ? params.y : 0.5) * H;
      const bw = (params.w != null ? params.w : 0.6) * W;
      const bh = (params.h != null ? params.h : 0.6) * H;
      const fit = fitSize(asset.w, asset.h, bw, bh, "contain");
      ctx.save();
      ctx.globalCompositeOperation = "destination-in";
      ctx.translate(cx, cy);
      ctx.drawImage(asset.el, -bw / 2 + fit.dx, -bh / 2 + fit.dy, fit.dw, fit.dh);
      ctx.restore();
    },
  });

  RF.Media = {
    register, registerImage, registerVideo, registerSVG,
    loadStoryboardAssets,
    get, list, fitSize,
    _images: IMAGES, _videos: VIDEOS, _svgs: SVGS,
  };
})(window.RF = window.RF || {});
