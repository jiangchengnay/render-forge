// engine/components/decor.js
// 装饰性元素：几何形状、光斑、网格线、点阵、渐变块、噪点纹理、logo 占位。

(function (RF) {
  const FONT = '"Inter","Helvetica Neue",Arial,"Microsoft YaHei",sans-serif';

  function sub(p, start, dur) { return RF.clamp01((p - start) / dur); }

  // —— 几何光斑（散布的圆/方，装饰用） ——
  RF.effects.register("geoShapes", {
    meta: {"category":"decor","desc":"几何形状散布（圆/方/三角/六边形）。","params":{"count":{"type":"number","default":12},"alpha":{"type":"number","default":0.25},"lineWidth":{"type":"number","default":1.5},"stagger":{"type":"number","default":0.6},"stroke":{"type":"boolean","default":true},"fill":{"type":"boolean","default":false},"float":{"type":"boolean","default":true}}},
    init(ctx, params, env) {
      const count = params.count != null ? params.count : 12;
      const rng = env.rng;
      const shapes = [];
      for (let i = 0; i < count; i++) {
        shapes.push({
          x: rng.float(),
          y: rng.float(),
          size: rng.range(0.02, 0.08),
          shape: rng.pick(["circle", "square", "triangle", "hex"]),
          rot: rng.float() * Math.PI * 2,
          rotSpeed: rng.range(-0.5, 0.5),
          colorIndex: rng.int(0, env.palette.colors.length - 1),
          delay: rng.float() * 0.4,
          floatAmp: rng.range(0.005, 0.02),
          floatSpeed: rng.range(0.3, 0.8),
        });
      }
      return { shapes };
    },
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const st = f.state;
      const alpha = params.alpha != null ? params.alpha : 0.25;
      const stroke = params.stroke !== false;
      const fill = params.fill === true;
      const stagger = params.stagger != null ? params.stagger : 0.6;
      const float = params.float !== false;

      ctx.save();
      st.shapes.forEach((s, i) => {
        const d = (i / st.shapes.length) * stagger;
        const lp = RF.clamp01((p - d) / (1 - stagger));
        if (lp <= 0) return;
        const ease = RF.Easing.outCubic(lp);
        const col = RF.colorAt(pal, s.colorIndex);
        const size = s.size * Math.min(W, H) * ease;
        const fx = float ? Math.sin(f.t * s.floatSpeed) * s.floatAmp * W : 0;
        const fy = float ? Math.cos(f.t * s.floatSpeed * 0.7) * s.floatAmp * H : 0;
        const x = s.x * W + fx;
        const y = s.y * H + fy;

        ctx.save();
        ctx.globalAlpha = alpha * ease;
        ctx.translate(x, y);
        ctx.rotate(s.rot + f.t * s.rotSpeed);
        ctx.beginPath();
        if (s.shape === "circle") {
          ctx.arc(0, 0, size, 0, Math.PI * 2);
        } else if (s.shape === "square") {
          ctx.rect(-size, -size, size * 2, size * 2);
        } else if (s.shape === "triangle") {
          ctx.moveTo(0, -size);
          ctx.lineTo(size * 0.87, size * 0.5);
          ctx.lineTo(-size * 0.87, size * 0.5);
          ctx.closePath();
        } else if (s.shape === "hex") {
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            const px = Math.cos(a) * size;
            const py = Math.sin(a) * size;
            if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
        }
        if (fill) { ctx.fillStyle = col; ctx.fill(); }
        if (stroke) {
          ctx.strokeStyle = col;
          ctx.lineWidth = (params.lineWidth != null ? params.lineWidth : 1.5);
          ctx.stroke();
        }
        ctx.restore();
      });
      ctx.restore();
    },
  });

  // —— 点阵（网格点的子集） ——
  RF.effects.register("dotGrid", {
    meta: {"category":"decor","desc":"点阵（径向/扫描/淡入三种出现方式）。","params":{"spacing":{"type":"number","default":0.05},"dotR":{"type":"number","default":0.002},"color":{"type":"string","default":"rgba(255,255,255,0.15)"},"reveal":{"type":"string","default":"radial","range":["radial","fade","sweep"]}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const spacing = (params.spacing != null ? params.spacing : 0.05) * Math.min(W, H);
      const dotR = (params.dotR != null ? params.dotR : 0.002) * Math.min(W, H);
      const color = params.color || RF.Color.rgba(pal.fg, 0.15);
      const reveal = params.reveal || "radial"; // radial | fade | sweep
      const ease = RF.Easing.outCubic(p);

      ctx.save();
      ctx.fillStyle = color;
      const cx = W / 2, cy = H / 2;
      const maxDist = Math.hypot(W, H) / 2;

      for (let y = spacing; y < H; y += spacing) {
        for (let x = spacing; x < W; x += spacing) {
          let alpha = 0;
          if (reveal === "radial") {
            const dist = Math.hypot(x - cx, y - cy);
            const localP = RF.clamp01((ease * (maxDist * 1.3) - dist) / (maxDist * 0.3));
            alpha = localP;
          } else if (reveal === "fade") {
            alpha = ease;
          } else if (reveal === "sweep") {
            const localP = RF.clamp01((ease * (W + 200) - x) / 150);
            alpha = localP;
          }
          if (alpha <= 0) continue;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(x, y, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    },
  });

  // —— 渐变光斑（大色块，装饰/氛围） ——
  RF.effects.register("gradientBlob", {
    meta: {"category":"decor","desc":"渐变光斑（大色块氛围）。","params":{"count":{"type":"number","default":3},"alpha":{"type":"number","default":0.35},"mode":{"type":"string","default":"screen","desc":"合成模式"}}},
    init(ctx, params, env) {
      const count = params.count != null ? params.count : 3;
      const rng = env.rng;
      const blobs = [];
      for (let i = 0; i < count; i++) {
        blobs.push({
          x: rng.range(0.2, 0.8),
          y: rng.range(0.2, 0.8),
          r: rng.range(0.25, 0.45),
          colorIndex: i,
          phase: rng.float() * Math.PI * 2,
          speed: rng.range(0.2, 0.5),
          orbit: rng.range(0.05, 0.12),
        });
      }
      return { blobs };
    },
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const st = f.state;
      const alpha = (params.alpha != null ? params.alpha : 0.35) * RF.Easing.outCubic(p);
      const mode = params.mode || "screen";

      ctx.save();
      ctx.globalCompositeOperation = mode;
      st.blobs.forEach((b) => {
        const t = f.t * b.speed + b.phase;
        const x = (b.x + Math.cos(t) * b.orbit) * W;
        const y = (b.y + Math.sin(t * 0.8) * b.orbit) * H;
        const r = b.r * Math.min(W, H);
        const col = RF.colorAt(pal, b.colorIndex);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, RF.Color.rgba(col, alpha));
        g.addColorStop(1, RF.Color.rgba(col, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      });
      ctx.restore();
    },
  });

  // —— 描边矩形（强调框） ——
  RF.effects.register("frameRect", {
    meta: {"category":"decor","desc":"描边矩形，逐边生长+角标。","params":{"x":{"type":"number","default":0.1},"y":{"type":"number","default":0.1},"w":{"type":"number","default":0.3},"h":{"type":"number","default":0.2},"color":{"type":"string","default":"$accent"},"lineWidth":{"type":"number","default":2},"corners":{"type":"boolean","default":true}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const x = (params.x != null ? params.x : 0.1) * W;
      const y = (params.y != null ? params.y : 0.1) * H;
      const w = (params.w != null ? params.w : 0.3) * W;
      const h = (params.h != null ? params.h : 0.2) * H;
      const color = params.color || pal.accent;
      const lineWidth = (params.lineWidth != null ? params.lineWidth : 2);
      const ease = RF.Easing.outCubic(p);

      // 逐边描边动画
      const perimeter = 2 * (w + h);
      const drawn = perimeter * ease;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";

      let remaining = drawn;
      ctx.beginPath();
      // 顶
      if (remaining > 0) {
        const seg = Math.min(w, remaining);
        ctx.moveTo(x, y);
        ctx.lineTo(x + seg, y);
        remaining -= seg;
      }
      // 右
      if (remaining > 0) {
        const seg = Math.min(h, remaining);
        ctx.moveTo(x + w, y);
        ctx.lineTo(x + w, y + seg);
        remaining -= seg;
      }
      // 底
      if (remaining > 0) {
        const seg = Math.min(w, remaining);
        ctx.moveTo(x + w, y + h);
        ctx.lineTo(x + w - seg, y + h);
        remaining -= seg;
      }
      // 左
      if (remaining > 0) {
        const seg = Math.min(h, remaining);
        ctx.moveTo(x, y + h);
        ctx.lineTo(x, y + h - seg);
      }
      ctx.stroke();

      // 角标
      if (params.corners !== false) {
        const cs = Math.min(w, h) * 0.08;
        ctx.lineWidth = lineWidth * 2;
        [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([cx, cy, dx, dy]) => {
          ctx.beginPath();
          ctx.moveTo(cx, cy + dy * cs);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + dx * cs, cy);
          ctx.stroke();
        });
      }
      ctx.restore();
    },
  });

  // —— 水平/垂直分隔线 ——
  RF.effects.register("divider", {
    meta: {"category":"decor","desc":"水平/垂直分隔线，从中心生长。","params":{"dir":{"type":"string","default":"h","range":["h","v"]},"x":{"type":"number","default":0.5},"y":{"type":"number","default":0.5},"x0":{"type":"number","default":0.2},"x1":{"type":"number","default":0.8},"y0":{"type":"number","default":0.2},"y1":{"type":"number","default":0.8},"lineWidth":{"type":"number","default":2},"color":{"type":"string","default":"$accent"}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const dir = params.dir || "h";
      const color = params.color || RF.Color.rgba(pal.accent, 0.5);
      const lineW = params.lineWidth != null ? params.lineWidth : 2;
      const ease = RF.Easing.outCubic(p);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;

      if (dir === "h") {
        const y = (params.y != null ? params.y : 0.5) * H;
        const x0 = (params.x0 != null ? params.x0 : 0.2) * W;
        const x1 = (params.x1 != null ? params.x1 : 0.8) * W;
        const cx = (x0 + x1) / 2;
        const len = (x1 - x0) * ease;
        ctx.beginPath();
        ctx.moveTo(cx - len / 2, y);
        ctx.lineTo(cx + len / 2, y);
        ctx.stroke();
      } else {
        const x = (params.x != null ? params.x : 0.5) * W;
        const y0 = (params.y0 != null ? params.y0 : 0.2) * H;
        const y1 = (params.y1 != null ? params.y1 : 0.8) * H;
        const cy = (y0 + y1) / 2;
        const len = (y1 - y0) * ease;
        ctx.beginPath();
        ctx.moveTo(x, cy - len / 2);
        ctx.lineTo(x, cy + len / 2);
        ctx.stroke();
      }
      ctx.restore();
    },
  });

  // —— logo 占位（十字/圆/方块组合） ——
  RF.effects.register("logoMark", {
    meta: {"category":"decor","desc":"Logo 占位符号。","params":{"style":{"type":"string","default":"cross","range":["cross","circles","square-stack","diamond"]},"size":{"type":"number","default":0.06},"x":{"type":"number","default":0.5},"y":{"type":"number","default":0.5},"color":{"type":"string","default":"$accent"}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const cx = (params.x != null ? params.x : 0.5) * W;
      const cy = (params.y != null ? params.y : 0.5) * H;
      const size = (params.size != null ? params.size : 0.06) * Math.min(W, H);
      const color = params.color || pal.accent;
      const style = params.style || "cross"; // cross | circles | square-stack | diamond
      const ease = RF.Easing.outBack(p);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(ease, ease);

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = size * 0.15;
      ctx.lineCap = "round";

      if (style === "cross") {
        ctx.beginPath();
        ctx.moveTo(-size, 0);
        ctx.lineTo(size, 0);
        ctx.moveTo(0, -size);
        ctx.lineTo(0, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (style === "circles") {
        ctx.lineWidth = size * 0.12;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(0, 0, size * (0.4 + i * 0.3), 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (style === "square-stack") {
        ctx.save();
        ctx.rotate(Math.PI / 4);
        for (let i = 0; i < 3; i++) {
          ctx.strokeRect(-size * 0.7 + i * size * 0.15, -size * 0.7 + i * size * 0.15,
            size * 1.4 - i * size * 0.3, size * 1.4 - i * size * 0.3);
        }
        ctx.restore();
      } else if (style === "diamond") {
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },
  });

  // —— 斜线/条纹背景（"设计感" 底纹） ——
  RF.effects.register("stripes", {
    meta: {"category":"decor","desc":"斜纹背景。","params":{"angle":{"type":"number","default":45,"desc":"角度（度）"},"gap":{"type":"number","default":0.03},"lineWidth":{"type":"number","default":null},"color":{"type":"string","default":"rgba(255,255,255,0.08)"}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const angle = (params.angle != null ? params.angle : 45) * Math.PI / 180;
      const gap = (params.gap != null ? params.gap : 0.03) * Math.min(W, H);
      const lineW = (params.lineWidth != null ? params.lineWidth : gap * 0.3);
      const color = params.color || RF.Color.rgba(pal.accent, 0.08);
      const ease = RF.Easing.outCubic(p);

      ctx.save();
      ctx.globalAlpha = ease;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      const len = Math.hypot(W, H);
      const cos = Math.cos(angle), sin = Math.sin(angle);
      for (let i = -len; i < len; i += gap) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + cos * i - sin * len, H / 2 + sin * i + cos * len);
        ctx.lineTo(W / 2 + cos * i + sin * len, H / 2 + sin * i - cos * len);
        ctx.stroke();
      }
      ctx.restore();
    },
  });

  // —— 大号引号/星号等装饰符 ——
  RF.effects.register("bigGlyph", {
    meta: {"category":"decor","desc":"大号装饰符（引号/星号等）。","params":{"glyph":{"type":"string","default":"“"},"x":{"type":"number","default":0.15},"y":{"type":"number","default":0.3},"size":{"type":"number","default":0.3},"rotate":{"type":"number","default":0},"color":{"type":"string","default":"rgba(255,255,255,0.3)"}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pal = f.palette;
      const p = f.easedP;
      const glyph = params.glyph || "“";
      const x = (params.x != null ? params.x : 0.15) * W;
      const y = (params.y != null ? params.y : 0.3) * H;
      const size = (params.size != null ? params.size : 0.3) * W;
      const color = params.color || RF.Color.rgba(pal.accent, 0.3);
      const ease = RF.Easing.outCubic(p);

      ctx.save();
      ctx.globalAlpha = ease;
      ctx.font = "800 " + size + "px " + FONT;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.translate(x, y);
      ctx.rotate((params.rotate != null ? params.rotate : 0) * ease);
      ctx.scale(ease, ease);
      ctx.fillText(glyph, 0, 0);
      ctx.restore();
    },
  });
})(window.RF = window.RF || {});