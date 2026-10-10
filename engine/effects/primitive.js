// engine/effects/primitive.js
// 图元：shape（多边形/星形/圆/矩形/线段/路径）与 path（折线/曲线）。
// 坐标约定：
//   - shape.params.points：归一化坐标，[-1,1] 范围，相对 size（size * min(W,H) 为半径基准）
//   - path.params.points：画布归一化坐标 [0,1]（x*W, y*H）
//   - x/y：画布比例 0-1（图元中心）
//   - rotate：弧度
(function (RF) {

  // 生成多边形顶点（归一化 [-1,1]）
  function polygonPoints(sides, rotation) {
    const pts = [];
    const rot = rotation || 0;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2 + rot;
      pts.push([Math.cos(a), Math.sin(a)]);
    }
    return pts;
  }

  // 星形顶点
  function starPoints(outer, inner, points, rotation) {
    const pts = [];
    const rot = rotation || 0;
    const n = points * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2 + rot;
      const r = i % 2 === 0 ? 1 : inner;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  }

  // 描边 + 填充（统一入口）
  function paint(ctx, params, pathFn) {
    ctx.beginPath();
    pathFn();
    if (params.fill) {
      ctx.fillStyle = params.fill;
      ctx.fill();
    }
    if (params.stroke) {
      ctx.strokeStyle = params.stroke;
      ctx.lineWidth = params.lineWidth != null ? params.lineWidth : 2;
      ctx.lineJoin = params.lineJoin || "round";
      ctx.lineCap = params.lineCap || "round";
      ctx.stroke();
    }
  }

  RF.effects.register("shape", {
    meta: { category: "primitive", desc: "任意图元：多边形/星形/圆/矩形/线段/路径。", params: {
      kind: { type: "string", default: "polygon", range: ["polygon","star","circle","rect","line","path"] },
      points: { type: "array", desc: "kind=polygon/path 时的顶点，归一化 [-1,1]" },
      sides: { type: "number", default: 6, desc: "多边形边数" },
      starPoints: { type: "number", default: 5, desc: "星形角数" },
      innerRadius: { type: "number", default: 0.5, desc: "星形内半径比 0-1" },
      radius: { type: "number", default: 0.15, desc: "圆半径（相对短边）" },
      w: { type: "number", default: 0.2, desc: "矩形宽（相对画布）" },
      h: { type: "number", default: 0.2, desc: "矩形高" },
      size: { type: "number", default: 0.15, desc: "整体尺寸（相对短边）" },
      x: { type: "number", default: 0.5 }, y: { type: "number", default: 0.5 },
      rotate: { type: "number", default: 0, desc: "旋转（弧度）" },
      scale: { type: "number", default: 1 },
      opacity: { type: "number", default: 1 },
      fill: { type: "string", default: "" },
      stroke: { type: "string", default: "$fg" },
      lineWidth: { type: "number", default: 2 },
      closed: { type: "boolean", default: true },
    }},
    draw: function (ctx, f, params, env) {
      const W = f.W, H = f.H;
      const cx = (params.x != null ? params.x : 0.5) * W;
      const cy = (params.y != null ? params.y : 0.5) * H;
      const size = (params.size != null ? params.size : 0.15) * Math.min(W, H);
      const scale = params.scale != null ? params.scale : 1;
      const rot = params.rotate || 0;

      ctx.save();
      ctx.globalAlpha *= (params.opacity != null ? params.opacity : 1) * f.easedP;
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.scale(scale, scale);

      const kind = params.kind || "polygon";

      if (kind === "circle") {
        const r = (params.radius != null ? params.radius : 0.15) * Math.min(W, H);
        paint(ctx, params, function () { ctx.arc(0, 0, r, 0, Math.PI * 2); });
      } else if (kind === "rect") {
        const rw = (params.w != null ? params.w : 0.2) * W;
        const rh = (params.h != null ? params.h : 0.2) * H;
        paint(ctx, params, function () { ctx.rect(-rw / 2, -rh / 2, rw, rh); });
      } else if (kind === "star") {
        const n = params.starPoints != null ? params.starPoints : 5;
        const inner = params.innerRadius != null ? params.innerRadius : 0.5;
        const pts = starPoints(1, inner, n, 0);
        paint(ctx, params, function () {
          pts.forEach(function (p, i) {
            const px = p[0] * size, py = p[1] * size;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          });
          ctx.closePath();
        });
      } else if (kind === "line") {
        const pts = params.points || [[-1, 0], [1, 0]];
        paint(ctx, params, function () {
          pts.forEach(function (p, i) {
            const px = p[0] * size, py = p[1] * size;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          });
        });
      } else if (kind === "path") {
        const pts = params.points || [];
        paint(ctx, params, function () {
          pts.forEach(function (p, i) {
            const px = p[0] * size, py = p[1] * size;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          });
          if (params.closed !== false) ctx.closePath();
        });
      } else {
        // polygon（含自定义 points）
        let pts;
        if (params.points && params.points.length) {
          pts = params.points;
        } else {
          pts = polygonPoints(params.sides != null ? params.sides : 6, 0);
        }
        paint(ctx, params, function () {
          pts.forEach(function (p, i) {
            const px = p[0] * size, py = p[1] * size;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          });
          if (params.closed !== false) ctx.closePath();
        });
      }
      ctx.restore();
    },
  });

  // —— path：一组点连成折线/曲线，支持生长/虚线 ——
  RF.effects.register("path", {
    meta: { category: "primitive", desc: "折线/平滑曲线，支持逐段生长与虚线。", params: {
      points: { type: "array", desc: "画布归一化点 [[x,y],...]，x/y ∈ [0,1]" },
      smooth: { type: "string", default: "linear", range: ["linear","catmullRom"] },
      closed: { type: "boolean", default: false },
      grow: { type: "boolean", default: false, desc: "按进度逐段生长" },
      dash: { type: "array", desc: "[on, off] 虚线（像素）" },
      stroke: { type: "string", default: "$fg" },
      fill: { type: "string", default: "" },
      lineWidth: { type: "number", default: 2 },
      opacity: { type: "number", default: 1 },
    }},
    draw: function (ctx, f, params, env) {
      const W = f.W, H = f.H;
      const pts = (params.points || []).map(function (p) {
        return [p[0] * W, p[1] * H];
      });
      if (pts.length < 2) return;

      ctx.save();
      ctx.globalAlpha *= (params.opacity != null ? params.opacity : 1) * f.easedP;

      // 构建路径点序列（平滑时展开 Catmull-Rom）
      let seq = pts;
      if (params.smooth === "catmullRom") {
        seq = [];
        const n = pts.length;
        for (let i = 0; i < n - 1; i++) {
          const p0 = pts[Math.max(0, i - 1)];
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const p3 = pts[Math.min(n - 1, i + 2)];
          const seg = 16;
          for (let s = 0; s < seg; s++) {
            const t = s / seg;
            const x = RF.Motion.catmullRom(p0[0], p1[0], p2[0], p3[0], t);
            const y = RF.Motion.catmullRom(p0[1], p1[1], p2[1], p3[1], t);
            seq.push([x, y]);
          }
        }
        seq.push(pts[n - 1]);
      }

      // 生长：截取前 N 段
      let drawSeq = seq;
      if (params.grow) {
        const keep = Math.max(2, Math.ceil(seq.length * f.easedP));
        drawSeq = seq.slice(0, keep);
      }

      ctx.beginPath();
      drawSeq.forEach(function (p, i) {
        if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
      });
      if (params.closed) ctx.closePath();

      if (params.dash && params.dash.length === 2) {
        ctx.setLineDash([params.dash[0], params.dash[1]]);
      }

      if (params.fill) {
        ctx.fillStyle = params.fill;
        ctx.fill();
      }
      if (params.stroke !== "" && params.stroke != null) {
        ctx.strokeStyle = params.stroke;
        ctx.lineWidth = params.lineWidth != null ? params.lineWidth : 2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    },
  });
})(window.RF = window.RF || {});
