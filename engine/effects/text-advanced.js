// engine/effects/text-advanced.js
// 高级文字排版：产品片大标题、MV 歌词逐字高亮、贝塞尔路径运动。

(function (RF) {
  const FONT_STACK = '"Inter","Helvetica Neue",Arial,"Microsoft YaHei",sans-serif';
  const MONO_STACK = '"JetBrains Mono","SF Mono",Consolas,monospace';

  function applyFont(ctx, params, W) {
    const size = params.size != null ? params.size : 0.08;
    const weight = params.weight != null ? params.weight : 600;
    const family = params.mono ? MONO_STACK : FONT_STACK;
    const px = size * W;
    ctx.font = weight + " " + px + "px " + family;
    ctx.textAlign = params.align || "center";
    ctx.textBaseline = params.baseline || "middle";
  }

  // —— 大标题排版（产品片/开源项目宣发）——
  // 支持：主标题 + 副标题 + 标签/徽章 + 分隔线
  RF.effects.register("titleCard", {
    meta: {"category":"text","desc":"产品片大标题卡：徽章+主标+副标+标签+分隔线，逐字进入。","params":{"title":{"type":"string","default":"TITLE","desc":"主标题"},"subtitle":{"type":"string","default":"","desc":"副标题"},"badge":{"type":"string","default":"","desc":"徽章文字（上方胶囊）"},"tag":{"type":"string","default":"","desc":"底部标签"},"x":{"type":"number","default":0.5,"range":[0,1]},"y":{"type":"number","default":0.5,"range":[0,1]},"titleSize":{"type":"number","default":0.075,"desc":"主标题字号（相对画布宽）"},"titleWeight":{"type":"number","default":700},"subSize":{"type":"number","default":0.028},"badgeSize":{"type":"number","default":0.018},"tagSize":{"type":"number","default":0.018},"stagger":{"type":"number","default":0.4,"desc":"逐字延迟比例"},"divider":{"type":"boolean","default":true,"desc":"是否显示分隔线"}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const eOut = RF.Easing.outCubic(p);
      const eIn = RF.Easing.outExpo(p);

      const title = params.title || "TITLE";
      const subtitle = params.subtitle || "";
      const badge = params.badge || "";
      const tag = params.tag || "";
      const colorTitle = params.colorTitle || pal.fg;
      const colorSub = params.colorSub || RF.Color.shift(pal.fg, -0.3);
      const colorAccent = params.colorAccent || pal.accent;
      const align = params.align || "center";
      const cx = (params.x != null ? params.x : 0.5) * W;
      const cy = (params.y != null ? params.y : 0.5) * H;

      ctx.save();
      // —— badge 徽章 ——
      let cursorY = cy;
      if (badge) {
        const badgeSize = (params.badgeSize != null ? params.badgeSize : 0.022) * W;
        ctx.font = "600 " + badgeSize + "px " + FONT_STACK;
        const bw = ctx.measureText(badge).width + badgeSize * 2;
        const bh = badgeSize * 2.2;
        const bx = align === "center" ? cx - bw / 2 : (align === "right" ? cx - bw : cx);
        const by = cursorY - bh / 2 - 0.1 * H * eOut;
        ctx.globalAlpha = eOut;
        // 圆角矩形
        const r = bh / 2;
        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + bw - r, by);
        ctx.arcTo(bx + bw, by, bx + bw, by + r, r);
        ctx.lineTo(bx + bw, by + bh - r);
        ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r);
        ctx.lineTo(bx + r, by + bh);
        ctx.arcTo(bx, by + bh, bx, by + bh - r, r);
        ctx.lineTo(bx, by + r);
        ctx.arcTo(bx, by, bx + r, by, r);
        ctx.closePath();
        ctx.fillStyle = RF.Color.rgba(colorAccent, 0.15 * eOut);
        ctx.fill();
        ctx.strokeStyle = RF.Color.rgba(colorAccent, 0.5 * eOut);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = colorAccent;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(badge, bx + bw / 2, by + bh / 2);
        cursorY += bh * 0.6;
        ctx.globalAlpha = 1;
      }

      // —— 主标题（支持中文自动换行）——
      const titleSize = (params.titleSize != null ? params.titleSize : 0.1) * W;
      const titleFont = (params.titleWeight || 700) + " " + titleSize + "px " + FONT_STACK;
      ctx.font = titleFont;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      // 计算最大宽度（安全区）
      const safeMargin = params.safeMargin != null ? params.safeMargin : 0.08;
      const maxW = W * (1 - safeMargin * 2);
      // 用排版引擎断行
      const layout = RF.Typography
        ? RF.Typography.layoutText(ctx, title, { font: titleFont, maxWidth: maxW, lineHeight: titleSize * 1.2 })
        : { lines: [{ text: title, width: ctx.measureText(title).width }], lineHeight: titleSize * 1.2 };
      const lines = layout.lines;
      const lineH = layout.lineHeight;
      const totalTextH = lines.length * lineH;
      // 起始 y（垂直居中于 cursorY）
      const titleStartY = cursorY - totalTextH / 2 + lineH / 2;

      // 逐字 stagger（跨行连续）
      const allChars = lines.reduce((arr, l) => arr.concat([...l.text]), []);
      const stagger = params.stagger != null ? params.stagger : 0.4;
      let globalCharIdx = 0;
      ctx.globalAlpha = 1;

      lines.forEach((line, li) => {
        const lineChars = [...line.text];
        let curX = align === "center" ? cx - line.width / 2
                 : align === "right" ? cx - line.width
                 : cx;
        const cy2 = titleStartY + li * lineH;
        for (let i = 0; i < lineChars.length; i++) {
          const d = allChars.length > 1 ? (globalCharIdx / (allChars.length - 1)) * stagger : 0;
          const lp = RF.clamp01((p - d) / (1 - stagger));
          const ease = RF.Easing.outBack(lp);
          const chW = ctx.measureText(lineChars[i]).width;
          ctx.save();
          ctx.globalAlpha = lp;
          ctx.translate(curX + chW / 2, cy2 + (1 - ease) * titleSize * 0.5);
          ctx.scale(0.7 + 0.3 * ease, 0.7 + 0.3 * ease);
          ctx.fillStyle = colorTitle;
          ctx.fillText(lineChars[i], -chW / 2, 0);
          ctx.restore();
          curX += chW;
          globalCharIdx++;
        }
      });

      // 记录总宽供后续 divider 用（取最宽行）
      const totalW = Math.max.apply(null, lines.map(l => l.width));
      // 分隔线 y 下移到文本底部
      cursorY = cursorY + totalTextH / 2 - lineH / 2;

      // —— 分隔线 ——
      if (params.divider !== false) {
        const lineY = cursorY + titleSize * 0.7;
        const lineW = totalW * 0.6 * eIn;
        const lineX = align === "center" ? cx - lineW / 2 : (align === "right" ? cx - lineW : cx);
        ctx.globalAlpha = eIn;
        ctx.fillStyle = RF.Color.rgba(colorAccent, 0.6);
        ctx.fillRect(lineX, lineY, lineW, Math.max(1, W * 0.002));
        ctx.globalAlpha = 1;
      }

      // —— 副标题 ——
      if (subtitle) {
        const subSize = (params.subSize != null ? params.subSize : 0.032) * W;
        ctx.font = (params.subWeight || 400) + " " + subSize + "px " + FONT_STACK;
        ctx.fillStyle = colorSub;
        ctx.globalAlpha = eIn * (params.subAlpha != null ? params.subAlpha : 1);
        const subY = cursorY + titleSize * 0.7 + subSize * 1.6;
        ctx.fillText(subtitle, cx, subY);
        ctx.globalAlpha = 1;

        // —— tag（小标签，放在副标题下方或右侧）——
        if (tag) {
          const tagSize = (params.tagSize != null ? params.tagSize : 0.02) * W;
          ctx.font = "500 " + tagSize + "px " + MONO_STACK;
          ctx.fillStyle = RF.Color.rgba(colorAccent, 0.8);
          ctx.globalAlpha = eIn;
          ctx.fillText(tag, cx, subY + subSize * 1.6);
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    },
  });

  // —— MV 歌词：逐字高亮（配合 BGM 的 Karaoke 式）——
  // 支持：整体淡入、逐字填充、扫描线
  RF.effects.register("lyricLine", {
    meta: {"category":"text","desc":"MV 歌词，三种高亮模式。","params":{"text":{"type":"string","desc":"歌词文本"},"x":{"type":"number","default":0.5},"y":{"type":"number","default":0.5},"size":{"type":"number","default":0.06,"desc":"字号（相对画布宽）"},"weight":{"type":"number","default":600},"mode":{"type":"string","default":"fill","range":["fill","scan","fade"],"desc":"高亮模式"},"colorBase":{"type":"string","default":"rgba(255,255,255,0.25)"},"colorHi":{"type":"string","default":"$fg"},"colorGlow":{"type":"string","default":"$accent"},"glow":{"type":"boolean","default":true}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const text = params.text || "";
      const p = f.easedP;
      const size = (params.size != null ? params.size : 0.06) * W;
      const weight = params.weight != null ? params.weight : 600;
      const colorBase = params.colorBase || RF.Color.rgba(pal.fg, 0.25);
      const colorHi = params.colorHi || pal.fg;
      const colorGlow = params.colorGlow || pal.accent;
      const cx = (params.x != null ? params.x : 0.5) * W;
      const cy = (params.y != null ? params.y : 0.5) * H;
      const align = params.align || "center";
      const mode = params.mode || "fill"; // fill | scan | fade

      ctx.save();
      ctx.font = weight + " " + size + "px " + FONT_STACK;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";

      const chars = [...text];
      const totalW = ctx.measureText(text).width;
      let startX = align === "center" ? cx - totalW / 2 : (align === "right" ? cx - totalW : cx);

      // 先画基础（暗淡）
      ctx.fillStyle = colorBase;
      ctx.globalAlpha = Math.min(1, p * 3); // 快速淡入基础文字
      ctx.fillText(text, cx, cy);
      ctx.globalAlpha = 1;

      if (mode === "fill") {
        // 逐字高亮：进度 p 控制当前亮到第几字
        const totalProgress = p; // 0..1
        const charProgress = totalProgress * chars.length;
        let curX = startX;
        for (let i = 0; i < chars.length; i++) {
          const chW = ctx.measureText(chars[i]).width;
          const localP = RF.clamp01(charProgress - i);
          if (localP > 0) {
            // 当前字或之前的字
            ctx.save();
            ctx.globalAlpha = localP;
            ctx.fillStyle = colorHi;
            if (params.glow !== false) {
              ctx.shadowColor = colorGlow;
              ctx.shadowBlur = size * 0.4 * localP;
            }
            ctx.fillText(chars[i], curX + chW / 2, cy);
            ctx.restore();
          }
          curX += chW;
        }
      } else if (mode === "scan") {
        // 扫描线高亮
        const scanW = totalW * 0.4;
        const scanX = -scanW + (totalW + scanW * 2) * p;
        ctx.save();
        ctx.beginPath();
        ctx.rect(startX + scanX - scanW / 2, cy - size, scanW, size * 2);
        ctx.clip();
        ctx.fillStyle = colorHi;
        if (params.glow !== false) {
          ctx.shadowColor = colorGlow;
          ctx.shadowBlur = size * 0.2;
        }
        ctx.fillText(text, cx, cy);
        ctx.restore();
      } else if (mode === "fade") {
        // 整体渐亮
        ctx.save();
        ctx.globalAlpha = p;
        ctx.fillStyle = colorHi;
        if (params.glow !== false) {
          ctx.shadowColor = colorGlow;
          ctx.shadowBlur = size * 0.3;
        }
        ctx.fillText(text, cx, cy);
        ctx.restore();
      }
      ctx.restore();
    },
  });

  // —— 沿贝塞尔曲线运动的文字/元素 ——
  // 支持：三次贝塞尔曲线路径 + 沿线运动的文字（或单字）
  RF.effects.register("bezierText", {
    meta: {"category":"text","desc":"文字沿 Catmull-Rom 曲线排布。","params":{"text":{"type":"string"},"points":{"type":"array","desc":"控制点 [[x,y],...]，坐标 0-1","default":[[0.1,0.8],[0.3,0.2],[0.7,0.8],[0.9,0.2]]},"size":{"type":"number","default":0.05},"weight":{"type":"number","default":600},"spread":{"type":"number","default":1.5,"desc":"字间采样间隔"},"showPath":{"type":"boolean","default":true},"pathWidth":{"type":"number","default":1.5},"samples":{"type":"number","default":200},"color":{"type":"string","default":"$fg"},"colorPath":{"type":"string","default":"rgba(255,255,255,0.3)"}}},
    init(ctx, params, env) {
      // 支持多段贝塞尔：points 数组，每 4 个点一段（p0, c0, c1, p1）
      // 简化：用 points 数组（至少 2 个），自动平滑连接成 Catmull-Rom → 再采样
      const pts = params.points || [
        [0.1, 0.8], [0.3, 0.2], [0.7, 0.8], [0.9, 0.2]
      ];
      // Catmull-Rom 插值成密集点
      const samples = params.samples != null ? params.samples : 200;
      const path = [];
      const n = pts.length;
      for (let i = 0; i < n - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(n - 1, i + 2)];
        const seg = Math.max(2, Math.floor(samples / (n - 1)));
        for (let j = 0; j < seg; j++) {
          const t = j / seg;
          const t2 = t * t, t3 = t2 * t;
          const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
          const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
          path.push([x, y]);
        }
      }
      return { path };
    },

    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const st = f.state;
      const path = st.path;
      const p = f.easedP;
      const text = params.text || "";
      const size = (params.size != null ? params.size : 0.05) * W;
      const color = params.color || pal.fg;
      const colorPath = params.colorPath || RF.Color.rgba(pal.accent, 0.3);
      const showPath = params.showPath !== false;
      const chars = [...text];
      const spread = params.spread != null ? params.spread : 1.5; // 每个字之间的路径采样间隔

      // 画路径（可选）
      if (showPath) {
        ctx.save();
        ctx.strokeStyle = colorPath;
        ctx.lineWidth = params.pathWidth != null ? params.pathWidth : 1.5;
        ctx.beginPath();
        path.forEach((pt, i) => {
          const x = pt[0] * W, y = pt[1] * H;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.restore();
      }

      // 文字沿路径分布 + 整体进度 p 决定已画出多少
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = (params.weight || 600) + " " + size + "px " + FONT_STACK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const totalChars = chars.length;
      const step = Math.max(1, Math.floor(path.length / (totalChars * spread + 1)));
      for (let i = 0; i < totalChars; i++) {
        const pathIdx = Math.floor((i * spread + 1) * step);
        if (pathIdx >= path.length) break;
        // 该字出现的进度
        const appearAt = i / totalChars;
        const localP = RF.clamp01((p - appearAt) * 3);
        if (localP <= 0) continue;
        const pt = path[pathIdx];
        const x = pt[0] * W;
        const y = pt[1] * H;
        // 切线方向
        const nextPt = path[Math.min(path.length - 1, pathIdx + step)];
        const angle = Math.atan2((nextPt[1] - pt[1]) * H, (nextPt[0] - pt[0]) * W);

        ctx.save();
        ctx.globalAlpha = localP;
        ctx.translate(x, y);
        ctx.rotate(angle);
        const sc = 0.6 + 0.4 * localP;
        ctx.scale(sc, sc);
        ctx.fillText(chars[i], 0, 0);
        ctx.restore();
      }
      ctx.restore();
    },
  });

  // —— 大段落逐行出现（产品简介/开源项目特性列表）——
  RF.effects.register("bulletList", {
    meta: {"category":"text","desc":"特性列表，逐项出现。","params":{"items":{"type":"array","desc":"列表项字符串数组"},"x":{"type":"number","default":0.15},"y":{"type":"number","default":0.35},"size":{"type":"number","default":0.03},"weight":{"type":"number","default":500},"lineGap":{"type":"number","default":0.08,"desc":"行间距（相对高）"},"color":{"type":"string","default":"$fg"},"colorBullet":{"type":"string","default":"$accent"},"stagger":{"type":"number","default":0.5}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const items = params.items || ["Feature 1", "Feature 2", "Feature 3"];
      const p = f.easedP;
      const size = (params.size != null ? params.size : 0.03) * W;
      const color = params.color || pal.fg;
      const colorBullet = params.colorBullet || pal.accent;
      const x = (params.x != null ? params.x : 0.15) * W;
      const y = (params.y != null ? params.y : 0.35) * H;
      const lineGap = (params.lineGap != null ? params.lineGap : 0.08) * H;
      const stagger = params.stagger != null ? params.stagger : 0.5;

      ctx.save();
      ctx.font = (params.weight || 500) + " " + size + "px " + FONT_STACK;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const bulletSize = size * 0.5;

      items.forEach((item, i) => {
        const d = items.length > 1 ? (i / (items.length - 1)) * stagger : 0;
        const lp = RF.clamp01((p - d) / (1 - stagger));
        if (lp <= 0) return;
        const ease = RF.Easing.outCubic(lp);
        const cy = y + i * lineGap;
        const cx = x + (1 - ease) * 0.05 * W;

        // 圆点/方形标记
        ctx.globalAlpha = ease;
        ctx.fillStyle = colorBullet;
        ctx.beginPath();
        ctx.arc(cx - bulletSize * 2, cy, bulletSize, 0, Math.PI * 2);
        ctx.fill();

        // 文字
        ctx.fillStyle = color;
        ctx.fillText(item, cx, cy);
        ctx.globalAlpha = 1;
      });
      ctx.restore();
    },
  });

  // —— 打字机 + 光标闪烁（保留原有的，另加多行） ——
  RF.effects.register("codeBlock", {
    meta: {"category":"text","desc":"代码块，逐字打出。","params":{"lines":{"type":"array","desc":"代码行字符串数组"},"x":{"type":"number","default":0.15},"y":{"type":"number","default":0.4},"size":{"type":"number","default":0.022},"weight":{"type":"number","default":400},"color":{"type":"string","default":"$fg"},"bgColor":{"type":"string","default":"rgba(0,0,0,0.8)"},"cursor":{"type":"boolean","default":true}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const lines = params.lines || ["const hello = 'world';"];
      const p = f.easedP;
      const size = (params.size != null ? params.size : 0.022) * W;
      const color = params.color || pal.fg;
      const colorBg = params.bgColor || RF.Color.rgba(pal.bg, 0.8);
      const x = (params.x != null ? params.x : 0.15) * W;
      const y = (params.y != null ? params.y : 0.4) * H;
      const lineGap = size * 1.5;
      const pad = size * 1.2;

      ctx.save();
      ctx.font = (params.weight || 400) + " " + size + "px " + MONO_STACK;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      // 背景板
      const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
      const boxW = maxW + pad * 2;
      const boxH = lines.length * lineGap + pad * 2;
      ctx.fillStyle = colorBg;
      ctx.fillRect(x - pad, y - pad, boxW * Math.min(1, p * 2), boxH);

      // 逐行逐字
      const totalChars = lines.reduce((s, l) => s + l.length, 0);
      const revealedChars = Math.floor(totalChars * p);
      let remaining = revealedChars;
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        const showCount = Math.max(0, Math.min(line.length, remaining));
        remaining -= line.length;
        if (showCount <= 0) continue;
        const shown = line.slice(0, showCount);
        // 简单语法高亮：关键字高亮
        ctx.fillStyle = color;
        ctx.fillText(shown, x, y + li * lineGap);
      }
      // 光标
      if (p < 1 && params.cursor !== false) {
        ctx.fillStyle = color;
        // 找光标位置
        let cli = 0, cCol = 0, rem = revealedChars;
        for (let i = 0; i < lines.length; i++) {
          if (rem <= lines[i].length) { cli = i; cCol = rem; break; }
          rem -= lines[i].length;
        }
        const cursorText = (lines[cli] || "").slice(0, cCol);
        const cw = ctx.measureText(cursorText).width;
        ctx.fillRect(x + cw, y + cli * lineGap, size * 0.55, size);
      }
      ctx.restore();
    },
  });

})(window.RF = window.RF || {});