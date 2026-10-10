// engine/effects/shapes.js
// 2D 几何图形与形变。AI 只写 { "effect": "polygonRing", "count": 12, "radius": 0.3 }。
// 覆盖：多边形环、线段网络、圆环波、网格形变、路径描边动画。

(function (RF) {
  // 通用：按 easedP 从 0 到 1 画一个"生长"动画
  // 用 ctx.setLineDash 实现"描边生长"，用 scale 实现"弹出"。

  RF.effects.register("polygonRing", {
    meta: {"category":"geometry","desc":"多边形环绕中心排布。","params":{"count":{"type":"number","default":12,"desc":"多边形数量"},"radius":{"type":"number","default":0.3,"desc":"环半径（相对短边）"},"sides":{"type":"number","default":6,"desc":"每个多边形的边数"},"size":{"type":"number","default":0.06,"desc":"多边形大小"},"lineWidth":{"type":"number","default":2,"desc":"描边宽度（像素）"},"rotSpeed":{"type":"number","default":0.2,"desc":"旋转速度"},"radiusVar":{"type":"number","default":0,"desc":"半径波动 0-1"},"stagger":{"type":"number","default":0,"desc":"逐个延迟比例 0-1"},"color":{"type":"string","default":"$0"},"color2":{"type":"string","default":"$1"}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const cx = (params.cx != null ? params.cx : 0.5) * W;
      const cy = (params.cy != null ? params.cy : 0.5) * H;
      const count = params.count != null ? params.count : 12;
      const rBase = (params.radius != null ? params.radius : 0.3) * Math.min(W, H);
      const sides = params.sides != null ? params.sides : 6;
      const lineWidth = params.lineWidth != null ? params.lineWidth : 2;
      const color = params.color || f.palette.colors[0];
      const color2 = params.color2 || f.palette.colors[1];
      const rotSpeed = params.rotSpeed != null ? params.rotSpeed : 0.2;
      const radiusVar = params.radiusVar != null ? params.radiusVar : 0;
      const stagger = params.stagger != null ? params.stagger : 0; // 每个图元延迟出现
      const p = f.easedP;

      ctx.save();
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = "round";

      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + f.t * rotSpeed;
        // 每个图元的局部进度（支持 stagger）
        let lp = p;
        if (stagger > 0) {
          const d = (i / count) * stagger;
          lp = RF.clamp01((p - d) / (1 - stagger));
        }
        if (lp <= 0) continue;
        const ease = RF.Easing.outCubic(lp);
        let r = rBase;
        if (radiusVar > 0) r *= 1 + Math.sin(i * 1.7 + f.t * 2) * radiusVar;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const size = (params.size != null ? params.size : 0.06) * Math.min(W, H) * ease;
        ctx.strokeStyle = i % 2 === 0 ? color : color2;
        ctx.globalAlpha = (params.alpha != null ? params.alpha : 0.9) * ease;

        ctx.beginPath();
        for (let s = 0; s <= sides; s++) {
          const ang = (s / sides) * Math.PI * 2 + a * 1.5;
          const px = x + Math.cos(ang) * size;
          const py = y + Math.sin(ang) * size;
          if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    },
  });

  // 圆形波纹：从中心向外扩散的圆环
  RF.effects.register("ripples", {
    meta: {"category":"geometry","desc":"同心圆波纹从中心扩散。","params":{"count":{"type":"number","default":6,"desc":"波纹数量"},"cx":{"type":"number","default":0.5},"cy":{"type":"number","default":0.5},"maxRadius":{"type":"number","default":0.7,"desc":"最大半径"},"lineWidth":{"type":"number","default":2,"desc":"线宽（像素）"},"color":{"type":"string","default":"$0"},"alpha":{"type":"number","default":0.8}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const cx = (params.cx != null ? params.cx : 0.5) * W;
      const cy = (params.cy != null ? params.cy : 0.5) * H;
      const count = params.count != null ? params.count : 6;
      const maxR = (params.maxRadius != null ? params.maxRadius : 0.7) * Math.min(W, H);
      const lineWidth = params.lineWidth != null ? params.lineWidth : 2;
      const color = params.color || f.palette.colors[0];
      const p = f.easedP;

      ctx.save();
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      for (let i = 0; i < count; i++) {
        // 每个环错开相位
        const phase = (i / count);
        const lp = (p + phase) % 1;
        const r = maxR * lp;
        const alpha = (1 - lp) * (params.alpha != null ? params.alpha : 0.8);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },
  });

  // 网格形变：二维点阵，每点按噪声偏移
  RF.effects.register("gridWarp", {
    meta: {"category":"geometry","desc":"网格点阵形变。","params":{"cols":{"type":"number","default":20},"rows":{"type":"number","default":20},"dot":{"type":"number","default":2},"noiseAmp":{"type":"number","default":0.05},"noiseScale":{"type":"number","default":2},"speed":{"type":"number","default":0.3},"color":{"type":"string","default":"$0"}}},
    init(ctx, params, env) {
      return { simplex: RF.makeSimplex(params.seed != null ? params.seed : env.rng.seed) };
    },
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const cols = params.cols != null ? params.cols : 20;
      const rows = params.rows != null ? params.rows : 20;
      const dot = params.dot != null ? params.dot : 2;
      const noiseAmp = params.noiseAmp != null ? params.noiseAmp : 0.05;
      const noiseScale = params.noiseScale != null ? params.noiseScale : 2;
      const speed = params.speed != null ? params.speed : 0.3;
      const color = params.color || f.palette.colors[0];
      const simplex = f.state.simplex;
      const t = f.t * speed;

      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha = params.alpha != null ? params.alpha : 0.9;
      const dx = W / (cols - 1);
      const dy = H / (rows - 1);
      const base = Math.min(W, H);

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const bx = i * dx;
          const by = j * dy;
          const nx = (i / cols - 0.5) * noiseScale;
          const ny = (j / rows - 0.5) * noiseScale;
          const n1 = simplex(nx + t, ny);
          const n2 = simplex(nx + 5.2, ny + 1.3 - t);
          const x = bx + n1 * noiseAmp * base;
          const y = by + n2 * noiseAmp * base;
          // 半径可按离中心远近变化
          const r = dot * (1 + (params.sizeVar != null ? params.sizeVar * n1 : 0));
          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.3, r), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    },
  });

  // 描边生长：一条或多条路径按进度逐段画出
  RF.effects.register("strokeGrow", {
    meta: {"category":"geometry","desc":"路径描边逐段生长。","params":{"paths":{"type":"array","desc":"路径数组，每项 {kind:'arc'|'line', ...}"},"lineWidth":{"type":"number","default":3},"color":{"type":"string","default":"$0"},"stagger":{"type":"number","default":0.3}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const paths = params.paths || [
        // 默认：一个圆弧形
        { kind: "arc", cx: 0.5, cy: 0.5, r: 0.35, a0: -Math.PI * 0.75, a1: Math.PI * 0.75 },
      ];
      const lineWidth = params.lineWidth != null ? params.lineWidth : 3;
      const color = params.color || f.palette.colors[0];
      const stagger = params.stagger != null ? params.stagger : 0.3;
      const p = f.easedP;

      ctx.save();
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.strokeStyle = color;

      paths.forEach((path, idx) => {
        const d = paths.length > 1 ? (idx / (paths.length - 1)) * stagger : 0;
        const lp = RF.clamp01((p - d) / (1 - stagger));
        if (lp <= 0) return;
        const ease = RF.Easing.inOutCubic(lp);
        ctx.globalAlpha = params.alpha != null ? params.alpha : 1;
        ctx.beginPath();
        if (path.kind === "arc") {
          const cx = (path.cx != null ? path.cx : 0.5) * W;
          const cy = (path.cy != null ? path.cy : 0.5) * H;
          const r = (path.r != null ? path.r : 0.35) * Math.min(W, H);
          const a0 = path.a0 != null ? path.a0 : 0;
          const a1 = path.a1 != null ? path.a1 : Math.PI * 2;
          const aEnd = a0 + (a1 - a0) * ease;
          ctx.arc(cx, cy, r, a0, aEnd);
        } else if (path.kind === "line") {
          const x0 = path.x0 * W, y0 = path.y0 * H, x1 = path.x1 * W, y1 = path.y1 * H;
          const ex = x0 + (x1 - x0) * ease;
          const ey = y0 + (y1 - y0) * ease;
          ctx.moveTo(x0, y0);
          ctx.lineTo(ex, ey);
        }
        ctx.stroke();
      });
      ctx.restore();
    },
  });

  // 多边形，形状随进度从 n 边逐步过渡到 m 边（视觉上像"变形"）
  RF.effects.register("morphPolygon", {
    meta: {"category":"geometry","desc":"多边形旋转+呼吸缩放。","params":{"sides":{"type":"number","default":6},"radius":{"type":"number","default":0.3},"cx":{"type":"number","default":0.5},"cy":{"type":"number","default":0.5},"rotSpeed":{"type":"number","default":0.5},"fill":{"type":"string","default":"$0"},"stroke":{"type":"string","default":"$fg"},"lineWidth":{"type":"number","default":3},"breath":{"type":"number","default":0}}},
    draw(ctx, f, params, env) {
      const W = f.W, H = f.H;
      const cx = (params.cx != null ? params.cx : 0.5) * W;
      const cy = (params.cy != null ? params.cy : 0.5) * H;
      const r = (params.radius != null ? params.radius : 0.3) * Math.min(W, H);
      const nSides = params.sides != null ? params.sides : 6;
      const rotSpeed = params.rotSpeed != null ? params.rotSpeed : 0.5;
      const fill = params.fill || f.palette.colors[0];
      const stroke = params.stroke || f.palette.fg;
      const lineWidth = params.lineWidth != null ? params.lineWidth : 3;
      const p = f.easedP;
      const ease = RF.Easing.outBack(p);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(f.t * rotSpeed);
      // 呼吸缩放
      const breath = params.breath != null ? 1 + Math.sin(f.t * 2) * params.breath : 1;
      ctx.scale(ease * breath, ease * breath);

      ctx.beginPath();
      for (let i = 0; i <= nSides; i++) {
        const a = (i / nSides) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (lineWidth > 0) {
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
      ctx.restore();
    },
  });
})(window.RF = window.RF || {});