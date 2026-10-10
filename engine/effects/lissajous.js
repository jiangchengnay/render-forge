// engine/effects/lissajous.js
// 利萨如曲线：参数方程 x=sin(a·t), y=sin(b·t)，数学美感强烈。

(function (RF) {
  RF.effects.register("lissajous", {
    meta: {"category":"math","desc":"利萨如曲线。","params":{"a":{"type":"number","default":3},"b":{"type":"number","default":2},"phase":{"type":"number","default":1.57},"radius":{"type":"number","default":0.42},"samples":{"type":"number","default":2000},"lineWidth":{"type":"number","default":1.5},"rotSpeed":{"type":"number","default":0.15},"color":{"type":"string","default":"$0"}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const cx = (params.cx != null ? params.cx : 0.5) * W;
      const cy = (params.cy != null ? params.cy : 0.5) * H;
      const radius = (params.radius != null ? params.radius : 0.42) * Math.min(W, H);
      const a = params.a != null ? params.a : 3;
      const b = params.b != null ? params.b : 2;
      const phase = params.phase != null ? params.phase : Math.PI / 2;
      const samples = params.samples != null ? params.samples : 2000;
      const lineWidth = params.lineWidth != null ? params.lineWidth : 1.5;
      const drawProgress = params.drawProgress !== false;
      const rotSpeed = params.rotSpeed != null ? params.rotSpeed : 0.15;
      const color = params.color || f.palette.colors[0];
      const color2 = params.color2 || null;

      const p = drawProgress ? f.easedP : 1;
      const n = Math.floor(samples * p);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(f.t * rotSpeed);
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.globalCompositeOperation = params.composite || "lighter";

      // 用渐变色沿路径
      for (let i = 0; i < n - 1; i++) {
        const t0 = (i / samples) * Math.PI * 4;
        const t1 = ((i + 1) / samples) * Math.PI * 4;
        const x0 = Math.sin(a * t0 + phase) * radius;
        const y0 = Math.sin(b * t0) * radius;
        const x1 = Math.sin(a * t1 + phase) * radius;
        const y1 = Math.sin(b * t1) * radius;
        if (color2) {
          const k = i / samples;
          ctx.strokeStyle = RF.Color.mix(color, color2, k);
        } else {
          ctx.strokeStyle = color;
        }
        ctx.globalAlpha = (params.alpha != null ? params.alpha : 0.85) * (0.3 + 0.7 * (1 - i / samples));
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.restore();
    },
  });
})(window.RF = window.RF || {});