// engine/core/webgl-effects.js
// WebGL 效果层：把高频效果 port 到 GLSL。已实现 fbmNoise（真 simplex + fbm + 域扭曲，GPU 实时）。
(function (RF) {
  var VERT_SRC = "#version 300 es\nin vec2 a_pos;\nout vec2 v_uv;\nvoid main() {\n  v_uv = a_pos * 0.5 + 0.5;\n  gl_Position = vec4(a_pos, 0.0, 1.0);\n}";
  var NOISE_FRAG_SRC = "#version 300 es\nprecision highp float;\nuniform float u_time;\nuniform float u_scale;\nuniform float u_octaves;\nuniform float u_warp;\nuniform vec3 u_colorA;\nuniform vec3 u_colorB;\nuniform float u_bands;\nuniform vec2 u_resolution;\nin vec2 v_uv;\nout vec4 outColor;\nvec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }\nvec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }\nvec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }\nfloat snoise(vec2 v) {\n  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);\n  vec2 i = floor(v + dot(v, C.yy));\n  vec2 x0 = v - i + dot(i, C.xx);\n  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);\n  vec4 x12 = x0.xyxy + C.xxzz;\n  x12.xy -= i1;\n  i = mod289(i);\n  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));\n  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);\n  m = m * m; m = m * m;\n  vec3 x = 2.0 * fract(p * C.www) - 1.0;\n  vec3 h = abs(x) - 0.5;\n  vec3 ox = floor(x + 0.5);\n  vec3 a0 = x - ox;\n  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);\n  vec3 g;\n  g.x = a0.x * x0.x + h.x * x0.y;\n  g.yz = a0.yz * x12.xz + h.yz * x12.yw;\n  return 130.0 * dot(m, g);\n}\nfloat fbm(vec2 p, int oct) {\n  float v = 0.0, a = 0.5;\n  for (int i = 0; i < 8; i++) {\n    if (i >= oct) break;\n    v += a * snoise(p);\n    p *= 2.0;\n    a *= 0.5;\n  }\n  return v;\n}\nvoid main() {\n  vec2 asp = vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);\n  vec2 p = (v_uv - 0.5) * u_scale * asp;\n  float t = u_time;\n  if (u_warp > 0.0) {\n    float wx = snoise(p + vec2(t * 0.3, 0.0));\n    float wy = snoise(p + vec2(5.2, 1.3 + t * 0.3));\n    p += vec2(wx, wy) * u_warp;\n  }\n  float v = fbm(p + vec2(0.0, t), int(u_octaves));\n  v = v * 0.5 + 0.5;\n  if (u_bands > 0.0) v = floor(v * u_bands) / u_bands;\n  vec3 col = mix(u_colorB, u_colorA, v);\n  outColor = vec4(col, 1.0);\n}";

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[RF WebGL] shader 编译失败:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function link(gl, vsSrc, fsSrc) {
    var vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
    var fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    var p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('[RF WebGL] link 失败:', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function hexToRgb(hex) {
    if (typeof hex !== 'string') return [1, 1, 1];
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return [1, 1, 1];
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function NoiseRenderer(w, h) {
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    // 注意：preserveDrawingBuffer 关闭（性能）；每次 render 后立即 drawImage
    var gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) return null;
    this.gl = gl;
    this.canvas = canvas;
    this.w = w; this.h = h;
    this.prog = link(gl, VERT_SRC, NOISE_FRAG_SRC);
    if (!this.prog) return null;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(this.prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    var self = this;
    ['u_time','u_scale','u_octaves','u_warp','u_bands','u_resolution','u_colorA','u_colorB'].forEach(function (n) {
      self.u[n] = gl.getUniformLocation(self.prog, n);
    });
  }

  NoiseRenderer.prototype.render = function (t, params, palette) {
    var gl = this.gl;
    gl.useProgram(this.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.bindVertexArray(this.vao);
    gl.uniform1f(this.u.u_time, t);
    gl.uniform1f(this.u.u_scale, params.scale != null ? params.scale : 3);
    gl.uniform1f(this.u.u_octaves, params.octaves != null ? params.octaves : 4);
    gl.uniform1f(this.u.u_warp, params.warp != null ? params.warp : 0.5);
    gl.uniform1f(this.u.u_bands, params.bands != null ? params.bands : 0);
    gl.uniform2f(this.u.u_resolution, this.w, this.h);
    var cA = hexToRgb(params.colorA || (palette && palette.colors[0]) || '#ffffff');
    var cB = hexToRgb(params.colorB || (palette && palette.bg) || '#000000');
    gl.uniform3f(this.u.u_colorA, cA[0], cA[1], cA[2]);
    gl.uniform3f(this.u.u_colorB, cB[0], cB[1], cB[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  };

  RF.WebGLEffects = {
    available: function () {
      try { return !!document.createElement('canvas').getContext('webgl2'); }
      catch (e) { return false; }
    },
    createNoise: function (w, h) {
      if (!RF.WebGLEffects.available()) return null;
      try { return new NoiseRenderer(w, h); }
      catch (e) { console.error('[RF WebGL] noise 创建失败:', e); return null; }
    },
  };
})(window.RF = window.RF || {});
