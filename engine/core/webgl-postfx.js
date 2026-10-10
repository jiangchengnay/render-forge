// engine/core/webgl-postfx.js
// WebGL2 后处理——真 shader bloom（高斯模糊，非金字塔近似）。
// 若浏览器不支持 WebGL2，返回 null，调用方回落 Canvas2D 实现。
(function (RF) {
  var VERT_SRC = "#version 300 es\nin vec2 a_pos;\nout vec2 v_uv;\nvoid main() {\n  v_uv = a_pos * 0.5 + 0.5;\n  gl_Position = vec4(a_pos, 0.0, 1.0);\n}";
  var BRIGHT_SRC = "#version 300 es\nprecision highp float;\nuniform sampler2D u_tex;\nuniform float u_threshold;\nin vec2 v_uv;\nout vec4 outColor;\nvoid main() {\n  vec4 c = texture(u_tex, v_uv);\n  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));\n  float f = max(0.0, lum - u_threshold) / max(0.0001, 1.0 - u_threshold);\n  outColor = vec4(c.rgb * f, 1.0);\n}";
  var BLUR_SRC = "#version 300 es\nprecision highp float;\nuniform sampler2D u_tex;\nuniform vec2 u_dir;\nuniform float u_radius;\nin vec2 v_uv;\nout vec4 outColor;\nvoid main() {\n  float w0 = 0.227027;\n  float w1 = 0.1945946;\n  float w2 = 0.1216216;\n  float w3 = 0.054054;\n  float w4 = 0.016216;\n  vec4 sum = texture(u_tex, v_uv) * w0;\n  vec2 d = u_dir * u_radius;\n  sum += texture(u_tex, v_uv + d * 1.0) * w1;\n  sum += texture(u_tex, v_uv - d * 1.0) * w1;\n  sum += texture(u_tex, v_uv + d * 2.0) * w2;\n  sum += texture(u_tex, v_uv - d * 2.0) * w2;\n  sum += texture(u_tex, v_uv + d * 3.0) * w3;\n  sum += texture(u_tex, v_uv - d * 3.0) * w3;\n  sum += texture(u_tex, v_uv + d * 4.0) * w4;\n  sum += texture(u_tex, v_uv - d * 4.0) * w4;\n  outColor = sum;\n}";
  var COMPOSITE_SRC = "#version 300 es\nprecision highp float;\nuniform sampler2D u_base;\nuniform sampler2D u_bloom;\nuniform float u_amount;\nin vec2 v_uv;\nout vec4 outColor;\nvoid main() {\n  vec3 base = texture(u_base, v_uv).rgb;\n  vec3 bloom = texture(u_bloom, v_uv).rgb;\n  outColor = vec4(base + bloom * u_amount, 1.0);\n}";

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[RF WebGL] shader 编译失败:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function program(gl, vsSrc, fsSrc) {
    var vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
    var fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('[RF WebGL] program 链接失败:', gl.getProgramInfoLog(p));
      return null;
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return p;
  }

  function createQuad(gl) {
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    return { vao: vao, buf: buf };
  }

  function createTex(gl, w, h) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function createFBO(gl, w, h) {
    var tex = createTex(gl, w, h);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo: fbo, tex: tex, w: w, h: h };
  }

  function WebGLBloom(w, h) {
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var gl = canvas.getContext('webgl2', { alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) return null;
    this.gl = gl;
    this.canvas = canvas;
    this.w = w; this.h = h;

    this.progBright = program(gl, VERT_SRC, BRIGHT_SRC);
    this.progBlur = program(gl, VERT_SRC, BLUR_SRC);
    this.progComposite = program(gl, VERT_SRC, COMPOSITE_SRC);
    if (!this.progBright || !this.progBlur || !this.progComposite) return null;

    var q = createQuad(gl);
    this.vao = q.vao; this.vbo = q.buf;
    // 半分辨率做 bloom（性能 + 更柔）
    var hw = Math.max(1, Math.floor(w / 2));
    var hh = Math.max(1, Math.floor(h / 2));
    this.fboBright = createFBO(gl, hw, hh);
    this.fboBlurA = createFBO(gl, hw, hh);
    this.fboBlurB = createFBO(gl, hw, hh);
    this.fboBase = createFBO(gl, w, h);
    this.hw = hw; this.hh = hh;

    // 输入纹理（主画布上传）
    this.inputTex = createTex(gl, w, h);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  }

  WebGLBloom.prototype.bindQuad = function (prog, attribName) {
    var gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    var loc = gl.getAttribLocation(prog, attribName || 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  };

  WebGLBloom.prototype.draw = function (prog, targetFbo) {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo ? targetFbo.fbo : null);
    this.bindQuad(prog);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  // 应用 bloom，返回合成后的 canvas（原尺寸）
  WebGLBloom.prototype.apply = function (sourceCanvas, amount, threshold, radius) {
    var gl = this.gl;
    var w = this.w, h = this.h;

    // 上传主画布到 inputTex
    gl.bindTexture(gl.TEXTURE_2D, this.inputTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);

    // 1. 亮部提取到 fboBright
    gl.useProgram(this.progBright);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.inputTex);
    gl.uniform1i(gl.getUniformLocation(this.progBright, 'u_tex'), 0);
    gl.uniform1f(gl.getUniformLocation(this.progBright, 'u_threshold'), threshold);
    gl.viewport(0, 0, this.hw, this.hh);
    this.draw(this.progBright, this.fboBright);

    // 2. 横向模糊：fboBright → fboBlurA
    gl.useProgram(this.progBlur);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboBright.tex);
    gl.uniform1i(gl.getUniformLocation(this.progBlur, 'u_tex'), 0);
    gl.uniform2f(gl.getUniformLocation(this.progBlur, 'u_dir'), 1 / this.hw, 0);
    gl.uniform1f(gl.getUniformLocation(this.progBlur, 'u_radius'), Math.max(0.5, radius / 4));
    gl.viewport(0, 0, this.hw, this.hh);
    this.draw(this.progBlur, this.fboBlurA);

    // 3. 纵向模糊：fboBlurA → fboBlurB
    gl.bindTexture(gl.TEXTURE_2D, this.fboBlurA.tex);
    gl.uniform2f(gl.getUniformLocation(this.progBlur, 'u_dir'), 0, 1 / this.hh);
    this.draw(this.progBlur, this.fboBlurB);

    // 4. 再一遍横向 + 纵向（更大范围）
    gl.bindTexture(gl.TEXTURE_2D, this.fboBlurB.tex);
    gl.uniform2f(gl.getUniformLocation(this.progBlur, 'u_dir'), 1 / this.hw, 0);
    gl.uniform1f(gl.getUniformLocation(this.progBlur, 'u_radius'), Math.max(0.5, radius / 2));
    this.draw(this.progBlur, this.fboBlurA);

    gl.bindTexture(gl.TEXTURE_2D, this.fboBlurA.tex);
    gl.uniform2f(gl.getUniformLocation(this.progBlur, 'u_dir'), 0, 1 / this.hh);
    this.draw(this.progBlur, this.fboBlurB);

    // 5. 合成：inputTex + blurB，输出到默认帧缓冲
    gl.useProgram(this.progComposite);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.inputTex);
    gl.uniform1i(gl.getUniformLocation(this.progComposite, 'u_base'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fboBlurB.tex);
    gl.uniform1i(gl.getUniformLocation(this.progComposite, 'u_bloom'), 1);
    gl.uniform1f(gl.getUniformLocation(this.progComposite, 'u_amount'), amount);
    gl.viewport(0, 0, w, h);
    this.draw(this.progComposite, null);

    return this.canvas;
  };

  // 探测 WebGL2 可用性
  function available() {
    try {
      var c = document.createElement('canvas');
      return !!c.getContext('webgl2');
    } catch (e) { return false; }
  }

  RF.WebGLPostFX = {
    available: available,
    createBloom: function (w, h) {
      if (!available()) return null;
      try { return new WebGLBloom(w, h); }
      catch (e) { console.error('[RF WebGL] bloom 创建失败:', e); return null; }
    }
  };
})(window.RF = window.RF || {});
