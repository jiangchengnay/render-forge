// engine/effects/flowfield.js
// 流动场（状态型）。粒子沿噪声场流动。

(function (RF) {
  RF.effects.register("flowfield", {
    meta: {"category":"particle","desc":"流动场。粒子沿噪声场流动，丝绸质感。stateful。","params":{"count":{"type":"number","default":2000},"noiseScale":{"type":"number","default":1.5},"noiseSpeed":{"type":"number","default":0.08},"velocity":{"type":"number","default":180},"lineWidth":{"type":"number","default":1},"alpha":{"type":"number","default":0.4}}},
    stateful: true,
    init(ctx, params, env) {
      const W = env.width, H = env.height;
      const count = params.count != null ? params.count : 2000;
      const simplex = RF.makeSimplex(params.seed != null ? params.seed : env.rng.seed);
      const rng = env.rng.fork("flowfield-init");
      const ps = [];
      for (let i = 0; i < count; i++) {
        ps.push({
          x: rng.float() * W,
          y: rng.float() * H,
          life: rng.float(),
          maxLife: rng.range(1.5, 4.0),
          speed: rng.range(0.6, 1.4),
          colorIndex: rng.int(0, env.palette.colors.length - 1),
        });
      }
      return { ps, simplex, rng: env.rng.fork("flowfield-runtime") };
    },

    tick(state, f, params) {
      const ps = state.ps;
      const simplex = state.simplex;
      const W = f.W, H = f.H;
      const noiseScale = params.noiseScale != null ? params.noiseScale : 1.5;
      const noiseSpeed = params.noiseSpeed != null ? params.noiseSpeed : 0.08;
      const velocity = params.velocity != null ? params.velocity : 180;
      const t = f.t * noiseSpeed;
      const dt = f.dt;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const nx = (p.x / W) * noiseScale;
        const ny = (p.y / H) * noiseScale;
        const angle = simplex(nx, ny + t) * Math.PI * 2;
        p.x += Math.cos(angle) * velocity * p.speed * dt;
        p.y += Math.sin(angle) * velocity * p.speed * dt;
        p.life += dt / p.maxLife;
        if (p.x < 0 || p.x > W || p.y < 0 || p.y > H || p.life >= 1) {
          p.x = state.rng.float() * W;
          p.y = state.rng.float() * H;
          p.life = 0;
          p.maxLife = 1.5 + state.rng.float() * 2.5;
        }
      }
    },

    snapshot(state) {
      return { ps: state.ps.map((p) => ({ x: p.x, y: p.y, life: p.life })) };
    },
    restore(state, snap) {
      for (let i = 0; i < state.ps.length && i < snap.ps.length; i++) {
        state.ps[i].x = snap.ps[i].x;
        state.ps[i].y = snap.ps[i].y;
        state.ps[i].life = snap.ps[i].life;
      }
    },

    paint(ctx, state, f, params) {
      const ps = state.ps;
      const alpha = params.alpha != null ? params.alpha : 0.4;
      const lineWidth = params.lineWidth != null ? params.lineWidth : 1;
      ctx.save();
      ctx.globalCompositeOperation = params.composite || "lighter";
      ctx.lineCap = "round";
      ctx.lineWidth = lineWidth;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const lifeAlpha = Math.sin(p.life * Math.PI);
        ctx.globalAlpha = alpha * lifeAlpha;
        ctx.fillStyle = RF.colorAt(f.palette, p.colorIndex);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  });
})(window.RF = window.RF || {});