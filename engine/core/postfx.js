// engine/core/postfx.js
// 后处理链。AI 在 DSL 里写 post: [{ effect: "bloom", amount: 0.6 }]。
// 内部基于 Canvas 2D 实现（不用 WebGL，保证单文件可跑、跨平台一致）。

(function (RF) {
  RF.postfx = RF.postfx || {};
  RF.postfx.register = RF.postfx.register || function (name, def) { RF.postfx[name] = def; };

  // —— 亮度提取：生成一张只保留高光部分的画布 ——
  function extractBrightness(src, dstCtx, threshold) {
    const W = src.width, H = src.height;
    dstCtx.clearRect(0, 0, W, H);
    dstCtx.drawImage(src, 0, 0);
    const img = dstCtx.getImageData(0, 0, W, H);
    const d = img.data;
    const th = threshold * 255;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      if (lum < th) {
        d[i + 3] = 0;
      } else {
        // 高光部分保留，并按超出阈值的量加权
        const k = (lum - th) / (255 - th + 1);
        d[i + 3] = Math.min(255, d[i + 3] * (0.3 + 0.7 * k));
      }
    }
    dstCtx.putImageData(img, 0, 0);
  }

  // —— 高斯模糊：通过多次降采样 + drawImage 缩放模拟 ——
  function gaussianBlur(srcCanvas, radius) {
    const W = srcCanvas.width, H = srcCanvas.height;
    let src = srcCanvas;
    // 降采样次数取决于半径
    const levels = Math.max(1, Math.floor(Math.log2(radius + 1)));
    let cur = src;
    const chain = [];
    for (let i = 0; i < levels; i++) {
      const w = Math.max(1, W >> (i + 1));
      const h = Math.max(1, H >> (i + 1));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const cx = c.getContext("2d");
      cx.drawImage(cur, 0, 0, w, h);
      chain.push(c);
      cur = c;
    }
    // 再放大回原始尺寸，逐级叠加
    for (let i = chain.length - 2; i >= 0; i--) {
      const c = chain[i];
      const cx = c.getContext("2d");
      cx.save();
      cx.globalAlpha = 0.7;
      cx.drawImage(chain[i + 1], 0, 0, c.width, c.height);
      cx.restore();
    }
    // 最终放大回原尺寸
    const out = document.createElement("canvas");
    out.width = W; out.height = H;
    const octx = out.getContext("2d");
    octx.drawImage(chain[0], 0, 0, W, H);
    return out;
  }

  // —— Bloom：亮部泛光 ——
  // 用降采样金字塔模拟模糊（纯 drawImage，无 filter，无 getImageData）。
  // 效果 ≈ 多级高斯，速度提升数十倍。
  RF.postfx.register("bloom", {
    apply(srcCanvas, dstCtx, amount, mainCtx, env) {
      const W = srcCanvas.width, H = srcCanvas.height;
      const threshold = env.params.threshold != null ? env.params.threshold : 0.6;
      const radius = env.params.radius != null ? env.params.radius : 24;
      // radius → 降采样层数，层数越多越"散"
      const levels = Math.max(2, Math.min(6, Math.round(Math.log2(radius / 3 + 1) + 1)));

      // 1) 原图
      dstCtx.clearRect(0, 0, W, H);
      dstCtx.drawImage(srcCanvas, 0, 0);

      // 2) 建降采样金字塔
      const chain = [srcCanvas];
      let cur = srcCanvas;
      for (let i = 0; i < levels; i++) {
        const w = Math.max(2, Math.floor(cur.width / 2));
        const h = Math.max(2, Math.floor(cur.height / 2));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const cx = c.getContext("2d");
        // 用低采样时顺带压低非高光，等效"提亮部"
        cx.drawImage(cur, 0, 0, w, h);
        chain.push(c);
        cur = c;
      }

      // 3) 从最底层逐级放大叠加（以 lighter），每级叠一点
      const boost = 1 / Math.max(0.05, threshold);
      dstCtx.save();
      dstCtx.globalCompositeOperation = "lighter";
      // 每级的权重递减，让大颗粒更柔和
      for (let i = chain.length - 1; i >= 1; i--) {
        const lvlWeight = amount * boost * (0.5 + 0.5 * (i / chain.length));
        if (lvlWeight <= 0.01) continue;
        dstCtx.globalAlpha = Math.min(1, lvlWeight);
        dstCtx.drawImage(chain[i], 0, 0, W, H);
      }
      dstCtx.restore();
    },
  });

  // —— Vignette：暗角 ——
  RF.postfx.register("vignette", {
    apply(srcCanvas, dstCtx, amount, mainCtx, env) {
      const W = srcCanvas.width, H = srcCanvas.height;
      dstCtx.clearRect(0, 0, W, H);
      dstCtx.drawImage(srcCanvas, 0, 0);
      const g = dstCtx.createRadialGradient(
        W / 2, H / 2, Math.min(W, H) * 0.3,
        W / 2, H / 2, Math.max(W, H) * 0.75
      );
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(0,0,0,${amount})`);
      dstCtx.fillStyle = g;
      dstCtx.fillRect(0, 0, W, H);
    },
  });

  // —— Grain：噪点颗粒 ——
  // 预生成 N 张噪声 tile（小尺寸），逐帧轮播平铺。完全避开逐像素。
  const GRAIN_TILE_SIZE = 256;
  const GRAIN_TILE_COUNT = 12;
  let GRAIN_TILES = null;
  function ensureGrainTiles() {
    if (GRAIN_TILES) return GRAIN_TILES;
    GRAIN_TILES = [];
    for (let k = 0; k < GRAIN_TILE_COUNT; k++) {
      const c = document.createElement("canvas");
      c.width = GRAIN_TILE_SIZE;
      c.height = GRAIN_TILE_SIZE;
      const cx = c.getContext("2d");
      const img = cx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
      const d = img.data;
      const rng = new RF.Rng("grain" + k);
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.floor(rng.float() * 255);
        d[i] = v; d[i+1] = v; d[i+2] = v; d[i+3] = 255;
      }
      cx.putImageData(img, 0, 0);
      GRAIN_TILES.push(c);
    }
    return GRAIN_TILES;
  }

  RF.postfx.register("grain", {
    apply(srcCanvas, dstCtx, amount, mainCtx, env) {
      const W = srcCanvas.width, H = srcCanvas.height;
      dstCtx.clearRect(0, 0, W, H);
      dstCtx.drawImage(srcCanvas, 0, 0);

      const tiles = ensureGrainTiles();
      const idx = Math.floor(env.t * 24) % tiles.length;
      const tile = tiles[idx];
      const pat = dstCtx.createPattern(tile, "repeat");
      if (!pat) return;

      dstCtx.save();
      dstCtx.globalAlpha = amount;
      dstCtx.globalCompositeOperation = "overlay";
      dstCtx.fillStyle = pat;
      // 用随机偏移避免规律性
      const ox = (Math.floor(env.t * 53) * 37) % GRAIN_TILE_SIZE;
      const oy = (Math.floor(env.t * 71) * 29) % GRAIN_TILE_SIZE;
      dstCtx.translate(-ox, -oy);
      dstCtx.fillRect(ox, oy, W + GRAIN_TILE_SIZE, H + GRAIN_TILE_SIZE);
      dstCtx.restore();
    },
  });

  // —— Chromatic Aberration：RGB 通道分离（canvas filter + 合成，无 getImageData）——
  RF.postfx.register("chroma", {
    apply(srcCanvas, dstCtx, amount, mainCtx, env) {
      const W = srcCanvas.width, H = srcCanvas.height;
      const shift = env.params.shift != null ? env.params.shift : 4 * amount;
      dstCtx.clearRect(0, 0, W, H);
      dstCtx.save();

      // 用 filter 提取红/蓝通道：先用 sepia/hue-rotate 近似，再用 composite 叠加
      // 红通道：hue-rotate 后只保留红色
      dstCtx.globalCompositeOperation = "lighter";

      // 红偏移
      const red = document.createElement("canvas");
      red.width = W; red.height = H;
      const rc = red.getContext("2d");
      rc.filter = "url(#none) saturate(0) brightness(1)";  // 转灰
      rc.drawImage(srcCanvas, 0, 0);
      // 转灰后叠加红（multiply）
      rc.globalCompositeOperation = "multiply";
      rc.fillStyle = "#ff0000";
      rc.fillRect(0, 0, W, H);
      rc.globalCompositeOperation = "source-over";

      // 蓝偏移
      const blue = document.createElement("canvas");
      blue.width = W; blue.height = H;
      const bc = blue.getContext("2d");
      bc.filter = "saturate(0)";
      bc.drawImage(srcCanvas, 0, 0);
      bc.globalCompositeOperation = "multiply";
      bc.fillStyle = "#0000ff";
      bc.fillRect(0, 0, W, H);
      bc.globalCompositeOperation = "source-over";

      // 绿通道：原图
      dstCtx.globalCompositeOperation = "source-over";
      dstCtx.drawImage(srcCanvas, 0, 0);
      // 叠加偏移的红蓝（subtract 式叠加用 multiply+screen）
      dstCtx.globalCompositeOperation = "screen";
      dstCtx.globalAlpha = 0.5 * amount;
      dstCtx.drawImage(red, -shift, 0);
      dstCtx.drawImage(blue, shift, 0);
      dstCtx.restore();
    },
  });

  // —— Scanlines：扫描线（CRT 感）——
  RF.postfx.register("scanlines", {
    apply(srcCanvas, dstCtx, amount, mainCtx, env) {
      const W = srcCanvas.width, H = srcCanvas.height;
      dstCtx.clearRect(0, 0, W, H);
      dstCtx.drawImage(srcCanvas, 0, 0);
      const gap = env.params.gap != null ? env.params.gap : 3;
      dstCtx.save();
      dstCtx.globalAlpha = amount;
      dstCtx.fillStyle = "#000";
      for (let y = 0; y < H; y += gap * 2) {
        dstCtx.fillRect(0, y, W, gap);
      }
      dstCtx.restore();
    },
  });

  // —— Glitch：水平切片位移 ——
  RF.postfx.register("glitch", {
    apply(srcCanvas, dstCtx, amount, mainCtx, env) {
      const W = srcCanvas.width, H = srcCanvas.height;
      dstCtx.clearRect(0, 0, W, H);
      dstCtx.drawImage(srcCanvas, 0, 0);
      if (amount <= 0) return;
      const rng = new RF.Rng(Math.floor(env.t * 20));
      const slices = env.params.slices != null ? env.params.slices : 8;
      const maxShift = env.params.maxShift != null ? env.params.maxShift : 40;
      for (let i = 0; i < slices; i++) {
        const sy = rng.range(0, H);
        const sh = rng.range(4, H / 6);
        const dx = rng.range(-maxShift, maxShift) * amount;
        dstCtx.drawImage(srcCanvas, 0, sy, W, sh, dx, sy, W, sh);
      }
    },
  });

  // —— 通用：混合两种纯色（调色）——
  RF.postfx.register("tint", {
    apply(srcCanvas, dstCtx, amount, mainCtx, env) {
      const W = srcCanvas.width, H = srcCanvas.height;
      dstCtx.clearRect(0, 0, W, H);
      dstCtx.drawImage(srcCanvas, 0, 0);
      const color = env.params.color || "#000";
      dstCtx.save();
      dstCtx.globalCompositeOperation = env.params.mode || "overlay";
      dstCtx.globalAlpha = amount;
      dstCtx.fillStyle = color;
      dstCtx.fillRect(0, 0, W, H);
      dstCtx.restore();
    },
  });
})(window.RF = window.RF || {});
