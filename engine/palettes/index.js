// engine/palettes/index.js
// 审美锚点：预置配色。AI 在 DSL 里只写配色名（如 "neonDusk"），
// 效果从这里取色，从而无法产出难看的配色。

(function (RF) {
  // 每个调色板：
  //   bg      背景底色
  //   fg      主体前景色（线条、文字）
  //   colors  强调色序列（按索引取用，效果内部循环使用）
  //   accent  单一高亮点色（用于聚焦元素）
  //   mood    一句话描述（给人/AI 看，理解适用场景）
  const PALETTES = {
    // —— 暗色霓虹系 ——
    neonDusk: {
      mood: "暗紫底 + 青粉霓虹，赛博夜景，适合光效/粒子/glitch",
      bg: "#0a0a12",
      fg: "#e8e8ff",
      colors: ["#00e5ff", "#ff2d95", "#7b5cff", "#00ffa3", "#ffd23f"],
      accent: "#00e5ff",
    },
    cyberMint: {
      mood: "深墨绿底 + 薄荷绿霓虹，冷静科技感",
      bg: "#04120e",
      fg: "#d6fff2",
      colors: ["#00ffa3", "#3ddc97", "#00e5ff", "#c0ff6b", "#ffffff"],
      accent: "#00ffa3",
    },
    synthSunset: {
      mood: "深紫底 + 橙粉渐层，80s synthwave",
      bg: "#1a0b2e",
      fg: "#ffe8d6",
      colors: ["#ff6b6b", "#ff9f45", "#ffd93d", "#c56cf0", "#ff2d95"],
      accent: "#ff9f45",
    },

    // —— 亮色清新系 ——
    paperMint: {
      mood: "米白底 + 薄荷绿，清爽明亮，适合 2D 图形/文字",
      bg: "#f7f9f4",
      fg: "#1a2b22",
      colors: ["#3ddc97", "#52b2cf", "#ffd23f", "#ff8c69", "#6b4fbb"],
      accent: "#3ddc97",
    },
    coralCream: {
      mood: "奶油底 + 珊瑚橙，温暖柔和，适合人文/生活类",
      bg: "#fdf6ec",
      fg: "#3a2c25",
      colors: ["#ff8c69", "#ffb385", "#ffd97d", "#6ec6b3", "#8a6bbf"],
      accent: "#ff8c69",
    },
    skyBlue: {
      mood: "浅蓝底 + 天蓝青，通透轻盈，适合数据/几何",
      bg: "#eef6ff",
      fg: "#10263d",
      colors: ["#3d8bff", "#4dd0e1", "#7c5cff", "#ffb347", "#ff5d73"],
      accent: "#3d8bff",
    },

    // —— 强对比系 ——
    monochrome: {
      mood: "纯黑白灰，极简高级，适合排版/几何/线框",
      bg: "#0d0d0d",
      fg: "#f5f5f5",
      colors: ["#f5f5f5", "#b0b0b0", "#6e6e6e", "#3a3a3a", "#ffffff"],
      accent: "#ffffff",
    },
    inkAndGold: {
      mood: "墨黑底 + 金色，东方质感，庄重华丽",
      bg: "#0b0b0d",
      fg: "#f0e6d2",
      colors: ["#d4af37", "#e8c86a", "#b8912f", "#8c6d1f", "#f5e6b8"],
      accent: "#d4af37",
    },
    deepSea: {
      mood: "深海蓝底 + 青白，静谧深邃，适合流体/粒子",
      bg: "#050f1a",
      fg: "#cfe9ff",
      colors: ["#3d8bff", "#00c2ff", "#5ce1e6", "#8fd6ff", "#ffffff"],
      accent: "#00c2ff",
    },

    // —— 高饱和活泼系 ——
    memphis: {
      mood: "米色底 + 高饱和撞色，孟菲斯风，活泼搞怪",
      bg: "#f3ede1",
      fg: "#1a1a1a",
      colors: ["#ff5d73", "#ffb347", "#3ddc97", "#4d9dff", "#c56cf0"],
      accent: "#ff5d73",
    },
    bubblegum: {
      mood: "粉紫底 + 糖果色，可爱甜美，适合社交/休闲",
      bg: "#fff0f6",
      fg: "#3a1f2e",
      colors: ["#ff6ec7", "#ff9ecd", "#a78bfa", "#7dd3fc", "#fde68a"],
      accent: "#ff6ec7",
    },
    lavaLamp: {
      mood: "暗红底 + 熔岩橙黄，热烈流动",
      bg: "#1a0603",
      fg: "#ffe8d6",
      colors: ["#ff4d00", "#ff8c00", "#ffd23f", "#ff2d55", "#ffb385"],
      accent: "#ff4d00",
    },
    auroraGreen: {
      mood: "极夜黑底 + 极光绿紫，梦幻自然，适合抽象流形",
      bg: "#04070d",
      fg: "#d9ffe8",
      colors: ["#00ffa3", "#7b5cff", "#00e5ff", "#c0ff6b", "#ff2d95"],
      accent: "#00ffa3",
    },
  };

  // 取调色板；未知名字回落 neonDusk，保证不会崩
  function get(name) {
    return PALETTES[name] || PALETTES.neonDusk;
  }

  // 按索引循环取强调色
  function colorAt(pal, i) {
    const c = pal.colors;
    return c[((i % c.length) + c.length) % c.length];
  }

  // —— 颜色工具（供效果内部使用）——
  const Color = {
    // "#rrggbb" -> {r,g,b} 0-255
    parse(hex) {
      let h = String(hex).replace("#", "");
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      const n = parseInt(h, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    },
    // {r,g,b} -> "#rrggbb"
    toHex(c) {
      const f = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
      return "#" + f(c.r) + f(c.g) + f(c.b);
    },
    // 两色混合 t∈[0,1]
    mix(a, b, t) {
      const ca = Color.parse(a), cb = Color.parse(b);
      return Color.toHex({
        r: ca.r + (cb.r - ca.r) * t,
        g: ca.g + (cb.g - ca.g) * t,
        b: ca.b + (cb.b - ca.b) * t,
      });
    },
    // 变亮/变暗 amount>0 变亮
    shift(hex, amount) {
      const c = Color.parse(hex);
      const f = amount > 0 ? (v) => v + (255 - v) * amount : (v) => v * (1 + amount);
      return Color.toHex({ r: f(c.r), g: f(c.g), b: f(c.b) });
    },
    // 带 alpha 的 rgba 字符串
    rgba(hex, a) {
      const c = Color.parse(hex);
      return `rgba(${c.r},${c.g},${c.b},${a})`;
    },
  };

  RF.PALETTES = PALETTES;
  RF.getPalette = get;
  RF.colorAt = colorAt;
  RF.Color = Color;
})(window.RF = window.RF || {});
