// engine/effects/kaleidoscope.js
// 万花筒：把画面按 N 个对称角度复制。配合其他效果能出惊艳的对称图案。

(function (RF) {
  RF.effects.register("kaleidoscope", {
    meta: {"category":"math","desc":"万花筒对称。","params":{"slices":{"type":"number","default":8},"rotSpeed":{"type":"number","default":0.1},"zoom":{"type":"number","default":0.5},"srcLines":{"type":"number","default":8}}},
    init(ctx, params, env) {
      const W = env.width, H = env.height;
      const buf = document.createElement("canvas");
      buf.width = W; buf.height = H;
      const bufCtx = buf.getContext("2d");
      // 万花筒不需要内部绘制元素 —— 它基于上一层已有的画面做对称复制。
      // 但 canvas 2D 无法"读回上一帧"（会包含已经画上的自己），
      // 所以这里设计为：kaleidoscope 内部绘制一个"源图案"，再对称复制。
      return { buf, bufCtx };
    },
    draw(ctx, f, params, env) {
      const st = f.state;
      const W = f.W, H = f.H;
      const buf = st.buf, bufCtx = st.bufCtx;

      const slices = params.slices != null ? params.slices : 8;
      const rotSpeed = params.rotSpeed != null ? params.rotSpeed : 0.1;
      const zoom = params.zoom != null ? params.zoom : 0.5;
      const simplex = st.simplex || (st.simplex = RF.makeSimplex(f.t));

      // 先画一个源图案到 buf（用简化的线条图案）
      bufCtx.clearRect(0, 0, W, H);
      bufCtx.save();
      bufCtx.translate(W / 2, H / 2);
      const n = params.srcLines != null ? params.srcLines : 8;
      bufCtx.lineWidth = params.srcLineWidth != null ? params.srcLineWidth : 3;
      for (let i = 0; i < n; i++) {
        const phase = i / n;
        const r = Math.min(W, H) * (0.1 + 0.35 * phase);
        const ang = phase * Math.PI * 2 + f.t * 0.5;
        bufCtx.strokeStyle = RF.colorAt(f.palette, i);
        bufCtx.globalAlpha = 0.7;
        bufCtx.beginPath();
        bufCtx.arc(0, 0, r, ang, ang + 1.5);
        bufCtx.stroke();
      }
      bufCtx.restore();

      // 对称复制
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(f.t * rotSpeed);
      const alpha = params.alpha != null ? params.alpha : 0.75;
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = params.composite || "lighter";

      for (let i = 0; i < slices; i++) {
        ctx.save();
        ctx.rotate((i / slices) * Math.PI * 2);
        if (i % 2 === 1) ctx.scale(-1, 1); // 镜像
        ctx.scale(zoom, zoom);
        ctx.drawImage(buf, -W / 2, -H / 2);
        ctx.restore();
      }
      ctx.restore();
    },
  });
})(window.RF = window.RF || {});