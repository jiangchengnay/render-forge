// engine/plugin.js
// 插件效果系统：运行时注册外部效果（不改核心）。
// 用法：
//   RF.Plugin.load({ id:'myFx', meta:{...}, draw:function(ctx,f,params,env){...} })
//   RF.Plugin.loadFromUrl('effects/my-effect.js')
(function (RF) {
  var loaded = {};

  function load(def) {
    if (!def || !def.id) throw new Error('插件需要 id');
    if (typeof def.draw !== 'function' && !def.stateful) throw new Error('插件需要 draw 或 stateful');
    RF.effects.register(def.id, {
      meta: def.meta || { category: def.category || 'plugin', desc: def.desc || '外部插件效果', params: def.params || {} },
      draw: def.draw,
      stateful: def.stateful || false,
      init: def.init,
      tick: def.tick,
      paint: def.paint,
      snapshot: def.snapshot,
      restore: def.restore,
    });
    loaded[def.id] = { id: def.id, loadedAt: Date.now(), meta: def.meta };
    return def.id;
  }

  // 从 URL 加载（脚本应调用 RF.Plugin.register(...) 或 module.exports）
  function loadFromUrl(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.onload = function () { resolve(loaded); };
      s.onerror = function () { reject(new Error('加载失败: ' + url)); };
      document.head.appendChild(s);
    });
  }

  // 从源码字符串加载（AI 可动态生成效果）
  function loadFromSource(code) {
    try {
      var fn = new Function('RF', code);
      fn(RF);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function list() { return Object.keys(loaded); }
  function unload(id) { delete RF.effects[id]; delete loaded[id]; }

  RF.Plugin = {
    load: load,
    loadFromUrl: loadFromUrl,
    loadFromSource: loadFromSource,
    list: list,
    unload: unload,
  };
})(window.RF = window.RF || {});
