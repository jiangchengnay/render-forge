// engine/components/data-viz.js
// 数据可视化组件：数字滚动、进度环、条形图、折线图、饼图、雷达图。
// 这类组件是"正经产品片"最常见的元素。

(function (RF) {
  const FONT = '"Inter","Helvetica Neue",Arial,"Microsoft YaHei",sans-serif';
  const MONO = '"JetBrains Mono","SF Mono",Consolas,monospace';

  function sub(p, start, dur) { return RF.clamp01((p - start) / dur); }

  // —— 数字滚动 ——
  RF.effects.register("counterNumber", {
    meta: {"category":"data","desc":"数字滚动（带千分位、前后缀）。","params":{"from":{"type":"number","default":0},"to":{"type":"number","default":1000},"decimals":{"type":"number","default":0},"prefix":{"type":"string","default":""},"suffix":{"type":"string","default":""},"x":{"type":"number","default":0.5},"y":{"type":"number","default":0.5},"size":{"type":"number","default":0.12},"weight":{"type":"number","default":800},"color":{"type":"string","default":"$fg"},"colorAccent":{"type":"string","default":"$accent"},"comma":{"type":"boolean","default":true}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const from = params.from != null ? params.from : 0;
      const to = params.to != null ? params.to : 1000;
      const ease = RF.Easing.outExpo(p);
      const value = from + (to - from) * ease;
      const decimals = params.decimals != null ? params.decimals : 0;
      const prefix = params.prefix || "";
      const suffix = params.suffix || "";
      const x = (params.x != null ? params.x : 0.5) * W;
      const y = (params.y != null ? params.y : 0.5) * H;
      const size = (params.size != null ? params.size : 0.12) * W;
      const weight = params.weight != null ? params.weight : 800;
      const color = params.color || pal.fg;
      const colorAccent = params.colorAccent || pal.accent;

      ctx.save();
      ctx.font = weight + " " + size + "px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const numStr = value.toFixed(decimals);
      // 千分位
      const withComma = params.comma !== false
        ? numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        : numStr;
      const full = prefix + withComma + suffix;

      // 底影
      ctx.fillStyle = RF.Color.rgba("#000000", 0.15);
      ctx.fillText(full, x + 3, y + 4);
      // 主文字
      ctx.fillStyle = color;
      ctx.fillText(full, x, y);

      // 后缀单位用强调色
      if (suffix) {
        const mainW = ctx.measureText(prefix + withComma).width;
        ctx.fillStyle = colorAccent;
        ctx.textAlign = "left";
        ctx.fillText(suffix, x + mainW / 2, y);
      }
      ctx.restore();
    },
  });

  // —— 进度环（圆环进度条） ——
  RF.effects.register("progressRing", {
    meta: {"category":"data","desc":"圆环进度条。","params":{"x":{"type":"number","default":0.5},"y":{"type":"number","default":0.5},"radius":{"type":"number","default":0.15},"lineWidth":{"type":"number","default":0.02},"value":{"type":"number","default":0.75,"desc":"0-1 进度"},"label":{"type":"string","default":null,"desc":"中心文字，默认百分比"},"color":{"type":"string","default":"$accent"},"bgColor":{"type":"string","default":null},"fontSize":{"type":"number","default":null}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const cx = (params.x != null ? params.x : 0.5) * W;
      const cy = (params.y != null ? params.y : 0.5) * H;
      const r = (params.radius != null ? params.radius : 0.15) * Math.min(W, H);
      const lineWidth = (params.lineWidth != null ? params.lineWidth : 0.02) * Math.min(W, H);
      const target = params.value != null ? params.value : 0.75;
      const colorBg = params.bgColor || RF.Color.rgba(pal.fg, 0.12);
      const colorFg = params.color || pal.accent;
      const startAngle = params.startAngle != null ? params.startAngle : -Math.PI / 2;
      const gap = params.gap != null ? params.gap : 0;

      // 环底
      ctx.save();
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.strokeStyle = colorBg;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + Math.PI * 2);
      ctx.stroke();

      // 进度
      const ease = RF.Easing.outCubic(p);
      const endAngle = startAngle + Math.PI * 2 * target * ease;
      ctx.strokeStyle = colorFg;
      ctx.shadowColor = colorFg;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 中心文字
      if (params.label != null || params.showValue !== false) {
        const value = Math.round((target * ease) * 100);
        const text = params.label != null ? params.label : value + "%";
        const fontSize = params.fontSize != null ? params.fontSize : r * 0.5;
        ctx.font = "700 " + fontSize + "px " + FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = params.textColor || pal.fg;
        ctx.fillText(text, cx, cy);
      }
      ctx.restore();
    },
  });

  // —— 条形图 ——
  RF.effects.register("barChart", {
    meta: {"category":"data","desc":"条形图，逐条生长。","params":{"x":{"type":"number","default":0.15},"y":{"type":"number","default":0.3},"w":{"type":"number","default":0.7},"h":{"type":"number","default":0.4},"values":{"type":"array","default":[0.4,0.7,0.5,0.9,0.6],"desc":"0-1 数组"},"labels":{"type":"array","default":null},"gap":{"type":"number","default":0.15},"colors":{"type":"array","default":null},"labelSize":{"type":"number","default":0.016},"stagger":{"type":"number","default":0.4}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const x = (params.x != null ? params.x : 0.15) * W;
      const y = (params.y != null ? params.y : 0.3) * H;
      const w = (params.w != null ? params.w : 0.7) * W;
      const h = (params.h != null ? params.h : 0.4) * H;
      const values = params.values || [0.4, 0.7, 0.5, 0.9, 0.6];
      const labels = params.labels || null;
      const gap = (params.gap != null ? params.gap : 0.15);
      const colors = params.colors || [pal.accent, pal.colors[1] || pal.accent];
      const labelSize = (params.labelSize != null ? params.labelSize : 0.016) * W;
      const stagger = params.stagger != null ? params.stagger : 0.4;
      const n = values.length;
      const barW = (w / n) * (1 - gap);

      ctx.save();
      for (let i = 0; i < n; i++) {
        const d = (i / n) * stagger;
        const lp = RF.clamp01((p - d) / (1 - stagger));
        const ease = RF.Easing.outCubic(lp);
        const bx = x + (w / n) * i + (w / n - barW) / 2;
        const bh = h * values[i] * ease;
        const by = y + h - bh;

        // 柱
        const col = colors[i % colors.length];
        const g = ctx.createLinearGradient(bx, by, bx, y + h);
        g.addColorStop(0, col);
        g.addColorStop(1, RF.Color.rgba(col, 0.4));
        ctx.fillStyle = g;
        ctx.beginPath();
        const r = Math.min(6, barW / 4);
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + barW - r, by);
        ctx.arcTo(bx + barW, by, bx + barW, by + r, r);
        ctx.lineTo(bx + barW, y + h);
        ctx.lineTo(bx, y + h);
        ctx.lineTo(bx, by + r);
        ctx.arcTo(bx, by, bx + r, by, r);
        ctx.closePath();
        ctx.fill();

        // 标签
        if (labels) {
          ctx.font = "500 " + labelSize + "px " + FONT;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = RF.Color.rgba(pal.fg, 0.7 * ease);
          ctx.fillText(labels[i], bx + barW / 2, y + h + labelSize * 0.5);
        }
      }
      // 底轴
      ctx.strokeStyle = RF.Color.rgba(pal.fg, 0.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.stroke();
      ctx.restore();
    },
  });

  // —— 折线图（带生长动画） ——
  RF.effects.register("lineChart", {
    meta: {"category":"data","desc":"折线图，生长+端点+填充。","params":{"x":{"type":"number","default":0.15},"y":{"type":"number","default":0.3},"w":{"type":"number","default":0.7},"h":{"type":"number","default":0.4},"values":{"type":"array","default":[0.2,0.5,0.35,0.7,0.55,0.9,0.75]},"color":{"type":"string","default":"$accent"},"lineWidth":{"type":"number","default":3},"fill":{"type":"boolean","default":true},"grid":{"type":"boolean","default":true},"dots":{"type":"boolean","default":true}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const x = (params.x != null ? params.x : 0.15) * W;
      const y = (params.y != null ? params.y : 0.3) * H;
      const w = (params.w != null ? params.w : 0.7) * W;
      const h = (params.h != null ? params.h : 0.4) * H;
      const values = params.values || [0.2, 0.5, 0.35, 0.7, 0.55, 0.9, 0.75];
      const color = params.color || pal.accent;
      const lineWidth = params.lineWidth != null ? params.lineWidth : 3;
      const fill = params.fill !== false;
      const n = values.length;
      const ease = RF.Easing.outCubic(p);

      // 网格
      if (params.grid !== false) {
        ctx.save();
        ctx.strokeStyle = RF.Color.rgba(pal.fg, 0.08);
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(x, y + (h / 4) * i);
          ctx.lineTo(x + w, y + (h / 4) * i);
          ctx.stroke();
        }
        ctx.restore();
      }

      const pts = values.map((v, i) => [
        x + (w / (n - 1)) * i,
        y + h - h * v,
      ]);

      // 填充
      if (fill) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0][0], y + h);
        const cutoff = Math.floor((n - 1) * ease) + 1;
        for (let i = 0; i < cutoff; i++) {
          const pt = pts[i];
          if (i === cutoff - 1 && ease < 1) {
            // 插值
            const prev = pts[i - 1] || pts[0];
            const t = ((n - 1) * ease) - (i - 1);
            const ix = prev[0] + (pt[0] - prev[0]) * t;
            const iy = prev[1] + (pt[1] - prev[1]) * t;
            ctx.lineTo(ix, iy);
            ctx.lineTo(ix, y + h);
            break;
          }
          ctx.lineTo(pt[0], pt[1]);
        }
        ctx.closePath();
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, RF.Color.rgba(color, 0.4));
        g.addColorStop(1, RF.Color.rgba(color, 0.02));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
      }

      // 线
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      const cutoff = Math.floor((n - 1) * ease) + 1;
      for (let i = 0; i < cutoff && i < n; i++) {
        const pt = pts[i];
        if (i === cutoff - 1 && ease < 1 && i > 0) {
          const prev = pts[i - 1];
          const t = ((n - 1) * ease) - (i - 1);
          const ix = prev[0] + (pt[0] - prev[0]) * t;
          const iy = prev[1] + (pt[1] - prev[1]) * t;
          ctx.lineTo(ix, iy);
          break;
        }
        if (i === 0) ctx.moveTo(pt[0], pt[1]);
        else ctx.lineTo(pt[0], pt[1]);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 端点
      if (params.dots !== false) {
        pts.forEach((pt, i) => {
          const appear = i / (n - 1);
          if (ease < appear) return;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(pt[0], pt[1], lineWidth * 1.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      }
      ctx.restore();
    },
  });

  // —— 饼图/环形图 ——
  RF.effects.register("pieChart", {
    meta: {"category":"data","desc":"饼图/环图。","params":{"x":{"type":"number","default":0.5},"y":{"type":"number","default":0.5},"radius":{"type":"number","default":0.18},"inner":{"type":"number","default":0,"desc":"0-1，>0 为环图"},"values":{"type":"array","default":[0.3,0.25,0.2,0.15,0.1]},"colors":{"type":"array","default":null},"startAngle":{"type":"number","default":-1.5708},"gap":{"type":"number","default":0.02}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const cx = (params.x != null ? params.x : 0.5) * W;
      const cy = (params.y != null ? params.y : 0.5) * H;
      const r = (params.radius != null ? params.radius : 0.18) * Math.min(W, H);
      const innerR = (params.inner != null ? params.inner : 0) * r;
      const values = params.values || [0.3, 0.25, 0.2, 0.15, 0.1];
      const colors = params.colors || pal.colors;
      const ease = RF.Easing.outCubic(p);
      const gapRad = params.gap != null ? params.gap : 0.02;

      let total = values.reduce((s, v) => s + v, 0);
      let angle = params.startAngle != null ? params.startAngle : -Math.PI / 2;

      ctx.save();
      values.forEach((v, i) => {
        const portion = (v / total) * Math.PI * 2 * ease;
        const col = colors[i % colors.length];
        ctx.fillStyle = col;
        ctx.beginPath();
        if (innerR > 0) {
          ctx.arc(cx, cy, r, angle + gapRad / 2, angle + portion - gapRad / 2);
          ctx.arc(cx, cy, innerR, angle + portion - gapRad / 2, angle + gapRad / 2, true);
        } else {
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, r, angle + gapRad / 2, angle + portion - gapRad / 2);
        }
        ctx.closePath();
        ctx.fill();
        angle += portion;
      });
      ctx.restore();
    },
  });

  // —— 雷达图 ——
  RF.effects.register("radarChart", {
    meta: {"category":"data","desc":"雷达图。","params":{"x":{"type":"number","default":0.5},"y":{"type":"number","default":0.5},"radius":{"type":"number","default":0.2},"values":{"type":"array","default":[0.7,0.5,0.9,0.6,0.8]},"labels":{"type":"array","default":null},"color":{"type":"string","default":"$accent"},"labelSize":{"type":"number","default":0.018}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const cx = (params.x != null ? params.x : 0.5) * W;
      const cy = (params.y != null ? params.y : 0.5) * H;
      const r = (params.radius != null ? params.radius : 0.2) * Math.min(W, H);
      const values = params.values || [0.7, 0.5, 0.9, 0.6, 0.8];
      const labels = params.labels || null;
      const color = params.color || pal.accent;
      const n = values.length;
      const ease = RF.Easing.outCubic(p);

      // 底网格（同心多边形）
      ctx.save();
      ctx.strokeStyle = RF.Color.rgba(pal.fg, 0.12);
      ctx.lineWidth = 1;
      const rings = 4;
      for (let ring = 1; ring <= rings; ring++) {
        const rr = r * (ring / rings);
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const px = cx + Math.cos(a) * rr;
          const py = cy + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      // 轴
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.stroke();
      }

      // 数据多边形
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const rr = r * values[i] * ease;
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = RF.Color.rgba(color, 0.25);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 顶点
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const rr = r * values[i] * ease;
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 标签
      if (labels) {
        const labelSize = (params.labelSize != null ? params.labelSize : 0.018) * W;
        ctx.font = "500 " + labelSize + "px " + FONT;
        ctx.fillStyle = RF.Color.rgba(pal.fg, 0.8);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const lx = cx + Math.cos(a) * (r + labelSize * 1.5);
          const ly = cy + Math.sin(a) * (r + labelSize * 1.5);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(labels[i], lx, ly);
        }
      }
      ctx.restore();
    },
  });
})(window.RF = window.RF || {});