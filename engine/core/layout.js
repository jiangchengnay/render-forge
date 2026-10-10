// engine/core/layout.js
// 布局层：把「锚点 + 内边距」解析为具体的 x/y，减少 AI 手算坐标。
//
// 用法（在 clip 里）：
//   "anchor": "top-left" | "top" | "top-right" | "left" | "center" | "right" |
//              "bottom-left" | "bottom" | "bottom-right"
//   "offsetX": 0.05,  "offsetY": 0.05,   // 相对画布的偏移（0-1）
//   "safeArea": true                       // 是否避开安全区（默认 false）
(function (RF) {
  // 九宫格锚点 → [x比率, y比率, align]
  const ANCHORS = {
    'top-left':     [0.0, 0.0, 'left'],
    'top':          [0.5, 0.0, 'center'],
    'top-right':    [1.0, 0.0, 'right'],
    'left':         [0.0, 0.5, 'left'],
    'center':       [0.5, 0.5, 'center'],
    'right':        [1.0, 0.5, 'right'],
    'bottom-left':  [0.0, 1.0, 'left'],
    'bottom':       [0.5, 1.0, 'center'],
    'bottom-right': [1.0, 1.0, 'right'],
  };

  // 把 clip 的 anchor/offset 转成 x/y（若 clip 已显式给 x/y，则不改）
  // 返回 { x, y, align }
  function resolvePosition(clip, params, W, H) {
    const anchor = clip.anchor;
    if (!anchor || !ANCHORS[anchor]) return null;
    let [xr, yr, align] = ANCHORS[anchor];
    const margin = clip.safeArea ? 0.08 : 0;
    // 安全区：向内收
    if (clip.safeArea) {
      xr = xr === 0 ? margin : (xr === 1 ? 1 - margin : xr);
      yr = yr === 0 ? margin : (yr === 1 ? 1 - margin : yr);
    }
    const ox = clip.offsetX || 0;
    const oy = clip.offsetY || 0;
    return { x: xr + ox, y: yr + oy, align: align };
  }

  // 把解析出的位置合并进 params（clip 显式 x/y 优先）
  function applyToParams(clip, params, W, H) {
    const pos = resolvePosition(clip, params, W, H);
    if (!pos) return params;
    const out = Object.assign({}, params);
    if (out.x == null) out.x = pos.x;
    if (out.y == null) out.y = pos.y;
    // 文字类效果支持 align
    if (out.align == null && pos.align) out.align = pos.align;
    return out;
  }

  RF.Layout = { ANCHORS, resolvePosition, applyToParams };
})(window.RF = window.RF || {});
