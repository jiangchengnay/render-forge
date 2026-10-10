// engine/effects/noise.js
// 噪声场效果。AI 只需写 { "effect": "fbmNoise", "scale": 3.2, "warp": 0.6 }。
// 内部包含 simplex 噪声、fbm 分形叠加、域扭曲。

(function (RF) {
  // —— 经典 simplex 2D 噪声（Stefan Gustavson 版）——
  function makeSimplex(seed) {
    const rng = new RF.Rng(seed || "simplex");
    const grad3 = [
      [1,1],[-1,1],[1,-1],[-1,-1],
      [1,0],[-1,0],[0,1],[0,-1],
    ];
    const perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.float() * (i + 1));
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;

    function dot(g, x, y) { return g[0] * x + g[1] * y; }

    return function simplex2D(xin, yin) {
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s);
      const j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const X0 = i - t, Y0 = j - t;
      const x0 = xin - X0, y0 = yin - Y0;
      let i1, j1;
      if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let n0 = 0, n1 = 0, n2 = 0;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * dot(grad3[perm[ii + perm[jj]] % 8], x0, y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * dot(grad3[perm[ii + i1 + perm[jj + j1]] % 8], x1, y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * dot(grad3[perm[ii + 1 + perm[jj + 1]] % 8], x2, y2); }
      return 70 * (n0 + n1 + n2);
    };
  }

  // fbm：多倍频叠加
  function fbm(simplex, x, y, octaves, lacunarity, gain) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * simplex(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  // 域扭曲：用另一层噪声偏移采样坐标，产生"流动"感
  function warp(simplex, x, y, amount, t) {
    const qx = simplex(x + t * 0.3, y + 0.0);
    const qy = simplex(x + 5.2, y + 1.3 + t * 0.3);
    return [x + amount * qx, y + amount * qy];
  }

  // —— 生成一帧噪声为离屏纹理（低分辨率，后续放大）——
  // 返回 { canvas, w, h }
  function renderNoiseFrame(simplex, opts) {
    const {
      w, h, scale, octaves, warpAmt, zOffset, bands,
      colA, colB, pixelSize,
    } = opts;
    const cvs = document.createElement("canvas");
    cvs.width = w; cvs.height = h;
    const c = cvs.getContext("2d");
    const cA = RF.Color.parse(colA);
    const cB = RF.Color.parse(colB);
    const img = c.createImageData(w, h);
    const d = img.data;

    for (let py = 0; py < h; py += pixelSize) {
      for (let px = 0; px < w; px += pixelSize) {
        let nx = (px / w - 0.5) * scale;
        let ny = (py / h - 0.5) * scale;
        if (warpAmt > 0) {
          const wv = warp(simplex, nx, ny, warpAmt, zOffset);
          nx = wv[0]; ny = wv[1];
        }
        let v = fbm(simplex, nx, ny + zOffset, octaves, 2.0, 0.5);
        v = v * 0.5 + 0.5;
        if (bands > 0) v = Math.floor(v * bands) / bands;
        const r = cB.r + (cA.r - cB.r) * v;
        const g = cB.g + (cA.g - cB.g) * v;
        const b = cB.b + (cA.b - cB.b) * v;
        // 填充 block
        for (let dy = 0; dy < pixelSize && py + dy < h; dy++) {
          for (let dx = 0; dx < pixelSize && px + dx < w; dx++) {
            const o = ((py + dy) * w + (px + dx)) * 4;
            d[o] = r; d[o+1] = g; d[o+2] = b; d[o+3] = 255;
          }
        }
      }
    }
    c.putImageData(img, 0, 0);
    return cvs;
  }

  RF.effects.register("fbmNoise", {
    meta: {"category":"noise","desc":"分形噪声场，最常用的氛围底纹。","params":{"scale":{"type":"number","default":3,"desc":"噪声频率，越大越碎"},"octaves":{"type":"number","default":4,"desc":"倍频层数"},"warp":{"type":"number","default":0.5,"desc":"域扭曲强度"},"speed":{"type":"number","default":0.15,"desc":"演化速度"},"bands":{"type":"number","default":0,"desc":">0 时条带化"},"alpha":{"type":"number","default":1,"desc":"透明度"},"colorA":{"type":"string","default":"$0","desc":"亮部色"},"colorB":{"type":"string","default":"$bg","desc":"暗部色"},"resolution":{"type":"number","default":320,"desc":"内部纹理分辨率"},"pixelSize":{"type":"number","default":2,"desc":"像素颗粒大小"}}},
    init(ctx, params, env) {
      const seed = params.seed != null ? params.seed : env.rng.seed;
      const simplex = makeSimplex(seed);

      const W = env.width, H = env.height;
      const scale = params.scale != null ? params.scale : 3;
      const octaves = params.octaves != null ? params.octaves : 4;
      const warpAmt = params.warp != null ? params.warp : 0.5;
      const bands = params.bands != null ? params.bands : 0;
      const colA = params.colorA || env.palette.colors[0];
      const colB = params.colorB || env.palette.bg;

      // 生成 N 张 z 切片作为动画关键帧
      const FRAMES = params.frames != null ? params.frames : 8;
      const RES = params.resolution != null ? params.resolution : 320;
      const pixelSize = params.pixelSize != null ? params.pixelSize : 2;

      const frames = [];
      for (let i = 0; i < FRAMES; i++) {
        const zOff = (i / FRAMES) * 8.0;
        frames.push(renderNoiseFrame(simplex, {
          w: RES, h: RES, scale, octaves, warpAmt,
          zOffset: zOff, bands, colA, colB, pixelSize,
        }));
      }
      return { frames, FRAMES, RES };
    },

    draw(ctx, f, params, env) {
      const st = f.state;
      const W = f.W, H = f.H;
      const alpha = params.alpha != null ? params.alpha : 1;
      const speed = params.speed != null ? params.speed : 0.15;
      const t = f.t * speed;
      const drift = params.drift != null ? params.drift : 0.02;

      // 用 t 映射到 frame index，相邻两帧交叉淡化
      const total = t * (st.FRAMES / 8.0);
      const fi = ((total % st.FRAMES) + st.FRAMES) % st.FRAMES;
      const i0 = Math.floor(fi);
      const i1 = (i0 + 1) % st.FRAMES;
      const mix = fi - i0;

      // 漂移：让两层错开一点位置，产生流动感
      const dx = Math.sin(t * 0.7) * drift * W;
      const dy = Math.cos(t * 0.5) * drift * H;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = params.blend || "source-over";
      // 底帧
      ctx.drawImage(st.frames[i0], dx, dy, W, H);
      // 交叉淡化：把下一帧用对应 alpha 盖上去
      if (mix > 0) {
        ctx.globalAlpha = alpha * mix;
        ctx.drawImage(st.frames[i1], dx, dy, W, H);
      }
      ctx.restore();
    },
  });

  // 变体：把噪声当遮罩，裁切出流动的形状
  RF.effects.register("noiseMask", {
    meta: {"category":"noise","desc":"噪声遮罩，用噪声裁出流动形状。","params":{"scale":{"type":"number","default":2.5,"desc":"噪声频率"},"threshold":{"type":"number","default":0.5,"desc":"显示阈值 0-1"},"speed":{"type":"number","default":0.1,"desc":"演化速度"},"color":{"type":"string","default":"$0","desc":"填充色"},"step":{"type":"number","default":6,"desc":"采样网格像素"}}},
    init(ctx, params, env) {
      return { simplex: makeSimplex(params.seed != null ? params.seed : env.rng.seed) };
    },
    draw(ctx, f, params, env) {
      const simplex = f.state.simplex;
      const W = f.W, H = f.H;
      const scale = params.scale != null ? params.scale : 2.5;
      const threshold = params.threshold != null ? params.threshold : 0.5;
      const speed = params.speed != null ? params.speed : 0.1;
      const color = params.color || f.palette.colors[0];
      const step = params.step != null ? params.step : 6;
      const t = f.t * speed;
      ctx.save();
      ctx.fillStyle = color;
      for (let py = 0; py < H; py += step) {
        for (let px = 0; px < W; px += step) {
          const nx = (px / W - 0.5) * scale;
          const ny = (py / H - 0.5) * scale;
          let v = simplex(nx, ny + t) * 0.5 + 0.5;
          if (v > threshold) ctx.fillRect(px, py, step, step);
        }
      }
      ctx.restore();
    },
  });

  RF.makeSimplex = makeSimplex;
  RF.fbm = fbm;
})(window.RF = window.RF || {});