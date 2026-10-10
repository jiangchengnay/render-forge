// engine/templates/index.js
// 模板系统：把 {"template":"...", "slots":{...}} 展开成完整 storyboard。
// 用法：const sb = RF.Templates.expand({ template: "product-launch", slots: {...} });
(function (RF) {
  const REGISTRY = {};
  function register(name, fn) { REGISTRY[name] = fn; }

  // —— 通用工具 ——
  function mkMeta(slots, defDur) {
    return {
      title: slots.title || "untitled",
      width: slots.width || 1080,
      height: slots.height || 1080,
      duration: slots.duration || defDur,
      seed: slots.seed != null ? slots.seed : (slots.title || "rf"),
    };
  }
  function defaultPost() {
    return [
      { effect: "bloom", amount: 0.4, threshold: 0.68, radius: 16 },
      { effect: "vignette", amount: 0.55 },
      { effect: "grain", amount: 0.05, cell: 2 },
    ];
  }
  function bgRadial(inner, outer) {
    return { type: "radial", cx: 0.5, cy: 0.5, radius: 1.1, inner: inner, outer: outer };
  }
  function bgGrad(c0, c1, angle) {
    return { type: "gradient", angle: angle || 135, stops: [
      { at: 0, color: c0 }, { at: 1, color: c1 } ] };
  }

  // —— 展开入口 ——
  function expand(spec) {
    if (!spec || !spec.template) return spec;
    const fn = REGISTRY[spec.template];
    if (!fn) {
      console.warn("[RF] unknown template: " + spec.template);
      return spec;
    }
    return fn(spec.slots || {}, spec);
  }

  RF.Templates = {
    register: register,
    expand: expand,
    list: function () { return Object.keys(REGISTRY); },
    _util: { mkMeta: mkMeta, defaultPost: defaultPost, bgRadial: bgRadial, bgGrad: bgGrad },
  };
})(window.RF = window.RF || {});