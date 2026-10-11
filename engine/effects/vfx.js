// engine/effects/vfx.js
// 高频视频效果：震屏 / 音频波形 / 镜头光晕 / 光扫 / 文字遮罩挖空。
(function (RF) {

  // shake：整体震屏
  RF.effects.register('shake', {
    meta: { category: 'vfx', desc: '画面整体震屏/抖动，支持频率、幅度、衰减。', params: {
      amp: { type: 'number', default: 0.02, desc: '幅度（相对画布短边）' },
      freq: { type: 'number', default: 30, desc: '频率（Hz）' },
      decay: { type: 'number', default: 0, desc: '衰减 0-1' },
      rotate: { type: 'number', default: 0, desc: '旋转抖动幅度（弧度）' },
      seed: { type: 'number', default: 0 }
    }},
    draw: function (ctx, f, params, env) {
      const W = f.W, H = f.H;
      const amp = (params.amp != null ? params.amp : 0.02) * Math.min(W, H);
      const freq = params.freq != null ? params.freq : 30;
      const decay = params.decay != null ? params.decay : 0;
      const rotAmp = params.rotate != null ? params.rotate : 0;
      const seed = params.seed != null ? params.seed : 0;
      const env1 = 1 - decay * f.p;
      const phase = f.t * freq * Math.PI * 2;
      const sx = (Math.sin(phase + seed) * 0.6 + Math.sin(phase * 1.7 + 1.3) * 0.4) * amp * env1;
      const sy = (Math.cos(phase * 1.3 + seed) * 0.6 + Math.cos(phase * 2.1 + 0.7) * 0.4) * amp * env1;
      const sr = Math.sin(phase * 0.9 + 2.1) * rotAmp * env1;
      ctx.translate(sx, sy);
      if (sr) { ctx.translate(W / 2, H / 2); ctx.rotate(sr); ctx.translate(-W / 2, -H / 2); }
    }
  });

  // waveform：音频波形/频谱
  RF.effects.register('waveform', {
    meta: { category: 'vfx', desc: '音频波形/频谱条（用 RF.Audio 数据）。', params: {
      mode: { type: 'string', default: 'bars', range: ['bars','wave'] },
      dir: { type: 'string', default: 'vertical', range: ['vertical','horizontal'] },
      band: { type: 'string', default: 'full', range: ['full','bass','mid','treble'], desc: '频率段' },
      count: { type: 'number', default: 48 },
      x: { type: 'number', default: 0.5 }, y: { type: 'number', default: 0.7 },
      w: { type: 'number', default: 0.7 }, h: { type: 'number', default: 0.2 },
      color: { type: 'string', default: '$accent' },
      color2: { type: 'string', default: '$1' },
      gap: { type: 'number', default: 0.3 },
      lineWidth: { type: 'number', default: 2 },
      opacity: { type: 'number', default: 1 }
    }},
    draw: function (ctx, f, params, env) {
      const W = f.W, H = f.H;
      const analysis = RF.Audio && RF.Audio.current;
      const cx = (params.x != null ? params.x : 0.5) * W;
      const cy = (params.y != null ? params.y : 0.7) * H;
      const totalW = (params.w != null ? params.w : 0.7) * W;
      const maxH = (params.h != null ? params.h : 0.2) * H;
      const count = Math.max(1, Math.min(2000, Math.floor(params.count != null ? params.count : 48)));
      const gap = params.gap != null ? params.gap : 0.3;
      const mode = params.mode || 'bars';
      const dir = params.dir || 'vertical';
      const c1 = params.color || f.palette.accent;
      const c2 = params.color2 || f.palette.colors[1] || c1;
      ctx.save();
      ctx.globalAlpha *= (params.opacity != null ? params.opacity : 1) * f.easedP;
      const band = params.band || "full";
      const sample = function (i) {
        const u = i / count;
        if (analysis && analysis.bands) {
          const hop = analysis.hopDuration || (1 / 60);
          const fi = Math.max(0, Math.min(analysis.bands.bass.length - 1, Math.round(f.t / hop)));
          const b = analysis.bands.bass[fi] || 0, m = analysis.bands.mid[fi] || 0, t = analysis.bands.treble[fi] || 0;
          if (band === "bass") return b;
          if (band === "mid") return m;
          if (band === "treble") return t;
          if (u < 0.33) return b * (1 - u * 3) + m * (u * 3);
          if (u < 0.66) return m * (1 - (u - 0.33) * 3) + t * ((u - 0.33) * 3);
          return t;
        }
        if (analysis && analysis.rms && analysis.rms.length) {
          const hop = analysis.hopDuration || (1 / 60);
          const idx = Math.max(0, Math.min(analysis.rms.length - 1, Math.round(f.t / hop)));
          return Math.min(1, (analysis.rms[idx] || 0) * 3);
        }
        return 0.3 + 0.5 * Math.abs(Math.sin(f.t * 2 + i * 0.5));
      };
      if (mode === 'bars') {
        const barW = totalW / count * (1 - gap);
        const step = totalW / count;
        for (let i = 0; i < count; i++) {
          const v = sample(i);
          const bh = maxH * v;
          const bx = cx - totalW / 2 + i * step + (step - barW) / 2;
          ctx.fillStyle = RF.Color.mix(c2, c1, v);
          if (dir === 'vertical') ctx.fillRect(bx, cy - bh, barW, bh);
          else ctx.fillRect(cx - bh, cy - totalW / 2 + i * step + (step - barW) / 2, bh, barW);
        }
      } else {
        ctx.strokeStyle = c1;
        ctx.lineWidth = params.lineWidth != null ? params.lineWidth : 2;
        ctx.beginPath();
        for (let i = 0; i <= count; i++) {
          const v = sample(i);
          const off = (v - 0.5) * maxH;
          const px = cx - totalW / 2 + (i / count) * totalW;
          const py = cy + off;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  });

  // lensFlare：镜头光晕
  RF.effects.register('lensFlare', {
    meta: { category: 'vfx', desc: '镜头光晕：中心光源 + 光斑链 + anamorphic streak。', params: {
      x: { type: 'number', default: 0.7 }, y: { type: 'number', default: 0.3 },
      size: { type: 'number', default: 0.12 },
      color: { type: 'string', default: '#ffffff' },
      color2: { type: 'string', default: '$accent' },
      ghosts: { type: 'number', default: 5 },
      streak: { type: 'boolean', default: true },
      streakWidth: { type: 'number', default: 0.6 },
      opacity: { type: 'number', default: 0.9 }
    }},
    draw: function (ctx, f, params, env) {
      const W = f.W, H = f.H;
      const cx = (params.x != null ? params.x : 0.7) * W;
      const cy = (params.y != null ? params.y : 0.3) * H;
      const size = (params.size != null ? params.size : 0.12) * Math.min(W, H);
      const c1 = params.color || '#ffffff';
      const c2 = params.color2 || f.palette.accent;
      const alpha = (params.opacity != null ? params.opacity : 0.9) * f.easedP;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 2);
      g.addColorStop(0, RF.Color.rgba(c1, 0.9));
      g.addColorStop(0.3, RF.Color.rgba(c1, 0.4));
      g.addColorStop(1, RF.Color.rgba(c1, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx - size * 2, cy - size * 2, size * 4, size * 4);
      if (params.streak !== false) {
        const sw = (params.streakWidth != null ? params.streakWidth : 0.6) * W;
        const sg = ctx.createLinearGradient(cx - sw / 2, cy, cx + sw / 2, cy);
        sg.addColorStop(0, RF.Color.rgba(c2, 0));
        sg.addColorStop(0.5, RF.Color.rgba(c2, 0.7));
        sg.addColorStop(1, RF.Color.rgba(c2, 0));
        ctx.fillStyle = sg;
        ctx.fillRect(cx - sw / 2, cy - size * 0.08, sw, size * 0.16);
      }
      const ghosts = params.ghosts != null ? params.ghosts : 5;
      const dx = W / 2 - cx, dy = H / 2 - cy;
      for (let i = 1; i <= ghosts; i++) {
        const t = i / (ghosts + 1);
        const gx = cx + dx * t * 2;
        const gy = cy + dy * t * 2;
        const gr = size * (0.3 + t * 0.5);
        const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        const col = i % 2 === 0 ? c1 : c2;
        gg.addColorStop(0, RF.Color.rgba(col, 0.3));
        gg.addColorStop(1, RF.Color.rgba(col, 0));
        ctx.fillStyle = gg;
        ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
      }
      ctx.restore();
    }
  });

  // lightSweep：光扫
  RF.effects.register('lightSweep', {
    meta: { category: 'vfx', desc: '一条高光带扫过画面。', params: {
      angle: { type: 'number', default: 45 },
      width: { type: 'number', default: 0.1 },
      color: { type: 'string', default: '#ffffff' },
      opacity: { type: 'number', default: 0.5 },
      from: { type: 'number', default: -0.3 },
      to: { type: 'number', default: 1.3 }
    }},
    draw: function (ctx, f, params, env) {
      const W = f.W, H = f.H;
      const angle = (params.angle != null ? params.angle : 45) * Math.PI / 180;
      const diag = Math.hypot(W, H);
      const width = (params.width != null ? params.width : 0.1) * diag;
      const c1 = params.color || '#ffffff';
      const alpha = (params.opacity != null ? params.opacity : 0.5) * f.easedP;
      const from = params.from != null ? params.from : -0.3;
      const to = params.to != null ? params.to : 1.3;
      const pos = from + (to - from) * f.easedP;
      const px = pos * diag;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha;
      ctx.translate(W / 2, H / 2);
      ctx.rotate(angle);
      const g = ctx.createLinearGradient(-width, 0, width, 0);
      g.addColorStop(0, RF.Color.rgba(c1, 0));
      g.addColorStop(0.5, RF.Color.rgba(c1, 0.9));
      g.addColorStop(1, RF.Color.rgba(c1, 0));
      ctx.fillStyle = g;
      ctx.translate(px - diag / 2, 0);
      ctx.fillRect(-width, -diag, width * 2, diag * 2);
      ctx.restore();
    }
  });

  // textMask：文字遮罩挖空
  RF.effects.register('textMask', {
    meta: { category: 'vfx', desc: '用文字作为遮罩挖空（露出下层内容）。', params: {
      text: { type: 'string', default: 'MASK' },
      x: { type: 'number', default: 0.5 }, y: { type: 'number', default: 0.5 },
      size: { type: 'number', default: 0.18 },
      weight: { type: 'number', default: 800 },
      align: { type: 'string', default: 'center', range: ['left','center','right'] },
      letterSpacing: { type: 'number', default: 0 },
      mode: { type: 'string', default: 'cutout', range: ['cutout','fill'] },
      color: { type: 'string', default: '$fg' }
    }},
    draw: function (ctx, f, params, env) {
      const W = f.W, H = f.H;
      const x = (params.x != null ? params.x : 0.5) * W;
      const y = (params.y != null ? params.y : 0.5) * H;
      const size = (params.size != null ? params.size : 0.18) * W;
      const weight = params.weight != null ? params.weight : 800;
      const align = params.align || 'center';
      const text = params.text || 'MASK';
      ctx.save();
      ctx.font = weight + ' ' + size + 'px "Inter","Microsoft YaHei",sans-serif';
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      if (params.mode === 'fill') {
        ctx.globalAlpha *= f.easedP;
        ctx.fillStyle = params.color || f.palette.fg;
        ctx.fillText(text, x, y);
      } else {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = f.easedP;
        ctx.fillStyle = '#000';
        ctx.fillText(text, x, y);
      }
      ctx.restore();
    }
  });

  // spectrum：频域条（真实 FFT 分频段）
  RF.effects.register('spectrum', {
    meta: { category: 'vfx', desc: '频域频谱条（真实 FFT 分频段）。', params: {
      count: { type: 'number', default: 32 },
      x: { type: 'number', default: 0.5 }, y: { type: 'number', default: 0.75 },
      w: { type: 'number', default: 0.7 }, h: { type: 'number', default: 0.25 },
      color: { type: 'string', default: '$accent' },
      color2: { type: 'string', default: '$1' },
      gap: { type: 'number', default: 0.2 },
      opacity: { type: 'number', default: 1 },
      mirrored: { type: 'boolean', default: false }
    }},
    draw: function (ctx, f, params, env) {
      const W = f.W, H = f.H;
      const analysis = RF.Audio && RF.Audio.current;
      const cx = (params.x != null ? params.x : 0.5) * W;
      const cy = (params.y != null ? params.y : 0.75) * H;
      const totalW = (params.w != null ? params.w : 0.7) * W;
      const maxH = (params.h != null ? params.h : 0.25) * H;
      const count = Math.max(1, Math.min(2000, Math.floor(params.count != null ? params.count : 32)));
      const gap = params.gap != null ? params.gap : 0.2;
      const c1 = params.color || f.palette.accent;
      const c2 = params.color2 || f.palette.colors[1] || c1;
      ctx.save();
      ctx.globalAlpha *= (params.opacity != null ? params.opacity : 1) * f.easedP;
      const barW = totalW / count * (1 - gap);
      const step = totalW / count;
      for (let i = 0; i < count; i++) {
        const u = i / count;
        let v = 0.2 + 0.5 * Math.abs(Math.sin(f.t * 2 + i * 0.4));
        if (analysis && analysis.bands) {
          const hop = analysis.hopDuration || (1 / 60);
          const fi = Math.max(0, Math.min(analysis.bands.bass.length - 1, Math.round(f.t / hop)));
          const b = analysis.bands.bass[fi] || 0, m = analysis.bands.mid[fi] || 0, t = analysis.bands.treble[fi] || 0;
          if (u < 0.33) v = b * (1 - u * 3) + m * (u * 3);
          else if (u < 0.66) v = m * (1 - (u - 0.33) * 3) + t * ((u - 0.33) * 3);
          else v = t;
        }
        const bh = maxH * v;
        const bx = cx - totalW / 2 + i * step + (step - barW) / 2;
        ctx.fillStyle = RF.Color.mix(c2, c1, v);
        if (params.mirrored) ctx.fillRect(bx, cy - bh / 2, barW, bh);
        else ctx.fillRect(bx, cy - bh, barW, bh);
      }
      ctx.restore();
    }
  });
})(window.RF = window.RF || {});
