// engine/effects/text.js
// 文字排版动画。AI 只写 { "effect": "typewriter", "text": "Hello" }。
// 内部处理字体、字距、逐字/逐行出现、模糊聚焦等。

(function (RF) {
  // 字体族：优先系统无衬线，保证跨机器一致
  const FONT_STACK = '"Inter","Helvetica Neue",Arial,"Microsoft YaHei",sans-serif';
  const MONO_STACK = '"JetBrains Mono","SF Mono",Consolas,monospace';

  function applyFont(ctx, params) {
    const size = params.size != null ? params.size : 0.08;
    const weight = params.weight != null ? params.weight : 600;
    const family = params.mono ? MONO_STACK : FONT_STACK;
    const scaleRef = params._W || 1080;
    const px = size * scaleRef;
    ctx.font = `${weight} ${px}px ${family}`;
    ctx.textAlign = params.align || "center";
    ctx.textBaseline = params.baseline || "middle";
  }

  function pos(ctx, f, params) {
    const W = f.W, H = f.H;
    const x = (params.x != null ? params.x : 0.5) * W;
    const y = (params.y != null ? params.y : 0.5) * H;
    return { x, y };
  }

  // 打字机：逐字出现
  RF.effects.register("typewriter", {
    meta: {"category":"text","desc":"打字机。","params":{"text":{"type":"string","default":"Hello"},"size":{"type":"number","default":0.08},"weight":{"type":"number","default":600},"color":{"type":"string","default":"$fg"},"x":{"type":"number","default":0.5},"y":{"type":"number","default":0.5},"align":{"type":"string","default":"center"},"cursor":{"type":"boolean","default":true}}},
    draw(ctx, f, params, env) {
      const text = String(params.text != null ? params.text : "Hello");
      const p = f.easedP;
      const n = Math.round(text.length * p);
      const shown = text.slice(0, n);
      const color = params.color || f.palette.fg;
      const { x, y } = pos(ctx, f, params);
      ctx.save();
      applyFont(ctx, Object.assign({}, params, { _W: f.W }));
      ctx.fillStyle = color;
      if (params.shadow) {
        ctx.shadowColor = params.shadowColor || color;
        ctx.shadowBlur = params.shadowBlur != null ? params.shadowBlur : 20;
      }
      ctx.fillText(shown, x, y);
      // 光标
      if (params.cursor !== false && p < 1) {
        const metrics = ctx.measureText(shown);
        const align = params.align || "center";
        let cx = x;
        if (align === "center") cx = x + metrics.width / 2 + 4;
        else if (align === "right") cx = x + 4;
        else cx = x + metrics.width + 4;
        const size = (params.size != null ? params.size : 0.08) * f.W;
        ctx.fillRect(cx, y - size * 0.5, size * 0.08, size);
      }
      ctx.restore();
    },
  });

  // 逐字弹入：每个字带 stagger，从下方 + 模糊
  RF.effects.register("wordPop", {
    meta: {"category":"text","desc":"逐字弹入。","params":{"text":{"type":"string"},"size":{"type":"number","default":0.08},"weight":{"type":"number","default":600},"stagger":{"type":"number","default":0.5},"color":{"type":"string","default":"$fg"},"x":{"type":"number","default":0.5},"y":{"type":"number","default":0.5},"align":{"type":"string","default":"center"},"rise":{"type":"number","default":0.5}}},
    draw(ctx, f, params, env) {
      const text = String(params.text != null ? params.text : "Hello");
      const p = f.easedP;
      const chars = [...text];
      const stagger = params.stagger != null ? params.stagger : 0.5;
      const color = params.color || f.palette.fg;
      const { x, y } = pos(ctx, f, params);
      ctx.save();
      applyFont(ctx, Object.assign({}, params, { _W: f.W }));
      ctx.fillStyle = color;

      // 测量总宽
      const totalW = ctx.measureText(text).width;
      const align = params.align || "center";
      let startX = x;
      if (align === "center") startX = x - totalW / 2;
      else if (align === "right") startX = x - totalW;
      else startX = x;

      let cx = startX;
      const size = (params.size != null ? params.size : 0.08) * f.W;
      const rise = (params.rise != null ? params.rise : 0.5) * size;

      for (let i = 0; i < chars.length; i++) {
        const d = chars.length > 1 ? (i / (chars.length - 1)) * stagger : 0;
        const lp = RF.clamp01((p - d) / (1 - stagger));
        const ease = RF.Easing.outBack(lp);
        const ch = chars[i];
        const chW = ctx.measureText(ch).width;
        ctx.save();
        ctx.globalAlpha = lp;
        // 从下方升起 + 轻微缩放
        const dy = (1 - ease) * rise;
        const sc = 0.6 + 0.4 * ease;
        ctx.translate(cx + chW / 2, y + dy);
        ctx.scale(sc, sc);
        ctx.fillText(ch, -chW / 2, 0);
        ctx.restore();
        cx += chW;
      }
      ctx.restore();
    },
  });

  // 模糊聚焦：文字从模糊到清晰
  RF.effects.register("blurFocus", {
    meta: {"category":"text","desc":"从模糊到清晰聚焦。","params":{"text":{"type":"string"},"size":{"type":"number","default":0.08},"weight":{"type":"number","default":600},"maxBlur":{"type":"number","default":20,"desc":"起始模糊像素"},"scaleFrom":{"type":"number","default":1},"color":{"type":"string","default":"$fg"},"x":{"type":"number","default":0.5},"y":{"type":"number","default":0.5},"align":{"type":"string","default":"center"}}},
    draw(ctx, f, params, env) {
      const text = String(params.text != null ? params.text : "Focus");
      const p = f.easedP;
      const color = params.color || f.palette.fg;
      const { x, y } = pos(ctx, f, params);
      const maxBlur = params.maxBlur != null ? params.maxBlur : 20;
      const blur = (1 - p) * maxBlur;
      const scale = params.scaleFrom != null ? params.scaleFrom + (1 - params.scaleFrom) * p : 1;
      ctx.save();
      applyFont(ctx, Object.assign({}, params, { _W: f.W }));
      if (blur > 0.5) ctx.filter = `blur(${blur}px)`;
      ctx.fillStyle = color;
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    },
  });
})(window.RF = window.RF || {});