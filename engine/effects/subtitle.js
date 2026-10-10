// engine/effects/subtitle.js
// SRT 字幕：解析 + 按时间显示。
// 用法：RF.Subtitles.load('id', srtText) 先载入，再用 { effect: 'subtitle', params: { src: 'id' } }
(function (RF) {
  var SUBS = {};

  function parseSRT(text) {
    var cues = [];
    var blocks = String(text).replace(/\r/g, '').split(/\n\s*\n/);
    blocks.forEach(function (b) {
      var lines = b.split('\n').filter(function (l) { return l.trim(); });
      if (lines.length < 2) return;
      var timeIdx = -1;
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('-->') >= 0) { timeIdx = i; break; }
      }
      if (timeIdx < 0) return;
      var m = lines[timeIdx].match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/);
      if (!m) return;
      var start = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000;
      var end = (+m[5]) * 3600 + (+m[6]) * 60 + (+m[7]) + (+m[8]) / 1000;
      var text2 = lines.slice(timeIdx + 1).join('\n');
      cues.push({ start: start, end: end, text: text2 });
    });
    return cues;
  }

  function load(id, srtText) { SUBS[id] = parseSRT(srtText); return SUBS[id]; }

  function getActive(id, t) {
    var cues = SUBS[id];
    if (!cues) return [];
    var out = [];
    for (var i = 0; i < cues.length; i++) {
      if (t >= cues[i].start && t <= cues[i].end) out.push(cues[i]);
    }
    return out;
  }

  RF.effects.register('subtitle', {
    meta: {
      category: 'text',
      desc: '显示 SRT 字幕（按全局时间自动切换，支持自动换行）。',
      params: {
        src: { type: 'string', desc: '字幕 id' },
        x: { type: 'number', default: 0.5 },
        y: { type: 'number', default: 0.88 },
        size: { type: 'number', default: 0.028 },
        weight: { type: 'number', default: 600 },
        color: { type: 'string', default: '#ffffff' },
        bgColor: { type: 'string', default: 'rgba(0,0,0,0.5)' },
        padding: { type: 'number', default: 0.012 },
        maxWidth: { type: 'number', default: 0.8 }
      }
    },
    draw: function (ctx, f, params, env) {
      var cues = getActive(params.src, f.t);
      if (!cues.length) return;
      var W = f.W, H = f.H;
      var x = (params.x != null ? params.x : 0.5) * W;
      var y = (params.y != null ? params.y : 0.88) * H;
      var size = (params.size != null ? params.size : 0.028) * W;
      var weight = params.weight != null ? params.weight : 600;
      var color = params.color || '#ffffff';
      var bg = params.bgColor || 'rgba(0,0,0,0.5)';
      var pad = (params.padding != null ? params.padding : 0.012) * W;
      var maxW = (params.maxWidth != null ? params.maxWidth : 0.8) * W;
      var font = weight + ' ' + size + 'px "Inter","Microsoft YaHei",sans-serif';
      ctx.save();
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      cues.forEach(function (cue) {
        var layout = RF.Typography
          ? RF.Typography.layoutText(ctx, cue.text, { font: font, maxWidth: maxW, lineHeight: size * 1.4 })
          : { lines: [{ text: cue.text, width: ctx.measureText(cue.text).width }], lineHeight: size * 1.4 };
        var lines = layout.lines;
        var lh = layout.lineHeight;
        var totalH = lines.length * lh;
        var startY = y - totalH / 2 + lh / 2;
        var boxW = Math.max.apply(null, lines.map(function (l) { return l.width; })) + pad * 2;
        var boxH = totalH + pad * 1.2;
        ctx.fillStyle = bg;
        ctx.fillRect(x - boxW / 2, y - boxH / 2, boxW, boxH);
        ctx.fillStyle = color;
        lines.forEach(function (line, i) {
          ctx.fillText(line.text, x, startY + i * lh);
        });
      });
      ctx.restore();
    }
  });

  RF.Subtitles = { load: load, parseSRT: parseSRT, getActive: getActive, list: function () { return Object.keys(SUBS); } };
})(window.RF = window.RF || {});
