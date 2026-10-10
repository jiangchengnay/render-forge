// engine/effects/feedback.js
// 帧反馈：把上一帧按某个变换画回去，形成拖尾/残影/万花筒。
// 这是"高级感"最强的效果之一，Opus 生成的很多惊艳画面都靠它。

(function (RF) {
  RF.effects.register("feedback", {
    meta: {"category":"feedback","desc":"帧反馈，形成拖尾/万花筒。高级感来源。","params":{"decay":{"type":"number","default":0.94,"desc":"残影衰减"},"scale":{"type":"number","default":0.98,"desc":"每帧缩放"},"rotate":{"type":"number","default":0.004,"desc":"每帧旋转（弧度）"},"hueShift":{"type":"number","default":0,"desc":"每帧色相偏移（度）"}}},
    init(ctx, params, env) {
      // 每帧一张离屏画布，用于累积
      const buf = document.createElement("canvas");
      buf.width = env.width; buf.height = env.height;
      const bufCtx = buf.getContext("2d");
      return { buf, bufCtx, hasContent: false };
    },

    draw(ctx, f, params, env) {
      const st = f.state;
      const W = f.W, H = f.H;
      const buf = st.buf, bufCtx = st.bufCtx;

      // 参数
      const decay = params.decay != null ? params.decay : 0.94;  // 残影衰减
      const scaleAmt = params.scale != null ? params.scale : 0.98; // 每帧缩放（万花筒用）
      const rotate = params.rotate != null ? params.rotate : 0.004; // 每帧旋转（弧度）
      const offsetX = params.offsetX != null ? params.offsetX : 0;
      const offsetY = params.offsetY != null ? params.offsetY : 0;
      const hueShift = params.hueShift != null ? params.hueShift : 0;
      const blend = params.blend || "source-over";
      const drawNew = params.drawNew; // 可选：一个绘制函数名，标识当前帧是否绘制新元素

      // 该效果需要一个"输入"：从上一次渲染的整个画布内容累积。
      // 我们用主画布（ctx）在上一帧的内容作为输入 —— 但主画布已被本帧背景填充。
      // 因此改用：本效果在 init 时创建自己的缓冲区，每帧先把主画布内容按变换画进缓冲，
      // 再把缓冲以衰减叠加画回主画布。

      // 步骤 1：把当前主画布（已经画了背景 + 前面的图层）按变换画到缓冲
      bufCtx.save();
      bufCtx.globalCompositeOperation = "source-over";
      bufCtx.globalAlpha = 1;
      bufCtx.clearRect(0, 0, W, H);
      // 施加变换
      bufCtx.translate(W / 2 + offsetX, H / 2 + offsetY);
      bufCtx.rotate(rotate);
      bufCtx.scale(scaleAmt, scaleAmt);
      bufCtx.translate(-W / 2, -H / 2);
      if (hueShift > 0) bufCtx.filter = `hue-rotate(${hueShift}deg)`;
      bufCtx.drawImage(ctx.canvas, 0, 0);
      bufCtx.restore();

      // 步骤 2：把缓冲以 decay 透明度叠回主画布
      ctx.save();
      ctx.globalCompositeOperation = blend;
      ctx.globalAlpha = decay;
      ctx.drawImage(buf, 0, 0);
      ctx.restore();
    },
  });
})(window.RF = window.RF || {});