// engine/core/transition.js
// 转场系统（含真交叉淡化 compose）。
(function (RF) {
  const TRANSITIONS = {};
  function reg(name, fn) { TRANSITIONS[name] = fn; }

  reg("cut", (ctx, W, H, p, params) => {
    if (p < 1) { ctx.fillStyle = params.color || "#000"; ctx.fillRect(0, 0, W, H); }
  });

  reg("fade", (ctx, W, H, p, params) => {
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = params.color || "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  });

  reg("wipe", (ctx, W, H, p, params) => {
    const dir = params.dir || "left";
    ctx.save();
    ctx.fillStyle = params.color || "#000";
    if (dir === "left") ctx.fillRect(0, 0, W * (1 - p), H);
    else if (dir === "right") ctx.fillRect(W * p, 0, W * (1 - p), H);
    else if (dir === "up") ctx.fillRect(0, 0, W, H * (1 - p));
    else if (dir === "down") ctx.fillRect(0, H * p, W, H * (1 - p));
    ctx.restore();
  });

  reg("zoomFade", (ctx, W, H, p, params) => {
    const color = params.color || "#000";
    const maxR = Math.hypot(W, H) * 0.75;
    const r = maxR * p;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2, true);
    ctx.fillStyle = color;
    ctx.fill("evenodd");
    ctx.restore();
  });

  reg("iris", (ctx, W, H, p, params) => {
    const color = params.color || "#000";
    const cx = (params.cx != null ? params.cx : 0.5) * W;
    const cy = (params.cy != null ? params.cy : 0.5) * H;
    const maxR = Math.hypot(W, H) * 0.75;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(cx, cy, maxR * p, 0, Math.PI * 2, true);
    ctx.fillStyle = color;
    ctx.fill("evenodd");
    ctx.restore();
  });

  reg("slide", (ctx, W, H, p, params) => {
    const dir = params.dir || "left";
    const color = params.color || "#000";
    ctx.fillStyle = color;
    const offset = W * (1 - p);
    if (dir === "left") ctx.fillRect(W - offset, 0, offset, H);
    else if (dir === "right") ctx.fillRect(0, 0, offset, H);
  });

  reg("glitch", (ctx, W, H, p, params) => {
    const rng = new RF.Rng(Math.floor(p * 20));
    const slices = 12;
    const colors = params.colors || ["#ff2d95", "#00e5ff", "#ffffff", "#000"];
    ctx.save();
    for (let i = 0; i < slices; i++) {
      if (rng.float() > p) continue;
      const sy = rng.float() * H;
      const sh = rng.range(4, 40);
      ctx.globalAlpha = rng.range(0.3, 0.9) * (1 - p);
      ctx.fillStyle = rng.pick(colors);
      ctx.fillRect(0, sy, W, sh);
    }
    ctx.restore();
  });

  reg("blocks", (ctx, W, H, p, params) => {
    const cell = params.cell != null ? params.cell : 60;
    const rng = new RF.Rng(params.seed != null ? params.seed : 7);
    ctx.save();
    ctx.fillStyle = params.color || "#000";
    for (let y = 0; y < H; y += cell) {
      for (let x = 0; x < W; x += cell) {
        if (rng.float() < p) ctx.fillRect(x, y, cell, cell);
      }
    }
    ctx.restore();
  });

  reg("shapeMask", (ctx, W, H, p, params) => {
    const color = params.color || "#000";
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    if ((params.shape || "circle") === "circle") {
      const maxR = Math.hypot(W, H) * 0.75;
      ctx.arc(W / 2, H / 2, maxR * p, 0, Math.PI * 2, true);
    }
    ctx.fill("evenodd");
    ctx.restore();
  });

  function apply(ctx, W, H, name, progress, params, palette) {
    const fn = TRANSITIONS[name];
    if (!fn) return;
    try { fn(ctx, W, H, progress, params || {}, palette); }
    catch (e) { console.error("[RF] transition error:", name, e); }
  }

  function compose(ctx, W, H, canvasA, canvasB, name, progress, params, palette) {
    const p = progress;
    params = params || {};

    if (name === "fade") {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(canvasA, 0, 0);
      ctx.globalAlpha = p;
      ctx.drawImage(canvasB, 0, 0);
      ctx.restore();
      return;
    }
    if (name === "wipe") {
      const dir = params.dir || "left";
      ctx.save();
      ctx.drawImage(canvasA, 0, 0);
      ctx.beginPath();
      if (dir === "left") ctx.rect(0, 0, W * p, H);
      else if (dir === "right") ctx.rect(W * (1 - p), 0, W * p, H);
      else if (dir === "up") ctx.rect(0, 0, W, H * p);
      else if (dir === "down") ctx.rect(0, H * (1 - p), W, H * p);
      ctx.clip();
      ctx.drawImage(canvasB, 0, 0);
      ctx.restore();
      return;
    }
    if (name === "slide") {
      const dir = params.dir || "left";
      ctx.save();
      const ease = RF.Easing.inOutCubic(p);
      if (dir === "left") {
        ctx.drawImage(canvasA, -W * ease, 0);
        ctx.drawImage(canvasB, W * (1 - ease), 0);
      } else if (dir === "right") {
        ctx.drawImage(canvasA, W * ease, 0);
        ctx.drawImage(canvasB, -W * (1 - ease), 0);
      } else if (dir === "up") {
        ctx.drawImage(canvasA, 0, -H * ease);
        ctx.drawImage(canvasB, 0, H * (1 - ease));
      } else {
        ctx.drawImage(canvasA, 0, H * ease);
        ctx.drawImage(canvasB, 0, -H * (1 - ease));
      }
      ctx.restore();
      return;
    }
    if (name === "iris") {
      ctx.save();
      ctx.drawImage(canvasA, 0, 0);
      const cx = (params.cx != null ? params.cx : 0.5) * W;
      const cy = (params.cy != null ? params.cy : 0.5) * H;
      const maxR = Math.hypot(W, H) * 0.75;
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.arc(cx, cy, maxR * p, 0, Math.PI * 2, true);
      ctx.clip("evenodd");
      ctx.drawImage(canvasB, 0, 0);
      ctx.restore();
      return;
    }
    if (name === "zoomFade") {
      ctx.save();
      const ease = RF.Easing.inOutCubic(p);
      const scaleA = 1 + ease * 0.3;
      const scaleB = 0.85 + ease * 0.15;
      ctx.globalAlpha = 1 - ease;
      ctx.drawImage(canvasA, (W - W * scaleA) / 2, (H - H * scaleA) / 2, W * scaleA, H * scaleA);
      ctx.globalAlpha = ease;
      ctx.drawImage(canvasB, (W - W * scaleB) / 2, (H - H * scaleB) / 2, W * scaleB, H * scaleB);
      ctx.restore();
      return;
    }
    if (name === "glitch") {
      ctx.save();
      ctx.drawImage(canvasA, 0, 0);
      ctx.globalAlpha = p;
      ctx.drawImage(canvasB, 0, 0);
      const rng = new RF.Rng(Math.floor(p * 20));
      const colors = params.colors || ["#ff2d95", "#00e5ff", "#ffffff"];
      for (let i = 0; i < 12; i++) {
        if (rng.float() > (1 - p)) continue;
        const sy = rng.float() * H;
        const sh = rng.range(4, 40);
        ctx.globalAlpha = rng.range(0.3, 0.9) * (1 - p) * 0.7;
        ctx.fillStyle = rng.pick(colors);
        ctx.fillRect(0, sy, W, sh);
      }
      ctx.restore();
      return;
    }
    if (name === "blocks") {
      ctx.save();
      ctx.drawImage(canvasA, 0, 0);
      const cell = params.cell != null ? params.cell : 60;
      const rng = new RF.Rng(params.seed != null ? params.seed : 7);
      for (let y = 0; y < H; y += cell) {
        for (let x = 0; x < W; x += cell) {
          if (rng.float() < p) ctx.drawImage(canvasB, x, y, cell, cell, x, y, cell, cell);
        }
      }
      ctx.restore();
      return;
    }
    if (name === "shapeMask") {
      ctx.save();
      ctx.drawImage(canvasA, 0, 0);
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      if ((params.shape || "circle") === "circle") {
        const maxR = Math.hypot(W, H) * 0.75;
        ctx.arc(W / 2, H / 2, maxR * p, 0, Math.PI * 2, true);
      }
      ctx.clip("evenodd");
      ctx.drawImage(canvasB, 0, 0);
      ctx.restore();
      return;
    }
    if (name === "cut") {
      ctx.drawImage(p < 1 ? canvasA : canvasB, 0, 0);
      return;
    }
    // 兜底
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(canvasA, 0, 0);
    ctx.globalAlpha = p;
    ctx.drawImage(canvasB, 0, 0);
    ctx.restore();
  }

  function computeProgress(act, local) {
    let tin = null, tout = null;
    if (act.transitionIn) {
      const d = act.transitionIn.dur != null ? act.transitionIn.dur : 0.4;
      if (local < d) tin = { progress: local / d, params: act.transitionIn };
    }
    if (act.transitionOut) {
      const d = act.transitionOut.dur != null ? act.transitionOut.dur : 0.4;
      const remain = act.dur - local;
      if (remain < d) tout = { progress: 1 - remain / d, params: act.transitionOut };
    }
    return { in: tin, out: tout };
  }

  RF.Transitions = { apply, compose, computeProgress, list: () => Object.keys(TRANSITIONS) };
})(window.RF = window.RF || {});
