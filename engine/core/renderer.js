// engine/core/renderer.js
// 渲染后端抽象层。定义统一接口，为 WebGL/WebGPU 铺路。
// 当前只有 Canvas2D 实现；效果通过 f.backend 调用，不直接耦合 canvas API。
// 
// 设计：不强制迁移（49 个效果已用 Canvas2D），而是提供：
//   1. 后端注册机制（registerBackend）
//   2. 能力探测（caps）
//   3. 创建入口（create），runtime 通过它拿 ctx
//   4. 后处理可声明 requiredBackend，运行时按后端选择实现
(function (RF) {
  const BACKENDS = {};

  // Canvas2D 后端
  function Canvas2DBackend(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', opts || {});
    this.name = 'canvas2d';
    this.caps = {
      filter: true,            // ctx.filter
      composite: true,         // globalCompositeOperation
      getImageData: true,
      shader: false,
      webgl: false,
    };
  }
  Canvas2DBackend.prototype = {
    resize(w, h) { this.canvas.width = w; this.canvas.height = h; },
    clear(w, h) { this.ctx.clearRect(0, 0, w, h); },
    getContext() { return this.ctx; },
    createOffscreen(w, h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      return { canvas: c, ctx: c.getContext('2d') };
    },
    // 高层：绘制一张图到目标
    blit(src, x, y, w, h) { this.ctx.drawImage(src, x, y, w, h); },
  };
  BACKENDS['canvas2d'] = {
    name: 'canvas2d',
    create(canvas, opts) { return new Canvas2DBackend(canvas, opts); },
  };

  // WebGL 后端骨架（占位，未来实现）
  BACKENDS['webgl'] = {
    name: 'webgl',
    create(canvas, opts) {
      // 真实实现需要 FBO、shader 管线、效果改写为 GLSL
      // 这里仅保留接口，未实现时回落 Canvas2D
      console.warn('[RF] WebGL 后端未实现，回落 Canvas2D');
      return BACKENDS['canvas2d'].create(canvas, opts);
    },
  };

  // 能力探测（用于效果选择实现）
  function detectCaps() {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    const caps = {};
    caps.filter = typeof ctx.filter !== 'undefined';
    try { ctx.globalCompositeOperation = 'overlay'; caps.compositeOverlay = ctx.globalCompositeOperation === 'overlay'; } catch (e) { caps.compositeOverlay = false; }
    caps.webgl = !!document.createElement('canvas').getContext('webgl2');
    return caps;
  }

  RF.Renderer = {
    register(name, impl) { BACKENDS[name] = impl; },
    create(name, canvas, opts) {
      const b = BACKENDS[name] || BACKENDS['canvas2d'];
      return b.create(canvas, opts);
    },
    list() { return Object.keys(BACKENDS); },
    detectCaps: detectCaps,
  };
})(window.RF = window.RF || {});
