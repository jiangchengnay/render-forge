// engine/core/runtime.js
// 渲染核心 v2：确定性 + 固定 dt + seek 重放 + 双 act 转场。
//
// 效果接口（向后兼容）：
//   无状态效果：{ draw(ctx, f, params, env) }
//   状态型效果：{ stateful: true, init, tick(state, f, params, env), paint(ctx, state, f, params, env) }
//
// f 包含：t（全局时间）, dt（本帧步长）, p, easedP, at, dur, local, W, H, palette, rng, Color, state, actLocal

(function (RF) {
  RF.effects = RF.effects || {};
  RF.effects.register = function (name, def) { RF.effects[name] = def; };
  RF.postfx = RF.postfx || {};
  RF.postfx.register = function (name, def) { RF.postfx[name] = def; };

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  // 把 at 字段（可能是数字 / "beat:N" / {beat:N,offset}）解析为秒
  function resolveAt(at, analysis) {
    if (at == null) return 0;
    if (typeof at === "number") return at;
    if (RF.Audio && RF.Audio.resolveTime) return RF.Audio.resolveTime(at, analysis);
    return 0;
  }

  function localProgress(clip, t, analysis) {
    const at = resolveAt(clip.at, analysis);
    const dur = clip.dur != null ? clip.dur : Infinity;
    if (t < at || t > at + dur) return null;
    if (dur === 0) return 1;
    return clamp01((t - at) / dur);
  }

  const FIXED_DT = 1 / 60;

  class Runtime {
    constructor(canvas, storyboard, opts) {
      this.canvas = canvas;
      // 通过 Renderer 抽象创建后端（默认 canvas2d）
      if (RF.Renderer) {
        this.backend = RF.Renderer.create((opts && opts.backend) || "canvas2d", canvas, opts && opts.ctxOptions);
        this.ctx = this.backend.getContext();
      } else {
        this.ctx = canvas.getContext("2d");
        this.backend = null;
      }
      this.opts = opts || {};
      this.storyboard = null;
      this.duration = 0;
      this.playing = false;
      this._raf = null;
      this._currentT = 0;         // 当前渲染时刻
      this._lastWall = 0;
      this._acc = 0;
      this._actStates = new Map();
      this._postCanvas = null;
      this._postCtx = null;
      this._actBufs = new Map();  // actIndex → offscreen canvas
      this.errors = [];           // 收集运行时错误
      this.load(storyboard);
    }

    load(storyboard) {
      let sb = storyboard || {};
      // 若给了模板 spec（含 template 字段），先展开成完整 storyboard
      if (sb && sb.template && RF.Templates && RF.Templates.expand) {
        sb = RF.Templates.expand(sb);
      }
      // 展开 scenelet include
      if (sb && RF.Scenelet && RF.Scenelet.expand) {
        sb = RF.Scenelet.expand(sb);
      }
      const meta = sb.meta || {};
      const W = meta.width || 1080;
      const H = meta.height || 1080;

      this.canvas.width = W;
      this.canvas.height = H;

      this._postCanvas = document.createElement("canvas");
      this._postCanvas.width = W;
      this._postCanvas.height = H;
      this._postCtx = this._postCanvas.getContext("2d");

      this.storyboard = sb;
      this.acts = RF.Scene ? RF.Scene.normalize(sb) : [{
        id: "main", start: 0, dur: meta.duration || 6,
        background: sb.background || { type: "solid", color: "$bg" },
        tracks: sb.tracks || [], transitionIn: null, transitionOut: null,
      }];

      // —— beat 语法预处理 ——
      // 保存原始 at 到 _atRaw，这样音频变化后可重新解析（不再一次性丢失 beat 语义）
      this._resolveBeats();
      this.duration = meta.duration || RF.Scene.totalDuration(this.acts);
      this.palette = RF.getPalette(sb.palette || "neonDusk");
      this.rng = new RF.Rng(meta.seed != null ? meta.seed : (meta.title || "rf"));

      this._initActStates();
      this._initActBuffers(W, H);
      this._currentT = 0;
      this._keyframes = new Map();
      this.errors = [];

      if (typeof window !== "undefined") window.__rf_runtime = this;
    }

    _initActStates() {
      this._actStates.clear();
      const W = this.canvas.width;
      const H = this.canvas.height;
      this.acts.forEach((act, ai) => {
        const clipStates = new Map();
        (act.tracks || []).forEach((clip, ci) => {
          const state = this._initClipState(clip, act, ci, ai, W, H);
          if (state) clipStates.set(ci, state);
        });
        this._actStates.set(ai, clipStates);
      });
    }

    // 初始化单个 clip 状态（递归支持 group 容器）
    _initClipState(clip, act, ci, ai, W, H) {
      if (clip.type === "group") {
        const children = [];
        (clip.children || []).forEach((child, cci) => {
          const cs = this._initClipState(child, act, ci + "." + cci, ai, W, H);
          if (cs) children.push(cs);
        });
        return { clip: clip, isGroup: true, children: children, index: ci };
      }
      const def = RF.effects[clip.effect];
      if (!def) {
        this.errors.push("unknown effect: " + clip.effect);
        return null;
      }
      let params = this._resolveParams(clip, this.palette);
      if (RF.Layout && (clip.anchor || clip.offsetX != null)) {
        params = RF.Layout.applyToParams(clip, params, W, H);
      }
      const state = { clip, params, internal: null, index: ci, hasExpr: this._hasExpr(clip.params) };
      if (def.init) {
        const clipRng = this.rng.fork(act.id + ":" + clip.effect + ":" + ci);
        try {
          state.internal = def.init(this.ctx, params, {
            rng: clipRng, palette: this.palette,
            width: W, height: H, Color: RF.Color,
          });
        } catch (e) {
          this.errors.push("init " + clip.effect + ": " + e.message);
        }
      }
      return state;
    }

    _initActBuffers(W, H) {
      this._actBufs.clear();
      this.acts.forEach((_, ai) => {
        const c = document.createElement("canvas");
        c.width = W; c.height = H;
        this._actBufs.set(ai, { canvas: c, ctx: c.getContext("2d") });
      });
    }

    // 解析 beat 语法（可重复调用：音频变化后重新解析）
    _resolveBeats() {
      const analysis = (this.storyboard && this.storyboard.audio) ? RF.Audio.current : null;
      if (!RF.Audio || !RF.Audio.resolveTime) return;
      const resolve = (v) => {
        if (v == null) return v;
        if (typeof v === "number") return v;
        if (typeof v === "string" && /^(beat|phrase|interlude|section):/.test(v)) return RF.Audio.resolveTime(v, analysis, 0);
        if (typeof v === "object" && v.beat != null) return RF.Audio.resolveTime(v, analysis, 0);
        return v;
      };
      this.acts.forEach((a) => {
        (a.tracks || []).forEach((c) => {
          // 首次调用记录原始值
          if (c._atRaw === undefined) c._atRaw = c.at;
          c.at = resolve(c._atRaw);
        });
        ["transitionIn", "transitionOut"].forEach((k) => {
          if (a[k]) {
            if (a[k]._atRaw === undefined) a[k]._atRaw = a[k].at;
            if (a[k]._atRaw != null) a[k].at = resolve(a[k]._atRaw);
          }
        });
      });
    }

    // 外部调用：音频就绪后重新应用 beat
    reapplyBeats() {
      this._resolveBeats();
      this._keyframes = new Map();
      this._currentT = 0;
      this.renderAt(0, 0, true);
    }

    // 检测参数里是否含表达式
    _hasExpr(params) {
      if (!params) return false;
      const walk = (v) => {
        if (typeof v === "string") return RF.Expression && RF.Expression.isExpr(v);
        if (Array.isArray(v)) return v.some(walk);
        if (v && typeof v === "object") return Object.keys(v).some((k) => walk(v[k]));
        return false;
      };
      return walk(params);
    }

    // 构建表达式作用域
    _buildScope(globalT, actLocal, act, p, easedP, W, H) {
      const clips = {};
      // 收集本幕所有 clip 的进度
      const ai = this.acts.indexOf(act);
      const states = this._actStates.get(ai);
      if (states) {
        states.forEach((st, ci) => {
          const cp = localProgress(st.clip, actLocal);
          const ce = cp != null ? RF.Easing.resolve(st.clip.ease)(cp) : 0;
          clips[act.id] = clips[act.id] || {};
          clips[act.id][ci] = {
            p: cp != null ? cp : 0,
            ease: ce,
            at: st.clip.at || 0,
            dur: st.clip.dur != null ? st.clip.dur : act.dur,
          };
        });
      }
      // 音频数据（按当前 t 从分析结果插值）——无音频时给零值对象，避免表达式 audio.bass 报错
      let audioScope = {
        rms: 0, flux: 0, beat: 0, tempo: 120, duration: 0,
        bass: 0, mid: 0, treble: 0, energy: 0, inVocal: 0,
        inSection: function () { return 0; },
      };
      const analysis = RF.Audio && RF.Audio.current;
      if (analysis && this.storyboard && this.storyboard.audio) {
        const hop = analysis.hopDuration || (1 / 60);
        const idx = Math.max(0, Math.min(analysis.rms.length - 1, Math.round(globalT / hop)));
        const rms = analysis.rms[idx] != null ? analysis.rms[idx] : 0;
        const flux = analysis.flux[idx] != null ? analysis.flux[idx] : 0;
        // 是否落在 beat 附近（0.1s 内）
        let onBeat = 0;
        if (analysis.beats) {
          for (let i = 0; i < analysis.beats.length; i++) {
            if (Math.abs(analysis.beats[i] - globalT) < 0.1) { onBeat = 1; break; }
            if (analysis.beats[i] > globalT) break;
          }
        }
        audioScope = {
          rms: rms,
          bass: RF.Audio.sampleAt(analysis, analysis.bands && analysis.bands.bass, globalT),
          mid: RF.Audio.sampleAt(analysis, analysis.bands && analysis.bands.mid, globalT),
          treble: RF.Audio.sampleAt(analysis, analysis.bands && analysis.bands.treble, globalT),
          energy: RF.Audio.sampleAt(analysis, analysis.energy, globalT),
          inVocal: (function () { if (!analysis.vocal || !analysis.vocal.active) return 0; var h = analysis.vocal.hopDuration || 0.0167; var vi = Math.max(0, Math.min(analysis.vocal.active.length - 1, Math.round(globalT / h))); return analysis.vocal.active[vi] ? 1 : 0; })(),
          inSection: function (type) { return RF.Audio.inSection(analysis, globalT, type); },
          flux: flux,
          beat: onBeat,
          tempo: analysis.tempo || 120,
          duration: analysis.duration || 0,
        };
      }

      return {
        t: globalT,
        local: actLocal,
        p: p,
        ease: easedP,
        W: W,
        H: H,
        PI: Math.PI,
        TAU: Math.PI * 2,
        clips: clips,
        audio: audioScope,
      };
    }

    _resolveParams(clip, palette) {
      const raw = clip.params || {};
      const walk = (v) => {
        if (typeof v === "string") {
          // 颜色占位符
          if (/^\$\d+$/.test(v)) return RF.colorAt(palette, parseInt(v.slice(1), 10));
          if (v === "$accent") return palette.accent;
          if (v === "$fg") return palette.fg;
          if (v === "$bg") return palette.bg;
          // 单位后缀：像素 → 相对短边的比例（如 "50px" → 50/min(W,H)）
          const pxMatch = v.match(/^(-?[\d.]+)px$/);
          if (pxMatch) {
            const px = parseFloat(pxMatch[1]);
            const ref = Math.min(this.canvas.width, this.canvas.height);
            return px / ref;
          }
          // 百分比 → 比例（如 "50%" → 0.5）
          const pctMatch = v.match(/^(-?[\d.]+)%$/);
          if (pctMatch) return parseFloat(pctMatch[1]) / 100;
          return v;
        }
        if (Array.isArray(v)) return v.map(walk);
        if (v && typeof v === "object") {
          const o = {};
          for (const k in v) o[k] = walk(v[k]);
          return o;
        }
        return v;
      };
      return walk(raw);
    }

    // —— 单个 act 渲染到指定 ctx ——
    _renderActTo(ctx, W, H, pal, act, local, clipStates, globalT, dt) {
      // —— 应用 camera 变换（推拉摇移）——
      const cam = act.camera;
      // 背景可锁定（不受 camera 影响）——默认锁定
      const lockBg = !cam || cam.lockBackground !== false;
      if (lockBg) {
        // 先画背景（不变换）
        ctx.save();
        this._drawBackground(ctx, W, H, pal, act.background);
        ctx.restore();
      }
      ctx.save();
      if (cam) {
        const progress = RF.clamp01(local / (act.dur || 1));
        const ease = RF.Easing.resolve(cam.ease || "inOutCubic");
        const t = ease(progress);
        // 缩放
        const z0 = cam.zoomFrom != null ? cam.zoomFrom : 1;
        const z1 = cam.zoomTo != null ? cam.zoomTo : 1;
        const zoom = z0 + (z1 - z0) * t;
        // 平移（相对画布）
        const px0 = cam.xFrom != null ? cam.xFrom : 0.5;
        const px1 = cam.xTo != null ? cam.xTo : (cam.xFrom != null ? cam.xFrom : 0.5);
        const py0 = cam.yFrom != null ? cam.yFrom : 0.5;
        const py1 = cam.yTo != null ? cam.yTo : (cam.yFrom != null ? cam.yFrom : 0.5);
        const px = (px0 + (px1 - px0) * t) * W;
        const py = (py0 + (py1 - py0) * t) * H;
        // 旋转
        const r0 = cam.rotateFrom != null ? cam.rotateFrom : 0;
        const r1 = cam.rotateTo != null ? cam.rotateTo : r0;
        const rot = (r0 + (r1 - r0) * t);
        // 应用到画布
        ctx.translate(W / 2, H / 2);
        ctx.rotate(rot);
        ctx.scale(zoom, zoom);
        ctx.translate(-px, -py);
      }

      // 背景（若未锁定，跟随 camera 变换）
      if (!lockBg) {
        ctx.save();
        this._drawBackground(ctx, W, H, pal, act.background);
        ctx.restore();
      }

      if (!clipStates) return;
      for (let ci = 0; ci < clipStates.size + 10; ci++) {
        const st = clipStates.get(ci);
        if (!st) continue;
        this._renderClipState(ctx, st, act, local, globalT, dt, W, H, pal);
      }
      ctx.restore();
    }

    _resolveTransform(st, local, act, W, H, localP, easedP) {
      const tr = st.clip.transform || null;
      const mo = st.clip.motion || null;
      let out = null;
      if (tr) {
        out = { x: tr.x != null ? tr.x : 0.5, y: tr.y != null ? tr.y : 0.5,
          scale: tr.scale != null ? tr.scale : 1, rotate: tr.rotate || 0,
          opacity: tr.opacity != null ? tr.opacity : 1 };
      }
      if (mo && RF.Motion) {
        const m = RF.Motion.evaluate(mo, localP, W, H);
        if (m) {
          if (!out) out = { x: 0.5, y: 0.5, scale: 1, rotate: 0, opacity: 1 };
          if (m.x != null) out.x = m.x;
          if (m.y != null) out.y = m.y;
          if (m.scale != null) out.scale = m.scale;
          if (m.opacity != null) out.opacity = m.opacity;
          if (m.tangent != null) out.rotate = m.tangent;
          else if (m.rotate != null) out.rotate = m.rotate;
        }
      }
      return out;
    }

    _renderClipState(ctx, st, act, local, globalT, dt, W, H, pal) {
      const p = localProgress(st.clip, local);
      if (p == null) return;

      if (st.isGroup) {
        const ease = RF.Easing.resolve(st.clip.ease);
        const easedP = ease(p);
        ctx.save();
        ctx.globalCompositeOperation = st.clip.blend || "source-over";
        ctx.globalAlpha = st.clip.opacity != null ? st.clip.opacity : 1;
        const tr = this._resolveTransform(st, local, act, W, H, p, easedP);
        if (tr) {
          ctx.translate(tr.x * W, tr.y * H);
          ctx.rotate(tr.rotate || 0);
          const sc = tr.scale != null ? tr.scale : 1;
          ctx.scale(sc, sc);
          ctx.translate(-W / 2, -H / 2);
          ctx.globalAlpha *= (tr.opacity != null ? tr.opacity : 1);
        }
        (st.children || []).forEach((child) => {
          this._renderClipState(ctx, child, act, local, globalT, dt, W, H, pal);
        });
        ctx.restore();
        return;
      }

      const def = RF.effects[st.clip.effect];
      if (!def) return;

      ctx.save();
      ctx.globalCompositeOperation = st.clip.blend || "source-over";
      ctx.globalAlpha = st.clip.opacity != null ? st.clip.opacity : 1;
      const ease = RF.Easing.resolve(st.clip.ease);
      const easedP = ease(p);

      const tr = this._resolveTransform(st, local, act, W, H, p, easedP);
      if (tr) {
        ctx.translate(tr.x * W, tr.y * H);
        ctx.rotate(tr.rotate || 0);
        const sc = tr.scale != null ? tr.scale : 1;
        ctx.scale(sc, sc);
        ctx.translate(-W / 2, -H / 2);
        ctx.globalAlpha *= (tr.opacity != null ? tr.opacity : 1);
      }

      const scope = this._buildScope(globalT, local, act, p, easedP, W, H);
      let clipParams = st.params;
      if (st.hasExpr && RF.Expression) {
        const errBefore = RF.Expression.getErrors().length;
        clipParams = RF.Expression.resolveParams(st.params, scope);
        const errAfter = RF.Expression.getErrors().length;
        if (errAfter > errBefore) {
          const newErrs = RF.Expression.getErrors().slice(errBefore);
          newErrs.forEach((m) => this.errors.push("expr[" + st.clip.effect + "]: " + m));
        }
      }
      const f = {
        t: globalT, dt: dt, p, easedP,
        at: st.clip.at || 0,
        dur: st.clip.dur != null ? st.clip.dur : act.dur,
        local: local - (st.clip.at || 0),
        actLocal: local,
        W, H, palette: pal, rng: this.rng, Color: RF.Color,
        state: st.internal, scope: scope,
      };
      try {
        if (def.stateful && def.paint) {
          def.paint(ctx, st.internal, f, clipParams);
        } else if (def.draw) {
          def.draw(ctx, f, clipParams);
        }
      } catch (e) {
        this.errors.push("draw " + st.clip.effect + ": " + e.message);
        if (this.errors.length < 20) console.error("[RF]", e);
      }
      ctx.restore();
    }

    // —— 只更新状态型效果的物理（不绘制）——
    _tickStateful(globalT, dt) {
      const W = this.canvas.width, H = this.canvas.height;
      const pal = this.palette;
      this.acts.forEach((act, ai) => {
        // 只在 act 时间范围内 tick
        if (globalT < act.start || globalT > act.start + act.dur) return;
        const local = globalT - act.start;
        const clipStates = this._actStates.get(ai);
        if (!clipStates) return;
        for (let ci = 0; ci < clipStates.size + 10; ci++) {
          const st = clipStates.get(ci);
          if (!st || st.isGroup) continue;
          const def = RF.effects[st.clip.effect];
          if (!def || !def.stateful || !def.tick) continue;
          const p = localProgress(st.clip, local);
          if (p == null) continue;
          const f = {
            t: globalT, dt,
            p, easedP: p,
            at: st.clip.at || 0,
            dur: st.clip.dur != null ? st.clip.dur : act.dur,
            local: local - (st.clip.at || 0),
            actLocal: local,
            W, H, palette: pal, rng: this.rng, Color: RF.Color,
            state: st.internal,
          };
          try {
            def.tick(st.internal, f, st.params);
          } catch (e) {
            this.errors.push("tick " + st.clip.effect + ": " + e.message);
          }
        }
      });
    }

    _resetStateful() {
      const W = this.canvas.width, H = this.canvas.height;
      this.acts.forEach((act, ai) => {
        const clipStates = this._actStates.get(ai);
        if (!clipStates) return;
        clipStates.forEach((st) => {
          const def = RF.effects[st.clip.effect];
          if (def && def.stateful && def.init) {
            const clipRng = this.rng.fork(act.id + ":" + st.clip.effect + ":" + st.index);
            st.internal = def.init(this.ctx, st.params, {
              rng: clipRng, palette: this.palette,
              width: W, height: H, Color: RF.Color,
            });
          }
        });
      });
    }

    // —— 渲染指定时刻（核心）——
    // 参数 paint：是否真的绘制（seek 重放时先不画）
    renderAt(t, dt, paint) {
      if (dt == null) dt = (this._currentT != null) ? (t - this._currentT) : 0;
      if (paint == null) paint = true;

      // 1. 更新状态型效果的物理
      this._tickStateful(t, dt);

      if (!paint) { this._currentT = t; return; }

      const ctx = this.ctx;
      const W = this.canvas.width;
      const H = this.canvas.height;
      const pal = this.palette;

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      // 2. 找活跃 act（转场期间可能两个）
      const active = RF.Scene.activeActs(this.acts, t);

      if (active.length === 1) {
        // 单 act：直接画主画布
        const a = active[0];
        const ai = this.acts.indexOf(a.act);
        const clipStates = this._actStates.get(ai);
        const prog = RF.Transitions.computeProgress(a.act, a.local);

        if (prog.in || prog.out) {
          // 有转场：画到 offscreen，套遮罩后贴回
          const buf = this._actBufs.get(ai);
          buf.ctx.clearRect(0, 0, W, H);
          this._renderActTo(buf.ctx, W, H, pal, a.act, a.local, clipStates, t, dt);
          ctx.drawImage(buf.canvas, 0, 0);
          if (prog.in) {
            RF.Transitions.apply(ctx, W, H, prog.in.params.type || "fade",
              prog.in.progress, prog.in.params, pal);
          }
          if (prog.out) {
            RF.Transitions.apply(ctx, W, H, prog.out.params.type || "fade",
              prog.out.progress, prog.out.params, pal);
          }
        } else {
          this._renderActTo(ctx, W, H, pal, a.act, a.local, clipStates, t, dt);
        }
      } else if (active.length >= 2) {
        // 多 act 叠加：按时间顺序累进合成（支持 3+ 幕重叠）
        // 先按 start 排序
        active.sort((x, y) => x.act.start - y.act.start);

        // 渲染所有活跃 act 到各自的缓冲
        active.forEach((a) => {
          const ai = this.acts.indexOf(a.act);
          const buf = this._actBufs.get(ai);
          if (!buf) return;
          buf.ctx.clearRect(0, 0, W, H);
          this._renderActTo(buf.ctx, W, H, pal, a.act, a.local, this._actStates.get(ai), t, dt);
        });

        // 累进合成：从最旧的 act 开始，用下一个的进入转场合成
        const buf0 = this._actBufs.get(this.acts.indexOf(active[0].act));
        ctx.drawImage(buf0.canvas, 0, 0);
        let accum = buf0.canvas;

        for (let i = 1; i < active.length; i++) {
          const cur = active[i];
          const ai = this.acts.indexOf(cur.act);
          const nextBuf = this._actBufs.get(ai);
          if (!nextBuf) continue;

          // 用累进结果作为 A，新 act 作为 B，做一次 compose
          // 需要一个临时画布放 accum
          const tmp = this._getPostBuf(100 + i, W, H);
          tmp.ctx.clearRect(0, 0, W, H);
          tmp.ctx.drawImage(accum, 0, 0);

          const progIn = RF.Transitions.computeProgress(cur.act, cur.local);
          if (progIn.in) {
            ctx.clearRect(0, 0, W, H);
            RF.Transitions.compose(ctx, W, H, tmp.canvas, nextBuf.canvas,
              progIn.in.params.type || "fade", progIn.in.progress, progIn.in.params, pal);
            // 把结果存回临时画布供下一轮
            tmp.ctx.clearRect(0, 0, W, H);
            tmp.ctx.drawImage(this.canvas, 0, 0);
            accum = tmp.canvas;
          } else {
            ctx.drawImage(nextBuf.canvas, 0, 0);
            accum = nextBuf.canvas;
          }
        }
      } else {
        // 边界：超出最后时刻，画最后一帧
        const last = this.acts[this.acts.length - 1];
        if (last) {
          const ai = this.acts.length - 1;
          this._renderActTo(ctx, W, H, pal, last, last.dur,
            this._actStates.get(ai), t, dt);
        }
      }

      // 3. 后处理
      const post = this.storyboard.post;
      if (Array.isArray(post) && post.length) {
        this._runPost(post, W, H, t);
      }

      this._currentT = t;
    }

    _drawBackground(ctx, W, H, pal, bgDef) {
      const bg = bgDef || { type: "solid" };
      const rc = (v, fallback) => {
        if (v == null) return fallback;
        if (typeof v === "string") {
          if (/^\$\d+$/.test(v)) return RF.colorAt(pal, parseInt(v.slice(1), 10));
          if (v === "$accent") return pal.accent;
          if (v === "$fg") return pal.fg;
          if (v === "$bg") return pal.bg;
        }
        return v;
      };

      if (bg.type === "solid" || !bg.type) {
        ctx.fillStyle = rc(bg.color, pal.bg);
        ctx.fillRect(0, 0, W, H);
      } else if (bg.type === "gradient") {
        const stops = bg.stops || [
          { at: 0, color: pal.bg },
          { at: 1, color: RF.Color.shift(pal.bg, 0.15) },
        ];
        const angle = (bg.angle != null ? bg.angle : 135) * Math.PI / 180;
        const cx = W / 2, cy = H / 2;
        const len = Math.abs(W * Math.cos(angle)) + Math.abs(H * Math.sin(angle));
        const x0 = cx - Math.cos(angle) * len / 2;
        const y0 = cy - Math.sin(angle) * len / 2;
        const x1 = cx + Math.cos(angle) * len / 2;
        const y1 = cy + Math.sin(angle) * len / 2;
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        stops.forEach((s) => g.addColorStop(s.at, rc(s.color, pal.bg)));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      } else if (bg.type === "radial") {
        const cx = (bg.cx != null ? bg.cx : 0.5) * W;
        const cy = (bg.cy != null ? bg.cy : 0.5) * H;
        const r = (bg.radius != null ? bg.radius : 0.7) * Math.max(W, H);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, rc(bg.inner, RF.Color.shift(pal.bg, 0.25)));
        g.addColorStop(1, rc(bg.outer, pal.bg));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // 获取后处理缓冲（ping-pong 池，避免每帧新建 canvas）
    _getPostBuf(i, W, H) {
      if (!this._postPool) this._postPool = [];
      let buf = this._postPool[i];
      if (!buf || buf.canvas.width !== W || buf.canvas.height !== H) {
        const c = document.createElement("canvas");
        c.width = W; c.height = H;
        buf = { canvas: c, ctx: c.getContext("2d") };
        this._postPool[i] = buf;
      }
      return buf;
    }

    _runPost(post, W, H, t) {
      const src = this.canvas;
      // 缓冲 0 用于拷贝原图
      const buf0 = this._getPostBuf(0, W, H);
      buf0.ctx.clearRect(0, 0, W, H);
      buf0.ctx.drawImage(src, 0, 0);

      const ctx = this.ctx;
      let current = buf0.canvas;
      for (let si = 0; si < post.length; si++) {
        const step = post[si];
        const def = RF.postfx[step.effect];
        if (!def) continue;

        // bloom 优先走 WebGL（若可用且未禁用）
        if (step.effect === "bloom" && RF.WebGLPostFX && !this.opts.disableWebGL) {
          if (this._webglBloom === undefined) {
            this._webglBloom = RF.WebGLPostFX.available()
              ? RF.WebGLPostFX.createBloom(W, H)
              : null;
          }
          if (this._webglBloom) {
            try {
              const outCanvas = this._webglBloom.apply(
                current,
                step.amount != null ? step.amount : 1,
                step.threshold != null ? step.threshold : 0.6,
                step.radius != null ? step.radius : 24
              );
              current = outCanvas;
              continue;
            } catch (e) {
              this.errors.push("webgl bloom: " + e.message);
              // 失败则回落 CPU 实现
            }
          }
        }
        const buf = this._getPostBuf(si + 1, W, H);
        buf.ctx.clearRect(0, 0, W, H);
        try {
          def.apply(current, buf.ctx, step.amount != null ? step.amount : 1, ctx, {
            t, W, H, palette: this.palette, Color: RF.Color, params: step,
          });
        } catch (e) {
          this.errors.push("postfx " + step.effect + ": " + e.message);
        }
        current = buf.canvas;
      }
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(current, 0, 0);
      ctx.restore();
    }

    // —— 关键帧快照（可选加速）——
    // 效果若声明 snapshot(state)/restore(state, snap)，可在关键帧缓存其状态
    _makeSnapshot() {
      const snaps = new Map();
      this.acts.forEach((act, ai) => {
        const clipStates = this._actStates.get(ai);
        if (!clipStates) return;
        clipStates.forEach((st, ci) => {
          const def = RF.effects[st.clip.effect];
          if (def && def.snapshot && st.internal) {
            try { snaps.set(ai + ":" + ci, def.snapshot(st.internal)); }
            catch (e) { /* 快照失败则跳过 */ }
          }
        });
      });
      return snaps;
    }

    _restoreSnapshot(snaps) {
      this.acts.forEach((act, ai) => {
        const clipStates = this._actStates.get(ai);
        if (!clipStates) return;
        clipStates.forEach((st, ci) => {
          const def = RF.effects[st.clip.effect];
          const snap = snaps.get(ai + ":" + ci);
          if (def && def.restore && snap && st.internal) {
            try { def.restore(st.internal, snap); }
            catch (e) { /* 恢复失败则忽略 */ }
          }
        });
      });
    }

    // —— seek：确定性重放（带关键帧加速）——
    seek(targetT) {
      targetT = Math.max(0, Math.min(this.duration, targetT));
      const bigJump = targetT < this._currentT - 0.001 || targetT - this._currentT > 0.5;
      if (!bigJump) {
        this.renderAt(targetT, targetT - this._currentT, true);
        return;
      }

      // 尝试用快照加速：找 <= targetT 的最近关键帧
      const KF_INTERVAL = this.opts.keyframeInterval != null ? this.opts.keyframeInterval : 1.0; // 秒
      if (!this._keyframes) this._keyframes = new Map(); // time → snapshot
      let startT = 0;
      if (KF_INTERVAL > 0) {
        const kfTime = Math.floor(targetT / KF_INTERVAL) * KF_INTERVAL;
        if (kfTime > 0 && this._keyframes.has(kfTime)) {
          this._resetStateful();
          this._restoreSnapshot(this._keyframes.get(kfTime));
          startT = kfTime;
        } else {
          this._resetStateful();
          startT = 0;
        }
      } else {
        this._resetStateful();
        startT = 0;
      }

      this._currentT = startT;
      // 固定步长（确定性核心：tick 物理对 dt 非线性，必须恒定）
      const step = FIXED_DT;
      for (let t = startT + step; t < targetT; t += step) {
        this.renderAt(t, step, false);
        // 沿途存关键帧
        if (KF_INTERVAL > 0) {
          const kf = Math.floor(t / KF_INTERVAL) * KF_INTERVAL;
          if (kf > 0 && !this._keyframes.has(kf) && Math.abs(kf - t) < step) {
            this._keyframes.set(kf, this._makeSnapshot());
          }
        }
      }
      this._currentT = targetT;
      this.renderAt(targetT, targetT - this._currentT, true);
      if (!this.playing) this._syncAudio(targetT, false);
    }

    // 预生成关键帧（可选，首次 seek 前调用可避免"第一次卡"）
    prewarmKeyframes(interval) {
      const iv = interval != null ? interval : (this.opts.keyframeInterval != null ? this.opts.keyframeInterval : 1.0);
      if (iv <= 0 || !this._keyframes) return;
      const saved = this._currentT;
      this._resetStateful();
      this._currentT = 0;
      this._keyframes.clear();
      this._keyframes.set(0, this._makeSnapshot());
      for (let t = iv; t < this.duration; t += iv) {
        // 从上一关键帧推进到 t
        const step = FIXED_DT;
        while (this._currentT < t) {
          this._currentT += step;
          this.renderAt(this._currentT, step, false);
        }
        this._keyframes.set(Math.round(t / iv) * iv, this._makeSnapshot());
      }
      this._currentT = saved;
    }

    // 清空关键帧缓存（load 新 storyboard 时调用）
    clearKeyframes() {
      this._keyframes = new Map();
    }

    // 绑定音频元素（可选，用于预览时同步播放）
    attachAudio(audioEl) {
      this._audioEl = audioEl;
    }

    _syncAudio(t, playing) {
      const a = this._audioEl;
      if (!a) return;
      if (Math.abs(a.currentTime - t) > 0.15) {
        try { a.currentTime = Math.max(0, Math.min(a.duration || 1e9, t)); } catch (e) {}
      }
      if (playing && a.paused) { a.play().catch(() => {}); }
      if (!playing && !a.paused) { a.pause(); }
    }

    // —— 播放：固定 dt 累积器 ——
    play(fromT) {
      if (this.playing) return;
      if (fromT != null && Math.abs(fromT - this._currentT) > 0.01) {
        this.seek(fromT);
      }
      this._syncAudio(this._currentT, true);
      this.playing = true;
      this._lastWall = performance.now();
      this._acc = 0;

      const loop = () => {
        if (!this.playing) return;
        const now = performance.now();
        let delta = (now - this._lastWall) / 1000;
        this._lastWall = now;
        if (delta > 0.25) delta = 0.25;
        this._acc += delta;

        let steps = 0;
        while (this._acc >= FIXED_DT && steps < 4) {
          let nt = this._currentT + FIXED_DT;
          if (nt >= this.duration) {
            nt = this.duration;
            this.renderAt(nt, FIXED_DT, true);
            this.playing = false;
            if (this.opts.onEnd) this.opts.onEnd();
            if (this.opts.loop) {
              this._currentT = 0;
              this._resetStateful();
              this._lastWall = performance.now();
              this._acc = 0;
              this.playing = true;
              this._raf = requestAnimationFrame(loop);
            }
            return;
          }
          this.renderAt(nt, FIXED_DT, true);
          this._acc -= FIXED_DT;
          steps++;
        }
        if (this.opts.onTime) this.opts.onTime(this._currentT);
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    }

    pause() {
      this.playing = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
      this._syncAudio(this._currentT, false);
    }
  }


  // —— 自省：导出所有效果/后处理/转场的元信息 ——
  RF.introspect = function () {
    const effects = {};
    Object.keys(RF.effects).forEach((name) => {
      if (name === "register") return;
      const def = RF.effects[name];
      effects[name] = { stateful: !!def.stateful, meta: def.meta || null };
    });
    const postfx = {};
    Object.keys(RF.postfx).forEach((name) => {
      if (name === "register") return;
      const def = RF.postfx[name];
      postfx[name] = { meta: def.meta || null };
    });
    const transitions = RF.Transitions ? RF.Transitions.list() : [];
    return { effects, postfx, transitions, palettes: Object.keys(RF.PALETTES) };
  };

  RF.Runtime = Runtime;
  RF.clamp01 = clamp01;
  RF.FIXED_DT = FIXED_DT;
})(window.RF = window.RF || {});

