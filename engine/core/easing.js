// engine/core/easing.js
// 缓动曲线库。AI 只需在 DSL 里写名字（如 "outExpo"），引擎负责实现。
// 全部函数满足 f(0)=0, f(1)=1。

(function (RF) {
  const c1 = 1.70158;
  const c2 = c1 * 1.525;
  const c3 = c1 + 1;
  const c4 = (2 * Math.PI) / 3;
  const c5 = (2 * Math.PI) / 4.5;

  const Easing = {
    linear: (x) => x,

    // 三角
    inSine: (x) => 1 - Math.cos((x * Math.PI) / 2),
    outSine: (x) => Math.sin((x * Math.PI) / 2),
    inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,

    // 二次
    inQuad: (x) => x * x,
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),

    // 三次
    inCubic: (x) => x * x * x,
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),

    // 四次
    inQuart: (x) => x * x * x * x,
    outQuart: (x) => 1 - Math.pow(1 - x, 4),
    inOutQuart: (x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),

    // 五次
    inQuint: (x) => x * x * x * x * x,
    outQuint: (x) => 1 - Math.pow(1 - x, 5),
    inOutQuint: (x) => (x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2),

    // 指数
    inExpo: (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
    outExpo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inOutExpo: (x) =>
      x === 0 ? 0
      : x === 1 ? 1
      : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2
      : (2 - Math.pow(2, -20 * x + 10)) / 2,

    // 圆
    inCirc: (x) => 1 - Math.sqrt(1 - Math.pow(x, 2)),
    outCirc: (x) => Math.sqrt(1 - Math.pow(x - 1, 2)),
    inOutCirc: (x) =>
      x < 0.5
        ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2
        : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2,

    // 回弹
    inBack: (x) => c3 * x * x * x - c1 * x * x,
    outBack: (x) => 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2),
    inOutBack: (x) =>
      x < 0.5
        ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
        : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2,

    // 弹性
    inElastic: (x) =>
      x === 0 ? 0 : x === 1 ? 1 : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4),
    outElastic: (x) =>
      x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1,
    inOutElastic: (x) =>
      x === 0 ? 0
      : x === 1 ? 1
      : x < 0.5
        ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
        : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1,

    // 弹跳
    outBounce: (x) => {
      const n1 = 7.5625, d1 = 2.75;
      if (x < 1 / d1) return n1 * x * x;
      if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
      if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    },
    inBounce: (x) => 1 - Easing.outBounce(1 - x),
    inOutBounce: (x) =>
      x < 0.5
        ? (1 - Easing.outBounce(1 - 2 * x)) / 2
        : (1 + Easing.outBounce(2 * x - 1)) / 2,

    // 阶跃（用于瞬间切换）
    step: (x) => (x >= 1 ? 1 : 0),
  };

  // 支持自定义 cubic-bezier：[x1,y1,x2,y2]
  Easing.cubicBezier = function (x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
    const sampleY = (t) => ((ay * t + by) * t + cy) * t;
    const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const xe = sampleX(t) - x;
        if (Math.abs(xe) < 1e-6) return sampleY(t);
        const d = sampleDX(t);
        if (Math.abs(d) < 1e-6) break;
        t -= xe / d;
      }
      return sampleY(t);
    };
  };

  // 解析：字符串名 / [a,b,c,d] / 函数
  Easing.resolve = function (e) {
    if (typeof e === "function") return e;
    if (Array.isArray(e) && e.length === 4) return Easing.cubicBezier(e[0], e[1], e[2], e[3]);
    if (typeof e === "string" && Easing[e]) return Easing[e];
    return Easing.linear;
  };

  RF.Easing = Easing;
})(window.RF = window.RF || {});
