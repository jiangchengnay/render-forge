// engine/core/typography.js
// 中文排版引擎：字体加载、中文断行、避头尾、行高、字距、安全区。
//
// 用法：
//   const lines = RF.Typography.layoutText(text, { font: "600 32px ...", maxWidth: 500 });
//   RF.Typography.drawLines(ctx, lines, x, y, { lineHeight, align, color });
//
// 避头尾规则：这些标点不能出现在行首（避头）
const NO_LINE_START = "，。、；：？！）】》」』〉…—·％℃,.!?)]}>";
// 这些标点不能出现在行尾（避尾）
const NO_LINE_END = "（【《「『〈([{<";

(function (RF) {
  // —— 字体加载 ——
  // 用法：await RF.Typography.loadFont("MyFont", "url.ttf", { weight: 700 })
  async function loadFont(family, url, opts) {
    opts = opts || {};
    const ff = new FontFace(family, "url(" + url + ")", {
      weight: opts.weight != null ? String(opts.weight) : "normal",
      style: opts.style || "normal",
    });
    await ff.load();
    document.fonts.add(ff);
    return ff;
  }

  // 等待某个字体就绪
  async function waitFont(spec) {
    if (!document.fonts || !document.fonts.ready) return;
    try {
      await document.fonts.load(spec);
    } catch (e) { /* 忽略 */ }
  }

  // 加载项目内嵌字体（分镜 assets 里声明）
  // fonts: [{ family, src, weight?, style? }]
  async function loadFonts(list) {
    if (!Array.isArray(list)) return { loaded: [], failed: [] };
    const out = { loaded: [], failed: [] };
    for (const f of list) {
      try {
        await loadFont(f.family, f.src, { weight: f.weight, style: f.style });
        out.loaded.push(f.family);
      } catch (e) {
        out.failed.push({ family: f.family, error: e.message });
      }
    }
    return out;
  }

  // 校验字体是否可用（避免静默 fallback）
  function assertFont(family, sampleText) {
    if (!document.fonts) return true;
    const sample = sampleText || "测试abc";
    // document.fonts.check 判断字体是否已加载
    return document.fonts.check("16px " + JSON.stringify(family), sample);
  }

  // —— 判断字符类型 ——
  function isCJK(ch) {
    const c = ch.charCodeAt(0);
    return (c >= 0x4E00 && c <= 0x9FFF)      // CJK 统一表意
      || (c >= 0x3400 && c <= 0x4DBF)        // 扩展 A
      || (c >= 0x3040 && c <= 0x30FF)        // 日文假名
      || (c >= 0xAC00 && c <= 0xD7AF);       // 韩文
  }
  function isLatin(ch) {
    const c = ch.charCodeAt(0);
    return (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)
      || (c >= 0x30 && c <= 0x39);
  }
  function isPunct(ch) {
    return NO_LINE_START.indexOf(ch) >= 0 || NO_LINE_END.indexOf(ch) >= 0
      || /[\u3000-\u303F\uFF00-\uFFEF]/.test(ch);
  }

  // —— 中文断行 ——
  // 返回 [{ text, width }] 数组
  // opts: { font, maxWidth, breakAnywhere (是否按字符断), paragraphIndent }
  function layoutText(ctx, text, opts) {
    opts = opts || {};
    const font = opts.font || ctx.font;
    const maxWidth = opts.maxWidth || ctx.canvas.width * 0.8;
    const breakAnywhere = opts.breakAnywhere !== false; // 中文默认按字断
    const lineHeight = opts.lineHeight || (parseFloat(font.match(/(\d+)px/)?.[1] || 24) * 1.5);

    ctx.save();
    ctx.font = font;

    const lines = [];
    // 按换行符分段
    const paragraphs = String(text).split(/\n/);

    paragraphs.forEach((para) => {
      if (para.length === 0) {
        lines.push({ text: "", width: 0, isBlank: true });
        return;
      }
      // 把字符切成"词元"：CJK 单字；拉丁按词（空格分隔）；标点单独
      const tokens = [];
      let i = 0;
      while (i < para.length) {
        const ch = para[i];
        if (isCJK(ch) || isPunct(ch)) {
          tokens.push(ch);
          i++;
        } else if (isLatin(ch)) {
          // 取一整个拉丁词
          let j = i;
          while (j < para.length && (isLatin(para[j]) || para[j] === "'" || para[j] === "-")) j++;
          tokens.push(para.slice(i, j));
          i = j;
        } else if (ch === " ") {
          tokens.push(" ");
          i++;
        } else {
          tokens.push(ch);
          i++;
        }
      }

      // 逐 token 累积宽度
      let curLine = "";
      let curWidth = 0;
      for (let k = 0; k < tokens.length; k++) {
        const tok = tokens[k];
        const tokWidth = ctx.measureText(tok).width;
        // 空格在行首跳过
        if (tok === " " && curLine.length === 0) continue;
        if (curWidth + tokWidth > maxWidth && curLine.length > 0) {
          // 检查：行尾是否有"不能作为行尾"的标点 → 把它推到下一行
          const lastCh = curLine[curLine.length - 1];
          if (NO_LINE_END.indexOf(lastCh) >= 0 && curLine.length > 1) {
            // 把最后这个字符留到下一行
            curLine = curLine.slice(0, -1);
            // 检查行首：如果下一个 token 是"不能作为行首"的标点，把它拉回本行
            const nextTok = tok;
            if (NO_LINE_START.indexOf(nextTok[0]) >= 0) {
              curLine += nextTok;
              k++;
            }
            lines.push({ text: curLine, width: ctx.measureText(curLine).width });
            curLine = lastCh;  // 把之前留出的字符作为新行开头
            curWidth = ctx.measureText(curLine).width;
            continue;
          }
          // 新 token 是"不能作为行首"的标点 → 让它留在上一行
          if (NO_LINE_START.indexOf(tok[0]) >= 0) {
            curLine += tok;
            lines.push({ text: curLine, width: ctx.measureText(curLine).width });
            curLine = "";
            curWidth = 0;
            continue;
          }
          lines.push({ text: curLine, width: curWidth });
          curLine = tok;
          curWidth = tokWidth;
        } else {
          curLine += tok;
          curWidth += tokWidth;
        }
      }
      if (curLine) lines.push({ text: curLine, width: curWidth });
    });

    ctx.restore();
    return { lines, lineHeight };
  }

  // —— 绘制多行文本 ——
  // opts: { lineHeight, align, color, baseline, shadow }
  function drawLines(ctx, layout, x, y, opts) {
    opts = opts || {};
    const lines = layout.lines;
    const lineHeight = opts.lineHeight || layout.lineHeight;
    const align = opts.align || "center";
    const color = opts.color || "#fff";
    const baseline = opts.baseline || "middle";
    const totalH = lines.length * lineHeight;
    let startY = y;
    if (baseline === "middle") startY = y - totalH / 2 + lineHeight / 2;
    else if (baseline === "bottom") startY = y - totalH + lineHeight / 2;

    ctx.save();
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    if (opts.shadowColor) {
      ctx.shadowColor = opts.shadowColor;
      ctx.shadowBlur = opts.shadowBlur || 10;
    }
    lines.forEach((line, i) => {
      let lx = x;
      if (align === "center") lx = x - line.width / 2;
      else if (align === "right") lx = x - line.width;
      else if (align === "left") lx = x;
      ctx.fillText(line.text, lx, startY + i * lineHeight);
    });
    ctx.restore();
  }

  // —— 安全区 ——
  // 返回实际可用区域的边界（避免标题贴边）
  function safeArea(W, H, margin) {
    const m = margin != null ? margin : 0.06;
    return {
      x0: W * m, y0: H * m,
      x1: W * (1 - m), y1: H * (1 - m),
      w: W * (1 - 2 * m), h: H * (1 - 2 * m),
      cx: W / 2, cy: H / 2,
    };
  }

  RF.Typography = {
    loadFont, waitFont, loadFonts, assertFont,
    layoutText, drawLines, safeArea,
    isCJK, isPunct,
  };
})(window.RF = window.RF || {});
