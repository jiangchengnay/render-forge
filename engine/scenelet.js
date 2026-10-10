// engine/scenelet.js
// 可复用 act 片段库。分镜用 { include: '名', slots: {...} } 组合。
(function (RF) {
  var LIB = {};
  function register(name, fn) { LIB[name] = fn; }
  function expand(sb) {
    if (!sb || !Array.isArray(sb.acts)) return sb;
    sb.acts = sb.acts.map(function (act) {
      if (act.include && LIB[act.include]) {
        var base = LIB[act.include](act.slots || {}, act);
        var merged = Object.assign({}, base, act);
        delete merged.include; delete merged.slots;
        return merged;
      }
      return act;
    });
    return sb;
  }
  RF.Scenelet = { register: register, expand: expand, list: function () { return Object.keys(LIB); } };
})(window.RF = window.RF || {});

(function (RF) {
  if (!RF.Scenelet) return;

  // ===== 品牌开场（丰富版）=====
  RF.Scenelet.register('brand-intro', function (s) {
    var D = s.dur || 3.5;
    return {
      dur: D,
      background: { type: 'radial', cx: 0.5, cy: 0.5, radius: 1.15, inner: s.bg || '#0a1838', outer: '#020610' },
      transitionIn: { type: 'fade', dur: 0.5 },
      camera: { zoomFrom: 1.15, zoomTo: 1.0, ease: 'outCubic' },
      tracks: [
        // 1) 渐变光斑氛围
        { effect: 'gradientBlob', at: 0, dur: D, opacity: 0.35,
          params: { count: 2, alpha: 0.35, mode: 'screen' } },
        // 2) 点阵
        { effect: 'dotGrid', at: 0, dur: D, opacity: 0.6,
          params: { spacing: 0.045, dotR: 0.0018, color: 'rgba(90,180,255,0.35)', reveal: 'radial' } },
        // 3) 脉冲波纹（开场）
        { effect: 'ripples', at: 0.1, dur: D - 0.2, opacity: 0.5, blend: 'lighter',
          params: { count: 3, maxRadius: 0.5, lineWidth: 1.2, color: '$accent', alpha: 0.6 } },
        // 4) logo 光环
        { effect: 'frameRect', at: 0.4, dur: D - 0.5, opacity: 0.4,
          params: { x: 0.36, y: 0.28, w: 0.28, h: 0.24, color: '$accent', lineWidth: 1.2, corners: true } },
        // 5) logo
        { effect: 'logoMark', at: 0.4, dur: D - 0.5, ease: 'outBack', opacity: 1,
          params: { style: s.logoStyle || 'cross', size: 0.065, x: 0.5, y: 0.4, color: '$accent' } },
        // 6) 主标题
        { effect: 'titleCard', at: 0.9, dur: D - 1.0, ease: 'outCubic', opacity: 1,
          params: { title: s.title || 'Brand', subtitle: s.subtitle || '', x: 0.5, y: 0.6,
                    titleSize: 0.075, titleWeight: 800, stagger: 0.5, divider: true,
                    subSize: 0.024, subWeight: 400 } },
        // 7) 底部装饰线
        { effect: 'divider', at: 1.6, dur: 1.2, ease: 'outCubic', opacity: 0.6,
          params: { dir: 'h', y: 0.72, x0: 0.3, x1: 0.7, lineWidth: 1.5, color: '$accent' } }
      ],
    };
  });

  // ===== 特性列表幕（丰富版）=====
  RF.Scenelet.register('feature-list', function (s) {
    var D = s.dur || 4;
    return {
      dur: D,
      background: { type: 'gradient', angle: 180,
        stops: [{ at: 0, color: '#03080f' }, { at: 1, color: '#0a1a30' }] },
      tracks: [
        // 底纹网格
        { effect: 'gridWarp', at: 0, dur: D, opacity: 0.18,
          params: { cols: 24, rows: 24, dot: 0.9, noiseAmp: 0.012, noiseScale: 1.0, speed: 0.06, color: '$1' } },
        // 左侧竖条装饰
        { effect: 'frameRect', at: 0.2, dur: D - 0.3, opacity: 0.5,
          params: { x: 0.07, y: 0.18, w: 0.86, h: 0.64, color: '$accent', lineWidth: 1, corners: true } },
        // 标题
        { effect: 'labelText', at: 0.2, dur: D - 0.3, ease: 'outCubic', opacity: 0.9,
          params: { text: s.heading || '核心特性', x: 0.5, y: 0.16, size: 0.022, weight: 700, color: '$accent', letterSpacing: 0.05 } },
        // 列表
        { effect: 'bulletList', at: 0.5, dur: D - 0.7, ease: 'outCubic', opacity: 1,
          params: { items: s.items || ['特性一', '特性二', '特性三'], x: 0.12, y: 0.34,
                    size: 0.028, lineGap: 0.09, color: '$fg', colorBullet: '$accent', stagger: 0.55 } },
        // 装饰光斑
        { effect: 'gradientBlob', at: 0, dur: D, opacity: 0.2,
          params: { count: 1, alpha: 0.3, mode: 'screen' } }
      ],
    };
  });

  // ===== 数据幕（丰富版）=====
  RF.Scenelet.register('metrics', function (s) {
    var D = s.dur || 4;
    var v = s.value != null ? s.value : 100;
    return {
      dur: D,
      background: { type: 'gradient', angle: 135,
        stops: [{ at: 0, color: '#03080f' }, { at: 1, color: '#0a1830' }] },
      tracks: [
        { effect: 'dotGrid', at: 0, dur: D, opacity: 0.4,
          params: { spacing: 0.04, dotR: 0.0016, color: 'rgba(90,180,255,0.3)', reveal: 'sweep' } },
        // 大数字
        { effect: 'counterNumber', at: 0.3, dur: 2.2, ease: 'outExpo', opacity: 1,
          params: { from: 0, to: v, x: 0.5, y: 0.28, size: 0.12, weight: 800, color: '$accent' } },
        // 标签
        { effect: 'labelText', at: 0.3, dur: 2.2, ease: 'outCubic', opacity: 0.8,
          params: { text: s.label || 'Metric', x: 0.5, y: 0.4, size: 0.016, color: '$fg', letterSpacing: 0.08 } },
        // 折线图
        { effect: 'lineChart', at: 1.0, dur: 2.6, ease: 'outCubic', opacity: 1,
          params: { x: 0.12, y: 0.54, w: 0.76, h: 0.26, color: '$accent', lineWidth: 3, fill: true, grid: true } },
        // 底部说明
        { effect: 'labelText', at: 1.6, dur: 2.0, ease: 'outCubic', opacity: 0.6,
          params: { text: s.caption || '数据驱动', x: 0.5, y: 0.9, size: 0.018, color: '$fg' } }
      ],
    };
  });

  // ===== 收尾 CTA（丰富版）=====
  RF.Scenelet.register('cta-outro', function (s) {
    var D = s.dur || 3.5;
    return {
      dur: D,
      background: { type: 'radial', cx: 0.5, cy: 0.5, radius: 1.2, inner: '#0a1838', outer: '#020610' },
      camera: { zoomFrom: 0.95, zoomTo: 1.05, ease: 'inOutCubic' },
      tracks: [
        { effect: 'gradientBlob', at: 0, dur: D, opacity: 0.3,
          params: { count: 2, alpha: 0.35, mode: 'screen' } },
        { effect: 'dotGrid', at: 0, dur: D, opacity: 0.5,
          params: { spacing: 0.05, dotR: 0.0018, color: 'rgba(90,180,255,0.3)', reveal: 'radial' } },
        // 冲击波
        { effect: 'ripples', at: 0.2, dur: 1.4, ease: 'outExpo', opacity: 0.7, blend: 'lighter',
          params: { count: 3, maxRadius: 0.75, lineWidth: 2, color: '$accent', alpha: 0.9 } },
        // 主 CTA
        { effect: 'titleCard', at: 0.4, dur: D - 0.5, ease: 'outCubic', opacity: 1,
          params: { badge: s.badge || 'GET STARTED', title: s.title || 'npm i x',
                    subtitle: s.subtitle || '', tag: s.tag || '',
                    x: 0.5, y: 0.45, titleSize: 0.055, titleWeight: 800, stagger: 0.5,
                    subSize: 0.022, badgeSize: 0.014, tagSize: 0.016 } },
        // 底部 logo
        { effect: 'logoMark', at: 1.6, dur: 0.9, ease: 'outBack', opacity: 0.8,
          params: { style: 'cross', size: 0.035, x: 0.5, y: 0.82, color: '$accent' } }
      ],
    };
  });
})(window.RF = window.RF || {});
