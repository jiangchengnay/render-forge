// tools/validate-browser.js
// 浏览器端校验入口（简化版，直接检查 effect 名与参数类型）
(function (RF) {
  RF.validate = function (sb) {
    const problems = [];
    const push = (level, where, msg) => problems.push({ level, where, msg });
    if (!sb || typeof sb !== "object") { push("error", "root", "不是对象"); return problems; }
    if (sb.template) { push("info", "template", "模板 spec"); return problems; }
    const validEffects = Object.keys(RF.effects).filter(k => k !== "register");
    const validPost = Object.keys(RF.postfx).filter(k => k !== "register");
    const validTrans = RF.Transitions.list();
    const clips = [];
    if (Array.isArray(sb.tracks)) sb.tracks.forEach((c, i) => clips.push({ c, w: "tracks[" + i + "]" }));
    if (Array.isArray(sb.acts)) sb.acts.forEach((a, ai) => {
      if (a.tracks) a.tracks.forEach((c, i) => clips.push({ c, w: "acts[" + ai + "].tracks[" + i + "]" }));
      ["transitionIn", "transitionOut"].forEach(k => {
        if (a[k] && a[k].type && validTrans.indexOf(a[k].type) < 0)
          push("error", "acts[" + ai + "]." + k, "未知转场 " + a[k].type);
      });
    });
    if (Array.isArray(sb.post)) sb.post.forEach((p, i) => {
      if (p.effect && validPost.indexOf(p.effect) < 0) push("error", "post[" + i + "]", "未知后处理 " + p.effect);
    });
    clips.forEach(({ c, w }) => {
      if (!c.effect) { push("error", w, "缺少 effect"); return; }
      if (validEffects.indexOf(c.effect) < 0) { push("error", w, "未知效果 " + c.effect); return; }
      const meta = RF.effects[c.effect].meta;
      if (meta && meta.params && c.params) {
        Object.keys(c.params).forEach(k => {
          if (!(k in meta.params)) push("warn", w + ".params." + k, "未声明参数（可能拼写错误）");
        });
      }
    });
    return problems;
  };
})(window.RF = window.RF || {});
