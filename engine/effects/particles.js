// engine/effects/particles.js
// 粒子系统（状态型：tick 更新物理，paint 绘制）
// tick 与 dt 挂钩，保证 seek 重放时物理演化与实时播放完全一致。

(function (RF) {
  const BEHAVIORS = {
    drift: (p, dt, params, f, rng) => {
      p.vx += (rng.float() - 0.5) * 20 * dt;
      p.vy += (rng.float() - 0.5) * 20 * dt;
      p.vx *= 0.98; p.vy *= 0.98;
    },
    attract: (p, dt, params, f) => {
      const cx = f.W * 0.5, cy = f.H * 0.5;
      const dx = cx - p.x, dy = cy - p.y;
      const d = Math.hypot(dx, dy) + 1;
      const k = (params.strength != null ? params.strength : 400);
      p.vx += (dx / d) * k * dt;
      p.vy += (dy / d) * k * dt;
      p.vx *= 0.96; p.vy *= 0.96;
    },
    explode: (p, dt, params, f) => {
      const cx = f.W * 0.5, cy = f.H * 0.5;
      const dx = p.x - cx, dy = p.y - cy;
      const d = Math.hypot(dx, dy) + 1;
      const k = (params.strength != null ? params.strength : 600);
      p.vx += (dx / d) * k * dt;
      p.vy += (dy / d) * k * dt;
    },
    vortex: (p, dt, params, f) => {
      const cx = f.W * 0.5, cy = f.H * 0.5;
      const dx = p.x - cx, dy = p.y - cy;
      const d = Math.hypot(dx, dy) + 1;
      const k = (params.strength != null ? params.strength : 300);
      p.vx += (-dy / d) * k * dt - (dx / d) * k * 0.3 * dt;
      p.vy += ( dx / d) * k * dt - (dy / d) * k * 0.3 * dt;
      p.vx *= 0.98; p.vy *= 0.98;
    },
    gravity: (p, dt, params) => {
      p.vy += (params.gravity != null ? params.gravity : 600) * dt;
    },
    flow: (p, dt, params) => {
      p.vx += (params.wind != null ? params.wind : 100) * dt;
    },
    none: () => {},
  };

  const SHAPES = {
    dot(ctx, p) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
    square(ctx, p) {
      ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
    },
    line(ctx, p) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      ctx.lineWidth = p.size * 0.6;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.stroke();
    },
    star(ctx, p) {
      const n = 4, r1 = p.size, r2 = p.size * 0.4;
      ctx.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? r1 : r2;
        const x = p.x + Math.cos(a) * r;
        const y = p.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    },
  };

  RF.effects.register("particles", {
    meta: {"category":"particle","desc":"粒子系统。stateful，支持 6 种行为。","params":{"count":{"type":"number","default":500,"desc":"粒子数"},"behavior":{"type":"string","default":"drift","range":["drift","attract","explode","vortex","gravity","flow","none"],"desc":"运动行为"},"shape":{"type":"string","default":"dot","range":["dot","square","line","star"],"desc":"粒子形状"},"spawn":{"type":"string","default":"random","range":["random","center","ring","edge"],"desc":"出生位置"},"alpha":{"type":"number","default":0.9},"sizeMul":{"type":"number","default":1},"strength":{"type":"number","default":400,"desc":"行为力度"},"wrap":{"type":"boolean","default":true}}},
    stateful: true,

    init(ctx, params, env) {
      const count = Math.max(0, Math.min(5000, Math.floor(params.count != null ? params.count : 500)));
      const rng = env.rng;
      const W = env.width, H = env.height;
      const spawn = params.spawn || "random";
      const ps = [];
      for (let i = 0; i < count; i++) {
        let x, y;
        if (spawn === "center") {
          const a = rng.float() * Math.PI * 2, r = rng.float() * 20;
          x = W / 2 + Math.cos(a) * r;
          y = H / 2 + Math.sin(a) * r;
        } else if (spawn === "ring") {
          const a = rng.float() * Math.PI * 2;
          const rad = Math.min(W, H) * 0.35 * (0.85 + rng.float() * 0.3);
          x = W / 2 + Math.cos(a) * rad;
          y = H / 2 + Math.sin(a) * rad;
        } else if (spawn === "edge") {
          const side = rng.int(0, 3);
          if (side === 0) { x = rng.float() * W; y = -5; }
          else if (side === 1) { x = W + 5; y = rng.float() * H; }
          else if (side === 2) { x = rng.float() * W; y = H + 5; }
          else { x = -5; y = rng.float() * H; }
        } else {
          x = rng.float() * W;
          y = rng.float() * H;
        }
        const a0 = rng.float() * Math.PI * 2;
        const sp = rng.range(20, 80);
        ps.push({
          x, y,
          vx: Math.cos(a0) * sp,
          vy: Math.sin(a0) * sp,
          size: rng.range(0.8, 2.5),
          colorIndex: rng.int(0, env.palette.colors.length - 1),
        });
      }
      // 独立 rng 用于运行时的 drift
      return { ps, rng: env.rng.fork("particles-runtime") };
    },

    tick(state, f, params) {
      const ps = state.ps;
      const behavior = BEHAVIORS[params.behavior || "drift"] || BEHAVIORS.drift;
      const sub = 2;
      const sdt = f.dt / sub;
      const W = f.W, H = f.H;
      const wrap = params.wrap !== false;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        for (let s = 0; s < sub; s++) behavior(p, sdt, params, f, state.rng);
        p.x += p.vx * f.dt;
        p.y += p.vy * f.dt;
        if (wrap) {
          if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
          if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
        }
      }
    },

    // 关键帧快照（粒子位置/速度是纯数据，可浅拷贝）
    snapshot(state) {
      return {
        ps: state.ps.map((p) => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy })),
      };
    },
    restore(state, snap) {
      for (let i = 0; i < state.ps.length && i < snap.ps.length; i++) {
        state.ps[i].x = snap.ps[i].x;
        state.ps[i].y = snap.ps[i].y;
        state.ps[i].vx = snap.ps[i].vx;
        state.ps[i].vy = snap.ps[i].vy;
      }
    },

    paint(ctx, state, f, params) {
      const ps = state.ps;
      const shape = SHAPES[params.shape || "dot"] || SHAPES.dot;
      const sizeMul = params.sizeMul != null ? params.sizeMul : 1;
      const fade = params.fade != null ? params.fade : 1;
      const alpha = (params.alpha != null ? params.alpha : 0.9)
        * (f.easedP != null ? (1 - f.easedP * (1 - fade)) : 1);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = params.composite || "lighter";
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        ctx.fillStyle = params.color || RF.colorAt(f.palette, p.colorIndex);
        const savedSize = p.size;
        p.size = savedSize * sizeMul;
        shape(ctx, p);
        p.size = savedSize;
      }
      ctx.restore();
    },
  });
})(window.RF = window.RF || {});