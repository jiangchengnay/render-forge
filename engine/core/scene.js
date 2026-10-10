// engine/core/scene.js
// 场景系统：把 storyboard 从"图层叠加"升级为"分幕编排"。
//
// 关键设计：相邻 act 之间按转场时长「重叠」，这样 runtime 能在重叠区间
// 同时渲染两幕做真交叉淡化（而不是盖黑场遮罩）。

(function (RF) {

  // 计算某个 act 的出/入场时长
  function outDur(a) { return a.transitionOut ? (a.transitionOut.dur != null ? a.transitionOut.dur : 0.4) : 0; }
  function inDur(a) { return a.transitionIn ? (a.transitionIn.dur != null ? a.transitionIn.dur : 0.4) : 0; }

  function normalize(sb) {
    if (!sb || typeof sb !== "object") return [];

    // groups 支持：sb.groups 是 { groupName: { transform, clips } } 结构
    // 展平进 acts：把每个 group 的 clips 分配到所属 act
    if (sb.groups && typeof sb.groups === "object" && !Array.isArray(sb.acts)) {
      // 无 acts 时，groups 的 clips 合并到单一 act
      const allTracks = [];
      Object.keys(sb.groups).forEach((gname) => {
        const g = sb.groups[gname];
        (g.clips || []).forEach((c) => {
          c.group = gname;
          if (g.transform) c.groupTransform = g.transform;
          allTracks.push(c);
        });
      });
      if (allTracks.length) sb = Object.assign({}, sb, { tracks: allTracks });
    } else if (sb.groups && Array.isArray(sb.acts)) {
      // 有 acts 时，把 group 的 clips 追加到匹配的 act
      sb.acts.forEach((a) => {
        Object.keys(sb.groups).forEach((gname) => {
          const g = sb.groups[gname];
          if (g.act && g.act !== a.id) return;
          (g.clips || []).forEach((c) => {
            c.group = gname;
            if (g.transform) c.groupTransform = g.transform;
            a.tracks = a.tracks || [];
            a.tracks.push(c);
          });
        });
      });
    }

    if (Array.isArray(sb.acts) && sb.acts.length) {
      // 先算每幕的 start（用原始 start 或按顺序排布 + 重叠）
      const raw = sb.acts.map((a, i) => ({
        id: a.id || ("act" + i),
        explicitStart: a.start != null,
        start: a.start != null ? a.start : null,
        dur: a.dur != null ? a.dur : 3,
        background: a.background || sb.background || { type: "solid", color: "$bg" },
        tracks: a.tracks || [],
        transitionIn: a.transitionIn || null,
        transitionOut: a.transitionOut || null,
        camera: a.camera || null,
      }));

      // 顺序排布：第 i 幕的 start = 上一幕 start + 上一幕 dur - 重叠
      let cursor = 0;
      for (let i = 0; i < raw.length; i++) {
        const a = raw[i];
        if (a.explicitStart) {
          cursor = a.start;
        } else {
          a.start = cursor;
        }
        // 下一幕的开始 = 本幕结束 - 本幕出场时长（若有）或下一幕入场时长的较大者
        const next = raw[i + 1];
        let overlap = 0;
        if (next) {
          overlap = Math.max(outDur(a), inDur(next));
        }
        cursor = a.start + a.dur - overlap;
      }
      return raw;
    }

    // 旧格式：整体当一幕
    if (Array.isArray(sb.tracks)) {
      const meta = sb.meta || {};
      return [{
        id: "main",
        start: 0,
        dur: meta.duration || 6,
        background: sb.background || { type: "solid", color: "$bg" },
        tracks: sb.tracks,
        transitionIn: null,
        transitionOut: null,
        camera: null,
      }];
    }
    return [];
  }

  function totalDuration(acts) {
    if (!acts.length) return 0;
    let max = 0;
    acts.forEach((a) => { const end = a.start + a.dur; if (end > max) max = end; });
    return max;
  }

  // 给定时刻 t，返回所有活跃的 act（重叠区间会返回 2 个）
  function activeActs(acts, t) {
    const out = [];
    for (let i = 0; i < acts.length; i++) {
      const a = acts[i];
      if (t >= a.start && t < a.start + a.dur) {
        out.push({ act: a, local: t - a.start, index: i });
      }
    }
    // 边界：超出最后时刻
    if (!out.length && acts.length) {
      const last = acts[acts.length - 1];
      if (t >= last.start + last.dur) {
        out.push({ act: last, local: last.dur, index: acts.length - 1 });
      }
    }
    // 重叠时按 index 排序（旧的在前）
    out.sort((x, y) => x.index - y.index);
    return out;
  }

  RF.Scene = { normalize, totalDuration, activeActs, outDur, inDur };
})(window.RF = window.RF || {});
