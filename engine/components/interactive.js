// engine/components/interactive.js
// 交互演示组件：鼠标光标、点击波纹、键盘按键、连线箭头。

(function (RF) {
  const FONT = '"Inter","Helvetica Neue",Arial,"Microsoft YaHei",sans-serif';

  function sub(p, start, dur) { return RF.clamp01((p - start) / dur); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // —— 鼠标光标（沿路径移动） ——
  RF.effects.register("cursor", {
    meta: {"category":"interactive","desc":"鼠标光标，沿路径移动。","params":{"points":{"type":"array","default":[[0.2,0.3],[0.6,0.3],[0.6,0.7]],"desc":"路径点 0-1"},"size":{"type":"number","default":0.03},"color":{"type":"string","default":"#ffffff"},"showTrail":{"type":"boolean","default":true}}},
    init(ctx, params, env) {
      const pts = params.points || [[0.2, 0.3], [0.6, 0.3], [0.6, 0.7]];
      return { pts, path: RF.samplePath ? null : null };
    },
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const p = f.easedP;
      const pts = params.points || [[0.2, 0.3], [0.6, 0.3], [0.6, 0.7]];
      const size = (params.size != null ? params.size : 0.03) * Math.min(W, H);
      const color = params.color || "#ffffff";
      const strokeColor = params.strokeColor || "#000000";

      // 沿点段插值
      const totalSegs = pts.length - 1;
      const segProgress = p * totalSegs;
      const segIdx = Math.min(totalSegs - 1, Math.floor(segProgress));
      const localT = RF.Easing.inOutCubic(RF.clamp01(segProgress - segIdx));
      const a = pts[segIdx];
      const b = pts[segIdx + 1];
      const x = lerp(a[0], b[0], localT) * W;
      const y = lerp(a[1], b[1], localT) * H;

      // 画轨迹线（淡）
      if (params.showTrail !== false) {
        ctx.save();
        ctx.strokeStyle = RF.Color.rgba(color, 0.2);
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        pts.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt[0] * W, pt[1] * H);
          else ctx.lineTo(pt[0] * W, pt[1] * H);
        });
        ctx.stroke();
        ctx.restore();
      }

      // 画箭头
      ctx.save();
      ctx.translate(x, y);
      const cursorPath = [
        [0, 0], [0, size * 1.6], [size * 0.45, size * 1.2], [size * 0.75, size * 1.75],
        [size * 1.05, size * 1.6], [size * 0.75, size * 1.05], [size * 1.2, size * 1.05]
      ];
      ctx.beginPath();
      cursorPath.forEach((pt, i) => {
        const px = pt[0] - size * 0.1;
        const py = pt[1] - size * 0.1;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = color;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    },
  });

  // —— 点击波纹 ——
  RF.effects.register("clickRipple", {
    meta: {"category":"interactive","desc":"点击波纹扩散。","params":{"clicks":{"type":"array","default":[{"x":0.5,"y":0.5,"at":0.3}],"desc":"点击点 [{x,y,at,duration}]"},"color":{"type":"string","default":"#ffffff"},"maxRadius":{"type":"number","default":0.08},"lineWidth":{"type":"number","default":3},"dot":{"type":"boolean","default":true}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const p = f.easedP;
      const clicks = params.clicks || [{ x: 0.5, y: 0.5, at: 0.3 }];
      const color = params.color || "#ffffff";

      clicks.forEach((c) => {
        const lp = RF.clamp01((p - c.at) / (c.duration || 0.4));
        if (lp <= 0 || lp >= 1) return;
        const ease = RF.Easing.outCubic(lp);
        const x = c.x * W;
        const y = c.y * H;
        const maxR = (params.maxRadius != null ? params.maxRadius : 0.08) * Math.min(W, H);
        const r = maxR * ease;

        ctx.save();
        ctx.strokeStyle = RF.Color.rgba(color, 1 - lp);
        ctx.lineWidth = (params.lineWidth != null ? params.lineWidth : 3) * (1 - lp);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();

        // 内圈实心点
        if (params.dot !== false) {
          ctx.fillStyle = RF.Color.rgba(color, (1 - lp) * 0.6);
          ctx.beginPath();
          ctx.arc(x, y, maxR * 0.2 * (1 - lp), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    },
  });

  // —— 键盘按键（演示快捷键/输入） ——
  RF.effects.register("keyPress", {
    meta: {"category":"interactive","desc":"键盘按键演示，带按下效果。","params":{"keys":{"type":"array","default":["Ctrl","K"]},"x":{"type":"number","default":0.5},"y":{"type":"number","default":0.5},"keySize":{"type":"number","default":0.06},"bgColor":{"type":"string","default":"#ffffff"},"textColor":{"type":"string","default":"#1a1a1f"},"accentColor":{"type":"string","default":"$accent"}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const keys = params.keys || ["Ctrl", "K"];
      const x = (params.x != null ? params.x : 0.5) * W;
      const y = (params.y != null ? params.y : 0.5) * H;
      const keySize = (params.keySize != null ? params.keySize : 0.06) * Math.min(W, H);
      const gap = keySize * 0.25;
      const bgColor = params.bgColor || "#ffffff";
      const textColor = params.textColor || "#1a1a1f";
      const accentColor = params.accentColor || pal.accent;
      const ease = RF.Easing.outBack(p);

      // 计算总宽
      let totalW = keys.length * keySize + (keys.length - 1) * gap;
      let curX = x - totalW / 2;

      // 每个键的按下状态（错开）
      keys.forEach((k, i) => {
        const press = (i === keys.length - 1) ? RF.clamp01((p - 0.5) * 4) : 0;
        const sc = (i === keys.length - 1) ? 1 - press * 0.08 : 1;
        const cy = y + (i === keys.length - 1 ? press * 3 : 0);

        ctx.save();
        ctx.globalAlpha = ease;
        // 阴影
        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 6;
        // 键体
        ctx.fillStyle = (i === keys.length - 1 && press > 0) ? accentColor : bgColor;
        const r = keySize * 0.15;
        const kx = curX;
        const ky = cy - keySize / 2;
        ctx.beginPath();
        ctx.moveTo(kx + r, ky);
        ctx.arcTo(kx + keySize, ky, kx + keySize, ky + r, r);
        ctx.arcTo(kx + keySize, ky + keySize, kx + keySize - r, ky + keySize, r);
        ctx.arcTo(kx, ky + keySize, kx, ky + keySize - r, r);
        ctx.arcTo(kx, ky, kx + r, ky, r);
        ctx.closePath();
        ctx.fill();

        // 键底边
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = RF.Color.rgba("#000000", 0.1);
        ctx.lineWidth = 2;
        ctx.stroke();

        // 文字
        ctx.fillStyle = (i === keys.length - 1 && press > 0) ? "#ffffff" : textColor;
        ctx.font = "600 " + (keySize * 0.35) + "px " + FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(k, kx + keySize / 2, cy);

        ctx.restore();
        curX += keySize + gap;
      });

      // 中央 "+"（可选）
      if (params.showPlus && keys.length > 1) {
        // 略
      }
    },
  });

  // —— 连线/箭头（连接两个元素） ——
  RF.effects.register("connector", {
    meta: {"category":"interactive","desc":"连线/箭头连接两个点。","params":{"from":{"type":"array","default":[0.2,0.5],"desc":"[x,y] 0-1"},"to":{"type":"array","default":[0.8,0.5]},"style":{"type":"string","default":"straight","range":["straight","curve","elbow"]},"arrow":{"type":"boolean","default":true},"lineWidth":{"type":"number","default":3},"color":{"type":"string","default":"$accent"}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const from = params.from || [0.2, 0.5];
      const to = params.to || [0.8, 0.5];
      const color = params.color || pal.accent;
      const lineWidth = (params.lineWidth != null ? params.lineWidth : 3) * Math.min(W, H) * 0.01;
      const style = params.style || "straight"; // straight | curve | elbow
      const arrow = params.arrow !== false;
      const ease = RF.Easing.outCubic(p);

      const x0 = from[0] * W, y0 = from[1] * H;
      const x1 = to[0] * W, y1 = to[1] * H;
      const cx = (x0 + x1) / 2;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;

      // 已画的路径长度
      const ex = x0 + (x1 - x0) * ease;
      const ey = y0 + (y1 - y0) * ease;

      ctx.beginPath();
      if (style === "straight") {
        ctx.moveTo(x0, y0);
        ctx.lineTo(ex, ey);
      } else if (style === "curve") {
        const midY = (y0 + y1) / 2;
        const cp = [(x0 + x1) / 2, y0 - (y0 - y1) * 0.5];
        // 简化为二次贝塞尔
        for (let s = 0; s <= 32; s++) {
          const t = (s / 32) * ease;
          const mt = 1 - t;
          const px = mt * mt * x0 + 2 * mt * t * cp[0] + t * t * x1;
          const py = mt * mt * y0 + 2 * mt * t * cp[1] + t * t * y1;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
      } else if (style === "elbow") {
        ctx.moveTo(x0, y0);
        ctx.lineTo(cx, y0);
        ctx.lineTo(cx, y1);
        if (ease > 0.66) ctx.lineTo(ex, ey);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 箭头（当画到尽头才显示）
      if (arrow && ease > 0.95) {
        const angle = Math.atan2(y1 - y0, x1 - x0);
        const aSize = lineWidth * 3;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - Math.cos(angle - 0.4) * aSize, y1 - Math.sin(angle - 0.4) * aSize);
        ctx.lineTo(x1 - Math.cos(angle + 0.4) * aSize, y1 - Math.sin(angle + 0.4) * aSize);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },
  });

  // —— 标签云（标签逐个出现）——
  RF.effects.register("tagCloud", {
    meta: {"category":"interactive","desc":"标签云，逐个出现+自动换行。","params":{"tags":{"type":"array","default":["React","TypeScript"]},"x":{"type":"number","default":0.5},"y":{"type":"number","default":0.5},"size":{"type":"number","default":0.024},"maxWidth":{"type":"number","default":0.8},"bgColor":{"type":"string","default":null},"textColor":{"type":"string","default":"$accent"},"borderColor":{"type":"string","default":null},"stagger":{"type":"number","default":0.5}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const tags = params.tags || ["React", "TypeScript", "Node.js", "Vite", "Tailwind"];
      const x = (params.x != null ? params.x : 0.5) * W;
      const y = (params.y != null ? params.y : 0.5) * H;
      const size = (params.size != null ? params.size : 0.024) * W;
      const padding = size * 0.7;
      const gap = size * 0.6;
      const bgColor = params.bgColor || RF.Color.rgba(pal.accent, 0.1);
      const textColor = params.textColor || pal.accent;
      const borderColor = params.borderColor || RF.Color.rgba(pal.accent, 0.4);
      const stagger = params.stagger != null ? params.stagger : 0.5;

      ctx.save();
      ctx.font = "600 " + size + "px " + FONT;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      // 计算每个标签尺寸
      const items = tags.map((t) => ({
        text: t,
        w: ctx.measureText(t).width + padding * 2,
        h: size + padding * 1.2,
      }));
      const totalW = items.reduce((s, it) => s + it.w, 0) + gap * (items.length - 1);

      // 若超过容器宽度则换行（简化：按需换行）
      const maxW = (params.maxWidth != null ? params.maxWidth : 0.8) * W;
      const lines = [];
      let curLine = [];
      let curW = 0;
      items.forEach((it) => {
        if (curW + it.w > maxW && curLine.length) {
          lines.push({ items: curLine, w: curW - gap });
          curLine = [];
          curW = 0;
        }
        curLine.push(it);
        curW += it.w + gap;
      });
      if (curLine.length) lines.push({ items: curLine, w: curW - gap });

      const lineGap = size * 1.4;
      const totalH = lines.length * lineGap;
      let startY = y - totalH / 2 + lineGap / 2;

      lines.forEach((line, li) => {
        let startX = x - line.w / 2;
        line.items.forEach((it, ii) => {
          const idx = lines.slice(0, li).reduce((s, l) => s + l.items.length, 0) + ii;
          const d = (idx / items.length) * stagger;
          const lp = RF.clamp01((p - d) / (1 - stagger));
          if (lp <= 0) return;
          const ease = RF.Easing.outBack(lp);
          const scale = 0.7 + 0.3 * ease;
          const alpha = ease;
          const cx = startX + it.w / 2;
          const cy = startY + li * lineGap;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(cx, cy);
          ctx.scale(scale, scale);
          // 标签背景
          const r = it.h / 2;
          ctx.beginPath();
          ctx.moveTo(-it.w / 2 + r, -it.h / 2);
          ctx.arcTo(it.w / 2, -it.h / 2, it.w / 2, -it.h / 2 + r, r);
          ctx.arcTo(it.w / 2, it.h / 2, it.w / 2 - r, it.h / 2, r);
          ctx.arcTo(-it.w / 2, it.h / 2, -it.w / 2, it.h / 2 - r, r);
          ctx.arcTo(-it.w / 2, -it.h / 2, -it.w / 2 + r, -it.h / 2, r);
          ctx.closePath();
          ctx.fillStyle = bgColor;
          ctx.fill();
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // 文字
          ctx.fillStyle = textColor;
          ctx.textAlign = "center";
          ctx.fillText(it.text, 0, 0);
          ctx.restore();

          startX += it.w + gap;
        });
      });
      ctx.restore();
    },
  });
})(window.RF = window.RF || {});