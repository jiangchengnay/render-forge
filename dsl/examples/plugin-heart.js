// dsl/examples/plugin-heart.js
// 示例插件效果：跳动的爱心。演示如何用 RF.Plugin 加载外部效果。
(function () {
  if (!window.RF || !RF.Plugin) return;
  RF.Plugin.load({
    id: 'heartbeat',
    desc: '跳动的爱心（插件示例）',
    category: 'plugin',
    params: {
      x: { type: 'number', default: 0.5 },
      y: { type: 'number', default: 0.5 },
      size: { type: 'number', default: 0.15 },
      color: { type: 'string', default: '$accent' },
      bpm: { type: 'number', default: 120 },
    },
    draw: function (ctx, f, params, env) {
      var W = f.W, H = f.H;
      var x = (params.x != null ? params.x : 0.5) * W;
      var y = (params.y != null ? params.y : 0.5) * H;
      var baseSize = (params.size != null ? params.size : 0.15) * Math.min(W, H);
      var color = params.color || (f.palette && f.palette.accent) || '#ff2d95';
      var bpm = params.bpm || 120;
      // 心跳缩放
      var beat = f.t * (bpm / 60) * Math.PI * 2;
      var pulse = 1 + Math.sin(beat) * 0.12 + Math.sin(beat * 2) * 0.06;
      var s = baseSize * pulse * f.easedP;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.3);
      ctx.bezierCurveTo(-s * 0.6, -s * 0.3, -s, s * 0.4, 0, s);
      ctx.bezierCurveTo(s, s * 0.4, s * 0.6, -s * 0.3, 0, s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
  });
})();
