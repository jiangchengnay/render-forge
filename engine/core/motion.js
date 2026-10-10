// engine/core/motion.js
// 关键帧运动系统：多关键帧、曲线插值、朝向跟随。
// 全部为纯函数——相同 t 得到相同结果（确定性）。
(function (RF) {
  // —— Catmull-Rom 插值（过控制点）——
  function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }

  // 计算标量序列在参数 u∈[0,1] 上的值（多关键帧）
  function sampleKeys(keys, field, u, mode, easeFn) {
    const n = keys.length;
    if (n === 0) return 0;
    if (n === 1) return keys[0][field] != null ? keys[0][field] : 0;
    // 找到 u 落在哪一段
    const totalT = keys[n - 1].t - keys[0].t;
    const tt = keys[0].t + u * totalT;
    let i = 0;
    while (i < n - 2 && keys[i + 1].t <= tt) i++;
    const k0 = keys[Math.max(0, i - 1)];
    const k1 = keys[i];
    const k2 = keys[i + 1];
    const k3 = keys[Math.min(n - 1, i + 2)];
    const segT = (k2.t - k1.t);
    let local = segT > 0 ? (tt - k1.t) / segT : 0;
    local = Math.max(0, Math.min(1, local));
    // 每段可单独 ease
    if (easeFn) local = easeFn(local);
    const v1 = k1[field] != null ? k1[field] : 0;
    const v2 = k2[field] != null ? k2[field] : 0;
    if (mode === "linear") return v1 + (v2 - v1) * local;
    const v0 = k0[field] != null ? k0[field] : v1;
    const v3 = k3[field] != null ? k3[field] : v2;
    return catmullRom(v0, v1, v2, v3, local);
  }

  // 计算运动在进度 p（0..1）时的状态
  // motion: { keys:[{t,x,y,scale?,rotate?,opacity?}], path, ease, easePerSeg, rotateFollow, loop, loopCount }
  // 返回 { x, y, scale, rotate, opacity, tangent }
  function evaluate(motion, p, W, H) {
    if (!motion || !motion.keys || motion.keys.length === 0) return null;
    const keys = motion.keys;
    const mode = motion.path || "catmullRom";
    let u = p;
    // loop
    if (motion.loop) {
      const lc = motion.loopCount || 1;
      u = (p * lc) % 1;
    }
    u = Math.max(0, Math.min(1, u));

    // ease：整体或每段
    let easeFn = null;
    if (motion.ease) {
      const e = RF.Easing.resolve(motion.ease);
      easeFn = (x) => e(x);
    } else if (motion.easePerSeg) {
      // 每段不同：sampleKeys 里按段取太复杂，简化为整体
      const arr = motion.easePerSeg;
      easeFn = (x) => {
        const seg = Math.min(arr.length - 1, Math.floor(u * arr.length));
        return RF.Easing.resolve(arr[seg])(x);
      };
    }

    const x = sampleKeys(keys, "x", u, mode, easeFn);
    const y = sampleKeys(keys, "y", u, mode, easeFn);

    // scale / rotate / opacity：若 keys 里没给则返回 null（不覆盖）
    const hasScale = keys.some((k) => k.scale != null);
    const hasRotate = keys.some((k) => k.rotate != null);
    const hasOpacity = keys.some((k) => k.opacity != null);
    const scale = hasScale ? sampleKeys(keys, "scale", u, mode, easeFn) : null;
    const rotate = hasRotate ? sampleKeys(keys, "rotate", u, mode, easeFn) : null;
    const opacity = hasOpacity ? sampleKeys(keys, "opacity", u, mode, easeFn) : null;

    // 朝向跟随：用相邻采样求切线
    let tangent = null;
    if (motion.rotateFollow) {
      const eps = 1e-3;
      const u2 = Math.min(1, u + eps);
      const u1 = Math.max(0, u - eps);
      const x2 = sampleKeys(keys, "x", u2, mode, easeFn);
      const y2 = sampleKeys(keys, "y", u2, mode, easeFn);
      const x1 = sampleKeys(keys, "x", u1, mode, easeFn);
      const y1 = sampleKeys(keys, "y", u1, mode, easeFn);
      const dx = (x2 - x1) * W;
      const dy = (y2 - y1) * H;
      tangent = Math.atan2(dy, dx);
    }

    return {
      x: x, y: y,
      scale: scale, rotate: rotate, opacity: opacity,
      tangent: tangent,
    };
  }

  RF.Motion = { evaluate, sampleKeys, catmullRom };
})(window.RF = window.RF || {});
