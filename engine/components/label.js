// engine/components/label.js
// 简单文字标签，用于副标、说明文字。比 lyricLine 更轻量。
(function (RF) {
  const FONT = '"Inter","Helvetica Neue",Arial,"Microsoft YaHei",sans-serif';
  RF.effects.register("labelText", {
    meta: {"category":"text","desc":"轻量标签文字，用于副标/说明。","params":{"text":{"type":"string","desc":"文字"},"x":{"type":"number","default":0.5},"y":{"type":"number","default":0.5},"size":{"type":"number","default":0.024},"weight":{"type":"number","default":500},"color":{"type":"string","default":"$fg"},"align":{"type":"string","default":"center","range":["left","center","right"]},"letterSpacing":{"type":"number","default":0}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const p = f.easedP;
      const text = params.text || "";
      const x = (params.x != null ? params.x : 0.5) * W;
      const y = (params.y != null ? params.y : 0.5) * H;
      const size = (params.size != null ? params.size : 0.024) * W;
      const weight = params.weight != null ? params.weight : 500;
      const color = params.color || f.palette.fg;
      const align = params.align || "center";
      const spacing = params.letterSpacing != null ? params.letterSpacing : 0;
      const ease = RF.Easing.outCubic(p);

      ctx.save();
      ctx.font = weight + " " + size + "px " + FONT;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.globalAlpha = ease;

      const dx = (1 - ease) * size * 0.5;
      if (spacing > 0) {
        // 手动字距
        const chars = [...text];
        const widths = chars.map((c) => ctx.measureText(c).width);
        const totalW = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1) * size;
        let startX = x;
        if (align === "center") startX = x - totalW / 2;
        else if (align === "right") startX = x - totalW;
        ctx.textAlign = "left";
        let cx = startX;
        chars.forEach((c, i) => {
          ctx.fillText(c, cx, y + dx);
          cx += widths[i] + spacing * size;
        });
      } else {
        ctx.fillText(text, x, y + dx);
      }
      ctx.restore();
    },
  });
})(window.RF = window.RF || {});