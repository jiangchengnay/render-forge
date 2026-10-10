// tools/gen-schema.js
// 从运行时自省生成完整 DSL 文档。调用 RF.genSchema() 返回 Markdown 字符串。
(function (RF) {
  function fmtDefault(v) {
    if (v === null || v === undefined) return "-";
    if (typeof v === "string") return v.length > 40 ? v.slice(0, 40) + "..." : v;
    if (Array.isArray(v)) return "[" + v.length + " items]";
    if (typeof v === "object") return "{...}";
    return String(v);
  }
  function paramTable(params) {
    if (!params) return "_参数未文档化_\n";
    const keys = Object.keys(params);
    if (!keys.length) return "_无参数_\n";
    let out = "| 参数 | 类型 | 默认 | 范围 | 说明 |\n|---|---|---|---|---|\n";
    keys.forEach(function (k) {
      const p = params[k];
      const range = p.range ? p.range.join(" ~ ") : "-";
      out += "| " + k + " | " + (p.type || "any") + " | " + fmtDefault(p.default) + " | " + range + " | " + (p.desc || "") + " |\n";
    });
    return out;
  }
  RF.genSchema = function () {
    const info = RF.introspect();
    let md = "# Render Forge DSL 完整规范\n\n";
    md += "> 本文件由 RF.genSchema() 自动生成。\n\n";
    md += "## 顶层结构\n\n";
    md += "```json\n" + JSON.stringify({
      meta: { title: "作品名", width: 1080, height: 1080, duration: 12, seed: 42 },
      palette: "deepSea",
      post: [{ effect: "bloom", amount: 0.5, threshold: 0.6, radius: 20 }],
      acts: [{
        id: "act1", start: 0, dur: 4,
        background: { type: "radial", cx: 0.5, cy: 0.5, radius: 1, inner: "$bg", outer: "#000" },
        transitionIn: { type: "fade", dur: 0.4 },
        transitionOut: { type: "wipe", dur: 0.3, dir: "left" },
        tracks: [{ effect: "fbmNoise", at: 0, dur: 4, ease: "outCubic", params: { scale: 2, warp: 0.6 } }]
      }]
    }, null, 2) + "\n```\n\n";
    md += "## 可用调色板\n\n";
    md += info.palettes.join(", ") + "\n\n";
    md += "颜色占位符：$0~$4（强调色序列）、$accent、$fg、$bg\n\n";
    md += "## 转场\n\n";
    md += "| 名称 | 说明 |\n|---|---|\n";
    const transDesc = {
      cut: "硬切", fade: "淡入淡出", wipe: "划像(dir)", zoomFade: "缩放淡出",
      iris: "圆形擦除", slide: "推拉(dir)", glitch: "故障切片",
      blocks: "块状溶解(cell)", shapeMask: "形状遮罩(shape)"
    };
    info.transitions.forEach(function (t) {
      md += "| " + t + " | " + (transDesc[t] || "") + " |\n";
    });
    md += "\n## 效果清单\n\n";
    Object.keys(info.effects).forEach(function (name) {
      const def = info.effects[name];
      const meta = def.meta || {};
      md += "### `" + name + "`" + (def.stateful ? " _(stateful)_" : "") + "\n\n";
      if (meta.desc) md += meta.desc + "\n\n";
      if (meta.category) md += "_分类: " + meta.category + "_\n\n";
      md += paramTable(meta.params);
      md += "\n";
    });
    md += "## 后处理\n\n";
    md += "| 名称 |\n|---|\n";
    Object.keys(info.postfx).forEach(function (name) {
      md += "| " + name + " |\n";
    });
    md += "\n## 硬性规则\n\n";
    md += "1. 至少叠 2 种不同效果\n";
    md += "2. 不同 clip 用不同 ease\n";
    md += "3. 颜色用占位符，不硬编码 hex\n";
    md += "4. 至少挂 1-2 项后处理\n";
    md += "5. 文字不要压在画面正中\n";
    md += "6. 多 act 时用不同转场\n";
    return md;
  };
})(window.RF = window.RF || {});