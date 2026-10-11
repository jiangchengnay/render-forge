// engine/components/ui-mock.js
// 设计级组件：模拟 UI 界面（浏览器框、终端、手机、卡片窗口）。
// 这些是"正经 PV"的骨架元素。

(function (RF) {
  const FONT = '"Inter","Helvetica Neue",Arial,"Microsoft YaHei",sans-serif';
  const MONO = '"JetBrains Mono","SF Mono",Consolas,monospace';

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.arcTo(x + w, y + h, x + w, y + h - r, r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // 时序 helper：让组件的各部件错开出现
  function sub(p, start, dur) {
    return RF.clamp01((p - start) / dur);
  }

  // —— 浏览器框（最常用于产品演示）——
  RF.effects.register("browserFrame", {
    meta: {"category":"ui","desc":"浏览器窗口框（产品演示骨架）。","params":{"x":{"type":"number","default":0.15},"y":{"type":"number","default":0.2},"w":{"type":"number","default":0.7},"h":{"type":"number","default":0.55},"url":{"type":"string","default":"example.com"},"lines":{"type":"number","default":0,"desc":"占位线行数"},"bgColor":{"type":"string","default":"#ffffff"},"barColor":{"type":"string","default":"#f0f0f4"},"radius":{"type":"number","default":0.012}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const x = (params.x != null ? params.x : 0.15) * W;
      const y = (params.y != null ? params.y : 0.2) * H;
      const w = (params.w != null ? params.w : 0.7) * W;
      const h = (params.h != null ? params.h : 0.55) * H;
      const colorBg = params.bgColor || "#ffffff";
      const colorBar = params.barColor || "#f0f0f4";
      const colorDot = params.dotColors || ["#ff5f57", "#febc2e", "#28c840"];
      const url = params.url || "example.com";
      const radius = (params.radius != null ? params.radius : 0.012) * W;

      // 进入：从下往上 + 轻微缩放
      const ease = RF.Easing.outCubic(p);
      const offsetY = (1 - ease) * 60;
      const sc = 0.96 + 0.04 * ease;

      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 2);
      ctx.translate(x + w / 2, y + h / 2 + offsetY);
      ctx.scale(sc, sc);
      ctx.translate(-(x + w / 2), -(y + h / 2));

      // 阴影
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 50;
      ctx.shadowOffsetY = 20;

      // 框体
      ctx.fillStyle = colorBg;
      roundRect(ctx, x, y, w, h, radius);
      ctx.fill();

      // 取消阴影画顶部条
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      const barH = h * 0.08;
      ctx.fillStyle = colorBar;
      roundRect(ctx, x, y, w, barH, radius);
      ctx.fill();
      ctx.fillRect(x, y + barH - radius, w, radius);

      // 三个圆点
      const dotR = barH * 0.18;
      const dotY = y + barH / 2;
      colorDot.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x + barH * 0.35 + i * barH * 0.42, dotY, dotR, 0, Math.PI * 2);
        ctx.fill();
      });

      // URL 栏
      const urlW = w * 0.4;
      const urlH = barH * 0.55;
      ctx.fillStyle = RF.Color.rgba("#000000", 0.06);
      roundRect(ctx, x + w / 2 - urlW / 2, dotY - urlH / 2, urlW, urlH, urlH / 2);
      ctx.fill();
      ctx.fillStyle = RF.Color.rgba("#000000", 0.5);
      ctx.font = "500 " + (urlH * 0.6) + "px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(url, x + w / 2, dotY + 1);

      // 内容区：可以是自定义绘制
      if (params.content && RF.effects[params.content]) {
        // 内容裁剪到框内
        ctx.save();
        roundRect(ctx, x, y + barH, w, h - barH, radius);
        ctx.clip();
        const innerF = Object.assign({}, f, {
          W: w, H: h - barH,
          _tx: x, _ty: y + barH,
        });
        ctx.translate(x, y + barH);
        RF.effects[params.content].draw(ctx, innerF, params.contentParams || {}, env);
        ctx.restore();
      } else if (params.lines) {
        // 内容区：模拟一个真实的 SaaS 界面（深色主题）
        const innerY = y + barH;
        const innerH = h - barH;
        const dark = params.contentDark !== false; // 默认深色内容区
        const bgC = dark ? "#0d1526" : "#f7f8fa";
        const lineC = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
        const blockC = dark ? "rgba(90,180,255,0.5)" : "rgba(60,120,220,0.55)";
        const textC = dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)";

        // 内容区背景
        ctx.fillStyle = bgC;
        ctx.fillRect(x, innerY, w, innerH);

        // 顶栏
        ctx.fillStyle = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
        ctx.fillRect(x, innerY, w, innerH * 0.08);

        // 左侧栏
        const sidebarW = w * 0.16;
        ctx.fillStyle = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)";
        ctx.fillRect(x, innerY + innerH * 0.08, sidebarW, innerH * 0.92);
        // 侧栏 logo + 菜单项
        const sLp = sub(ease, 0.2, 0.3);
        ctx.fillStyle = blockC;
        ctx.globalAlpha = sLp * (params.contentAlpha != null ? params.contentAlpha : 1);
        roundRect(ctx, x + sidebarW * 0.2, innerY + innerH * 0.14, sidebarW * 0.6, innerH * 0.05, 3);
        ctx.fill();
        ctx.globalAlpha = 1;
        for (let i = 0; i < 5; i++) {
          const lp = sub(ease, 0.3 + i * 0.05, 0.3);
          ctx.fillStyle = textC;
          ctx.globalAlpha = lp * (params.contentAlpha != null ? params.contentAlpha : 1);
          ctx.fillRect(x + sidebarW * 0.15, innerY + innerH * 0.26 + i * innerH * 0.1, sidebarW * 0.7 * lp, innerH * 0.028);
        }
        ctx.globalAlpha = 1;

        // 主区顶部：标题 + 按钮
        const mainX = x + sidebarW + w * 0.03;
        const mainW = w - sidebarW - w * 0.06;
        const tLp = sub(ease, 0.35, 0.3);
        ctx.fillStyle = blockC;
        ctx.globalAlpha = tLp * (params.contentAlpha != null ? params.contentAlpha : 1);
        ctx.fillRect(mainX, innerY + innerH * 0.14, mainW * 0.35, innerH * 0.045);
        ctx.globalAlpha = 1;

        // 卡片网格
        const cardCount = params.lines || 4;
        const cols = Math.min(2, cardCount);
        const rows = Math.ceil(cardCount / cols);
        const cardW = (mainW - w * 0.03) / cols;
        const cardH = (innerH * 0.6) / Math.max(1, rows) - innerH * 0.02;

        for (let i = 0; i < cardCount; i++) {
          const lp = sub(ease, 0.45 + i * 0.06, 0.3);
          const col = i % cols;
          const row = Math.floor(i / cols);
          const cx0 = mainX + col * (cardW + w * 0.03);
          const cy0 = innerY + innerH * 0.28 + row * (cardH + innerH * 0.02);

          ctx.globalAlpha = lp * (params.contentAlpha != null ? params.contentAlpha : 1);
          // 卡片背景
          ctx.fillStyle = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";
          roundRect(ctx, cx0, cy0, cardW, cardH, 6);
          ctx.fill();
          // 卡片标题
          ctx.fillStyle = blockC;
          ctx.fillRect(cx0 + cardW * 0.08, cy0 + cardH * 0.15, cardW * 0.5, cardH * 0.12);
          // 卡片文字行
          ctx.fillStyle = textC;
          ctx.fillRect(cx0 + cardW * 0.08, cy0 + cardH * 0.4, cardW * 0.75, cardH * 0.08);
          ctx.fillRect(cx0 + cardW * 0.08, cy0 + cardH * 0.55, cardW * 0.6, cardH * 0.08);
          // 卡片内的"图表"小柱
          if (i % 2 === 0) {
            ctx.fillStyle = blockC;
            const barW = cardW * 0.05;
            for (let b = 0; b < 5; b++) {
              const bh = cardH * (0.15 + (b % 3) * 0.1) * lp;
              ctx.fillRect(cx0 + cardW * 0.6 + b * barW * 1.6, cy0 + cardH * 0.85 - bh, barW, bh);
            }
          }
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    },
  });

  // —— 终端窗口（开源项目宣发必备）——
  RF.effects.register("terminalWindow", {
    meta: {"category":"ui","desc":"终端窗口，命令逐行显示。","params":{"x":{"type":"number","default":0.15},"y":{"type":"number","default":0.2},"w":{"type":"number","default":0.7},"h":{"type":"number","default":0.5},"title":{"type":"string","default":"terminal"},"lines":{"type":"array","default":["$ npm install"],"desc":"命令/输出行"},"fontSize":{"type":"number","default":0.022},"bgColor":{"type":"string","default":"#1a1a1f"},"barColor":{"type":"string","default":"#0f0f12"},"promptColor":{"type":"string","default":"#00ffa3"},"textColor":{"type":"string","default":"#e8e8e8"}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const p = f.easedP;
      const x = (params.x != null ? params.x : 0.15) * W;
      const y = (params.y != null ? params.y : 0.2) * H;
      const w = (params.w != null ? params.w : 0.7) * W;
      const h = (params.h != null ? params.h : 0.5) * H;
      const bgColor = params.bgColor || "#1a1a1f";
      const fgColor = params.fgColor || "#e8e8e8";
      const barColor = params.barColor || "#0f0f12";
      const lines = params.lines || ["$ npm install", "$ npm run dev"];
      const promptColor = params.promptColor || "#00ffa3";
      const textColor = params.textColor || "#e8e8e8";
      const fontSize = (params.fontSize != null ? params.fontSize : 0.022) * W;

      const ease = RF.Easing.outCubic(p);
      const offsetY = (1 - ease) * 50;

      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 2);
      ctx.translate(0, offsetY);

      // 阴影
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 18;

      // 主体
      ctx.fillStyle = bgColor;
      roundRect(ctx, x, y, w, h, 12);
      ctx.fill();

      // 顶栏
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      const barH = h * 0.1;
      ctx.fillStyle = barColor;
      roundRect(ctx, x, y, w, barH, 12);
      ctx.fill();
      ctx.fillRect(x, y + barH - 12, w, 12);

      // 窗口控制点
      const dots = ["#ff5f57", "#febc2e", "#28c840"];
      const dotR = barH * 0.16;
      dots.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x + barH * 0.4 + i * barH * 0.5, y + barH / 2, dotR, 0, Math.PI * 2);
        ctx.fill();
      });
      // 标题
      ctx.fillStyle = RF.Color.rgba(fgColor, 0.4);
      ctx.font = "500 " + (barH * 0.4) + "px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(params.title || "terminal", x + w / 2, y + barH / 2);

      // 内容逐行出现
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "400 " + fontSize + "px " + MONO;
      const startY = y + barH + fontSize * 2;
      const lineGap = fontSize * 1.6;
      const totalChars = lines.reduce((s, l) => s + l.length, 0);
      const revealedChars = Math.floor(totalChars * ease);
      let remaining = revealedChars;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const showCount = Math.max(0, Math.min(line.length, remaining));
        remaining -= line.length;
        if (showCount <= 0) continue;
        // 提示符
        const isPrompt = line.startsWith("$");
        ctx.fillStyle = isPrompt ? promptColor : textColor;
        ctx.fillText(line.slice(0, showCount), x + w * 0.05, startY + i * lineGap);
      }

      // 光标
      if (ease < 1) {
        const cursorY = startY + lines.length * lineGap;
        ctx.fillStyle = promptColor;
        const blink = Math.floor(f.t * 2) % 2 === 0 ? 1 : 0.2;
        ctx.globalAlpha *= blink;
        ctx.fillRect(x + w * 0.05, cursorY - fontSize * 0.6, fontSize * 0.5, fontSize);
      }
      ctx.restore();
    },
  });

  // —— 手机框 ——
  RF.effects.register("phoneFrame", {
    meta: {"category":"ui","desc":"手机框。","params":{"x":{"type":"number","default":0.5},"y":{"type":"number","default":0.5},"w":{"type":"number","default":0.28,"desc":"宽度（高=宽*2.05）"},"frameColor":{"type":"string","default":"#1a1a1f"},"screenColor":{"type":"string","default":"#ffffff"}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const p = f.easedP;
      const cx = (params.x != null ? params.x : 0.5) * W;
      const cy = (params.y != null ? params.y : 0.5) * H;
      const w = (params.w != null ? params.w : 0.28) * W;
      const h = w * 2.05;
      const x = cx - w / 2;
      const y = cy - h / 2;
      const ease = RF.Easing.outBack(p);

      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 2);
      ctx.translate(cx, cy);
      ctx.scale(ease, ease);
      ctx.translate(-cx, -cy);

      // 外框
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 15;
      ctx.fillStyle = params.frameColor || "#1a1a1f";
      roundRect(ctx, x, y, w, h, w * 0.15);
      ctx.fill();

      // 屏幕
      ctx.shadowColor = "transparent";
      const inset = w * 0.04;
      ctx.fillStyle = params.screenColor || "#ffffff";
      roundRect(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, w * 0.11);
      ctx.fill();

      // 刘海
      ctx.fillStyle = "#1a1a1f";
      roundRect(ctx, cx - w * 0.1, y + inset * 1.5, w * 0.2, w * 0.06, w * 0.03);
      ctx.fill();

      // 底部 home indicator
      ctx.fillStyle = RF.Color.rgba("#000000", 0.2);
      roundRect(ctx, cx - w * 0.15, y + h - inset * 2.5, w * 0.3, w * 0.012, w * 0.006);
      ctx.fill();

      ctx.restore();
    },
  });

  // —— 卡片堆叠（展示多张截图）——
  RF.effects.register("cardStack", {
    meta: {"category":"ui","desc":"卡片堆叠（展示多张截图）。","params":{"x":{"type":"number","default":0.5},"y":{"type":"number","default":0.5},"w":{"type":"number","default":0.42},"h":{"type":"number","default":0.5},"count":{"type":"number","default":3},"colors":{"type":"array","default":null}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const cx = (params.x != null ? params.x : 0.5) * W;
      const cy = (params.y != null ? params.y : 0.5) * H;
      const cardW = (params.w != null ? params.w : 0.42) * W;
      const cardH = (params.h != null ? params.h : 0.5) * H;
      const count = Math.max(0, Math.min(100, Math.floor(params.count != null ? params.count : 3)));
      const colors = params.colors || pal.colors;

      ctx.save();
      for (let i = count - 1; i >= 0; i--) {
        const lp = sub(p, 1 - (i + 1) / count * 0.7, 0.4);
        const ease = RF.Easing.outCubic(lp);
        const offX = i * 0.06 * W * ease;
        const offY = i * 0.03 * H * ease;
        const rot = (i - (count - 1) / 2) * 0.06 * ease;
        const alpha = 0.9 - i * 0.15;

        ctx.save();
        ctx.globalAlpha = ease * (1 - i * 0.15);
        ctx.translate(cx + offX, cy + offY);
        ctx.rotate(rot);
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = colors[i % colors.length];
        roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 16);
        ctx.fill();
        // 装饰：顶栏条
        ctx.shadowColor = "transparent";
        ctx.fillStyle = RF.Color.rgba("#000000", 0.15);
        ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH * 0.08);
        ctx.restore();
      }
      ctx.restore();
    },
  });
})(window.RF = window.RF || {});