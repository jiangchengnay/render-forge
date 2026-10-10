// tools/lint.js
// 反模式检测：扫描 DSL 是否触发"AI 屏保"。
(function (RF) {
  function lintStoryboard(sb) {
    const warnings = [];
    if (!sb || typeof sb !== "object") {
      warnings.push({ level: "error", msg: "storyboard 不是对象" });
      return warnings;
    }
    const tracks = [];
    if (Array.isArray(sb.tracks)) tracks.push(...sb.tracks);
    if (Array.isArray(sb.groups)) {
      sb.groups.forEach((g) => { (g.clips || []).forEach((c) => tracks.push(c)); });
    }
    if (Array.isArray(sb.acts)) {
      sb.acts.forEach((a) => { if (Array.isArray(a.tracks)) tracks.push(...a.tracks); });
    }

    const effectSet = new Set(tracks.map((c) => c.effect));
    if (tracks.length < 2) {
      warnings.push({ level: "warn", msg: "只有 " + tracks.length + " 个 clip，几乎必然单调" });
    }
    if (effectSet.size < 2) {
      warnings.push({ level: "warn", msg: "只用了 " + effectSet.size + " 种效果" });
    }

    const allSameAt = tracks.every((c) => (c.at || 0) === (tracks[0].at || 0));
    const allLinear = tracks.every((c) => !c.ease || c.ease === "linear");
    if (tracks.length >= 3 && allSameAt && allLinear) {
      warnings.push({ level: "warn", msg: "所有 clip 同时开始且全是线性" });
    }

    const rawColors = [];
    const scanColor = (obj) => {
      if (typeof obj === "string") {
        if (/^#[0-9a-fA-F]{3,8}$/.test(obj) || /^rgba?\(/.test(obj)) rawColors.push(obj);
      } else if (Array.isArray(obj)) obj.forEach(scanColor);
      else if (obj && typeof obj === "object") for (const k in obj) scanColor(obj[k]);
    };
    scanColor(tracks);
    if (rawColors.length > 3) {
      warnings.push({ level: "info", msg: "检测到 " + rawColors.length + " 处硬编码颜色" });
    }

    if (!Array.isArray(sb.post) || sb.post.length === 0) {
      warnings.push({ level: "warn", msg: "无后处理链" });
    }

    const textEffects = ["typewriter", "wordPop", "blurFocus", "titleCard", "lyricLine", "bezierText", "labelText", "bulletList", "codeBlock"];
    const textClips = tracks.filter((c) => textEffects.indexOf(c.effect) >= 0);
    textClips.forEach((c) => {
      const x = c.params && c.params.x != null ? c.params.x : 0.5;
      const y = c.params && c.params.y != null ? c.params.y : 0.5;
      if (Math.abs(x - 0.5) < 0.08 && Math.abs(y - 0.5) < 0.12) {
        warnings.push({ level: "info", msg: "文字位于画面正中，可能压在主体上" });
      }
    });

    return warnings;
  }
  RF.lintStoryboard = lintStoryboard;
})(window.RF = window.RF || {});
