// engine/effects/metaball.js
// 融合球：多个圆形相互"融合"，用 canvas 的 shadowBlur 或 filter 模拟。

(function (RF) {
  RF.effects.register("metaball", {
    meta: {"category":"math","desc":"融合球（blur+contrast 模拟）。","params":{"count":{"type":"number","default":6},"blur":{"type":"number","default":30},"alpha":{"type":"number","default":0.85}}},
    init(ctx, params, env) {
      const W = env.width, H = env.height;
      const count = params.count != null ? params.count : 6;
      const rng = env.rng;
      const balls = [];
      for (let i = 0; i < count; i++) {
        const a = rng.float() * Math.PI * 2;
        const r = Math.min(W, H) * (0.1 + rng.float() * 0.15);
        balls.push({
          cx: W / 2 + Math.cos(a) * r,
          cy: H / 2 + Math.sin(a) * r,
          r: rng.range(0.06, 0.13) * Math.min(W, H),
          phase: rng.float() * Math.PI * 2,
          freq: rng.range(0.3, 0.9),
          orbitR: rng.range(0.15, 0.3) * Math.min(W, H),
          orbitSpeed: rng.range(-0.4, 0.4),
          colorIndex: rng.int(0, env.palette.colors.length - 1),
        });
      }
      return { balls };
    },
    draw(ctx, f, params, env) {
      const st = f.state;
      const W = f.W, H = f.H;
      const balls = st.balls;
      const cx0 = W / 2, cy0 = H / 2;
      const blur = params.blur != null ? params.blur : 30;
      const alpha = params.alpha != null ? params.alpha : 0.85;

      // 用 filter blur + threshold 模拟 metaball 融合
      ctx.save();
      ctx.globalCompositeOperation = params.composite || "lighter";
      ctx.globalAlpha = alpha;
      ctx.filter = `blur(${blur}px) contrast(15)`;

      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        const t = f.t * b.freq + b.phase;
        const ang = t * b.orbitSpeed;
        const x = cx0 + Math.cos(ang) * b.orbitR;
        const y = cy0 + Math.sin(ang) * b.orbitR;
        const r = b.r * (1 + 0.15 * Math.sin(f.t * 2 + b.phase));
        ctx.fillStyle = RF.colorAt(f.palette, b.colorIndex);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  });
})(window.RF = window.RF || {});