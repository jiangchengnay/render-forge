// engine/templates/builtin.js
// 内置模板：product-launch / open-source / music-video / data-story
(function (RF) {
  const T = RF.Templates;
  const U = T._util;

  // ============ 1) 产品发布 ============
  T.register("product-launch", function (s) {
    const palette = s.palette || "deepSea";
    const brand = s.brand || "Product";
    const tagline = s.tagline || "让工作更简单";
    const features = s.features || ["快速", "可靠", "开源"];
    const url = s.url || "example.com";
    const shotUrl = s.screenshotUrl || "app.example.com";
    const bgIn = s.bgIn || "#0a1830";
    const bgOut = s.bgOut || "#020610";
    return {
      meta: U.mkMeta(s, 14),
      palette: palette,
      post: U.defaultPost(),
      acts: [
        // 幕1: 品牌开场
        {
          id: "intro", dur: 3,
          background: U.bgRadial(bgIn, bgOut),
          transitionIn: { type: "fade", dur: 0.5, color: "#000" },
          transitionOut: { type: "wipe", dur: 0.35, dir: "up", color: bgOut },
          tracks: [
            { effect: "dotGrid", at: 0, dur: 3, opacity: 0.85,
              params: { spacing: 0.04, dotR: 0.0018, color: "rgba(90,180,255,0.4)", reveal: "radial" } },
            { effect: "logoMark", at: 0.4, dur: 2.5, ease: "outBack", opacity: 1,
              params: { style: "cross", size: 0.07, x: 0.5, y: 0.42, color: "$accent" } },
            { effect: "titleCard", at: 1.0, dur: 2.0, ease: "outCubic", opacity: 1,
              params: { title: brand, subtitle: tagline, x: 0.5, y: 0.62,
                        titleSize: 0.08, titleWeight: 800, stagger: 0.5, divider: false,
                        subSize: 0.026, subWeight: 400 } }
          ]
        },
        // 幕2: 产品展示
        {
          id: "product", dur: 4,
          background: U.bgGrad("#03080f", "#0a1530", 135),
          transitionIn: { type: "wipe", dur: 0.35, dir: "up", color: bgOut },
          transitionOut: { type: "iris", dur: 0.4, color: bgOut },
          tracks: [
            { effect: "geoShapes", at: 0, dur: 4, opacity: 0.35,
              params: { count: 10, alpha: 0.35, lineWidth: 1.5 } },
            { effect: "browserFrame", at: 0.3, dur: 3.7, ease: "outCubic", opacity: 1,
              params: { x: 0.1, y: 0.15, w: 0.8, h: 0.62, url: shotUrl, lines: 4 } },
            { effect: "labelText", at: 1.2, dur: 2.8, ease: "outCubic", opacity: 1,
              params: { text: s.productCaption || "简洁直观的界面", x: 0.5, y: 0.88,
                        size: 0.026, color: "$fg", weight: 500, align: "center" } }
          ]
        },
        // 幕3: 特性列表
        {
          id: "features", dur: 4,
          background: U.bgGrad("#050f1f", "#02101e", 180),
          transitionIn: { type: "iris", dur: 0.4, color: bgOut },
          transitionOut: { type: "glitch", dur: 0.35, colors: ["#00e5ff", "#ffffff"] },
          tracks: [
            { effect: "gridWarp", at: 0, dur: 4, opacity: 0.15,
              params: { cols: 20, rows: 20, dot: 0.8, noiseAmp: 0.01, noiseScale: 1.0,
                        speed: 0.06, color: "$0" } },
            { effect: "bulletList", at: 0.3, dur: 3.6, ease: "outCubic", opacity: 1,
              params: { x: 0.1, y: 0.35, items: features, size: 0.028, lineGap: 0.085,
                        color: "$fg", colorBullet: "$accent", stagger: 0.55 } },
            { effect: "titleCard", at: 0.5, dur: 3.4, ease: "outCubic", opacity: 1,
              params: { title: s.featuresTitle || "核心特性", x: 0.5, y: 0.16,
                        titleSize: 0.04, titleWeight: 700, stagger: 0.5, divider: false } }
          ]
        },
        // 幕4: 收尾 CTA
        {
          id: "outro", dur: 3,
          background: U.bgRadial(bgIn, bgOut),
          transitionIn: { type: "glitch", dur: 0.35, colors: ["#00e5ff", "#ffffff"] },
          tracks: [
            { effect: "dotGrid", at: 0, dur: 3, opacity: 0.8,
              params: { spacing: 0.05, dotR: 0.0018, color: "rgba(90,180,255,0.35)", reveal: "radial" } },
            { effect: "titleCard", at: 0.3, dur: 2.2, ease: "outCubic", opacity: 1,
              params: { badge: s.ctaBadge || "GET STARTED", title: s.ctaTitle || url,
                        subtitle: s.ctaSubtitle || "现在就用", tag: s.ctaTag || "",
                        x: 0.5, y: 0.45, titleSize: 0.045, titleWeight: 800, stagger: 0.5,
                        subSize: 0.02, badgeSize: 0.014, tagSize: 0.016 } },
            { effect: "logoMark", at: 2.0, dur: 0.8, ease: "outBack", opacity: 1,
              params: { style: "cross", size: 0.035, x: 0.5, y: 0.82, color: "$accent" } }
          ]
        }
      ]
    };
  });

  // ============ 2) 开源项目宣发 ============
  T.register("open-source", function (s) {
    const palette = s.palette || "cyberMint";
    const repo = s.repo || "github.com/user/repo";
    const name = s.name || "myproject";
    const installCmd = s.installCmd || ("npm i " + name);
    const lines = s.terminalLines || [
      "$ " + installCmd,
      "  added 3 packages in 1.2s",
      "$ " + name + " --help",
      "  ✓ ready"
    ];
    const tags = s.tags || ["MIT", "Zero-Deps", "TypeScript"];
    const stars = s.stars != null ? s.stars : 1000;
    const bgOut = "#020610";
    return {
      meta: U.mkMeta(s, 12),
      palette: palette,
      post: U.defaultPost(),
      acts: [
        {
          id: "repo", dur: 3,
          background: U.bgRadial("#0a0820", bgOut),
          transitionIn: { type: "fade", dur: 0.5, color: "#000" },
          transitionOut: { type: "wipe", dur: 0.35, dir: "left", color: bgOut },
          tracks: [
            { effect: "dotGrid", at: 0, dur: 3, opacity: 0.7,
              params: { spacing: 0.045, dotR: 0.0016, color: "rgba(0,255,163,0.35)", reveal: "radial" } },
            { effect: "titleCard", at: 0.3, dur: 2.7, ease: "outCubic", opacity: 1,
              params: { badge: "OPEN SOURCE", title: s.title || repo,
                        subtitle: s.subtitle || "一个开源项目",
                        tag: repo, x: 0.5, y: 0.48,
                        titleSize: 0.07, titleWeight: 800, stagger: 0.5,
                        subSize: 0.024, badgeSize: 0.016, tagSize: 0.016 } }
          ]
        },
        {
          id: "cli", dur: 4,
          background: U.bgRadial("#0a0820", "#020108"),
          transitionIn: { type: "wipe", dur: 0.35, dir: "left", color: bgOut },
          transitionOut: { type: "iris", dur: 0.4, color: bgOut },
          tracks: [
            { effect: "terminalWindow", at: 0.2, dur: 3.8, ease: "outCubic", opacity: 1,
              params: { x: 0.12, y: 0.2, w: 0.76, h: 0.5, title: name + " ~ zsh",
                        lines: lines, fontSize: 0.02,
                        promptColor: "$accent", textColor: "#d8dde8" } },
            { effect: "tagCloud", at: 2.0, dur: 2.0, ease: "outCubic", opacity: 1,
              params: { tags: tags, x: 0.5, y: 0.85, size: 0.02, maxWidth: 0.85 } }
          ]
        },
        {
          id: "metrics", dur: 4,
          background: U.bgGrad("#050f1f", "#020810", 180),
          transitionIn: { type: "iris", dur: 0.4, color: bgOut },
          transitionOut: { type: "fade", dur: 0.4, color: bgOut },
          tracks: [
            { effect: "counterNumber", at: 0.3, dur: 2.2, ease: "outExpo", opacity: 1,
              params: { from: 0, to: stars, comma: true, x: 0.28, y: 0.35,
                        size: 0.08, weight: 800, color: "$accent" } },
            { effect: "labelText", at: 0.3, dur: 2.2, ease: "outCubic", opacity: 1,
              params: { text: "STARS", x: 0.28, y: 0.45, size: 0.014, color: "$fg" } },
            { effect: "counterNumber", at: 0.6, dur: 2.2, ease: "outExpo", opacity: 1,
              params: { from: 0, to: s.contributors || 42, x: 0.72, y: 0.35,
                        size: 0.08, weight: 800, color: "$1" } },
            { effect: "labelText", at: 0.6, dur: 2.2, ease: "outCubic", opacity: 1,
              params: { text: "CONTRIBUTORS", x: 0.72, y: 0.45, size: 0.014, color: "$fg" } },
            { effect: "lineChart", at: 1.2, dur: 2.6, ease: "outCubic", opacity: 1,
              params: { x: 0.15, y: 0.6, w: 0.7, h: 0.28,
                        values: s.trend || [0.2, 0.35, 0.3, 0.55, 0.5, 0.75, 0.7, 0.9],
                        color: "$accent", lineWidth: 3 } }
          ]
        },
        {
          id: "outro", dur: 3,
          background: U.bgRadial("#0a0820", bgOut),
          transitionIn: { type: "fade", dur: 0.4, color: bgOut },
          tracks: [
            { effect: "titleCard", at: 0.3, dur: 2.2, ease: "outCubic", opacity: 1,
              params: { badge: "GET STARTED", title: "$ " + installCmd,
                        subtitle: "MIT License · 永久免费", tag: repo,
                        x: 0.5, y: 0.42, titleSize: 0.045, titleWeight: 800, stagger: 0.5,
                        subSize: 0.022, badgeSize: 0.014, tagSize: 0.016 } }
          ]
        }
      ]
    };
  });

  // ============ 3) 音乐 MV（逐句歌词）============
  // slots: { lines: [{ text, dur? }, ...], palette, bgColors: [...] }
  T.register("music-video", function (s) {
    const palette = s.palette || "synthSunset";
    const lyrics = s.lines || [{ text: "第一句歌词" }];
    const lineDur = s.lineDur != null ? s.lineDur : 4;
    const bgs = s.bgColors || ["#3a1548", "#4a2518", "#50203a", "#2a1a35"];
    const bgsOut = "#050109";
    const effects = s.effects || ["fbmNoise", "flowfield", "particles", "lissajous"];
    const totalDur = lyrics.length * lineDur;
    const acts = lyrics.map(function (line, i) {
      const start = i * lineDur;
      const isChorus = line.chorus === true;
      const localBgIn = bgs[i % bgs.length];
      const mode = (s.modes && s.modes[i]) || ["fill", "scan", "fill", "fade"][i % 4];
      return {
        id: "verse" + (i + 1), start: start, dur: lineDur,
        background: U.bgRadial(localBgIn, bgsOut),
        transitionIn: i === 0
          ? { type: "fade", dur: 0.5, color: "#000" }
          : { type: (i % 3 === 0 ? "glitch" : (i % 3 === 1 ? "wipe" : "iris")),
              dur: 0.35, color: bgsOut,
              colors: ["#ff2d95", "#ff9f45", "#ffffff"] },
        transitionOut: i === lyrics.length - 1 ? null : { type: "fade", dur: 0.3, color: bgsOut },
        tracks: [
          // 底噪
          { effect: "fbmNoise", at: 0, dur: lineDur, opacity: 0.45,
            params: { scale: 1.5, octaves: 2, warp: 0.8, speed: 0.1,
                      colorA: RF.Color.shift(localBgIn, 0.3), colorB: localBgIn, resolution: 320, pixelSize: 3 } },
          // 主效果（按 index 轮换）
          { effect: effects[i % effects.length], at: 0.1, dur: lineDur - 0.2,
            ease: "outCubic", opacity: 0.55, blend: "lighter",
            params: effects[i % effects.length] === "flowfield"
              ? { count: 1200, noiseScale: 1.8, noiseSpeed: 0.1, velocity: 200, lineWidth: 0.85, alpha: 0.5 }
              : effects[i % effects.length] === "particles"
              ? { count: 400, behavior: "drift", shape: "star", spawn: "random", sizeMul: 1.3 }
              : effects[i % effects.length] === "lissajous"
              ? { a: 3, b: 5, radius: 0.3, samples: 2000, lineWidth: 1, color: "#ff9f45", color2: "#ffd93d" }
              : { scale: 1.4, octaves: 3, warp: 0.7, speed: 0.08, colorA: "#7a2050", colorB: localBgIn, resolution: 320, pixelSize: 3 } },
          // 歌词（默认可换成 bezierText）
          line.bezier
            ? { effect: "bezierText", at: 0.4, dur: lineDur - 0.8, ease: "inOutCubic", opacity: 1,
                params: { text: line.text, points: line.points || [[0.15, 0.85], [0.3, 0.3], [0.7, 0.75], [0.85, 0.25]],
                          size: 0.06, weight: 800, color: "#ffffff",
                          colorPath: "rgba(255,159,69,0.35)", showPath: true, samples: 240, spread: 1.6 } }
            : { effect: "lyricLine", at: 0.4, dur: lineDur - 0.8, ease: "linear", opacity: 1,
                params: { text: line.text, x: 0.5, y: 0.5,
                          size: isChorus ? 0.095 : 0.078, weight: isChorus ? 900 : 700,
                          mode: mode,
                          colorBase: "rgba(255,232,214,0.35)", colorHi: "#ffffff",
                          colorGlow: "#ff9f45", glow: true } }
        ]
      };
    });
    return {
      meta: U.mkMeta(Object.assign({}, s, { duration: totalDur }), totalDur),
      palette: palette,
      post: [
        { effect: "bloom", amount: 0.3, threshold: 0.75, radius: 14 },
        { effect: "vignette", amount: 0.7 },
        { effect: "grain", amount: 0.05, cell: 2 }
      ],
      acts: acts
    };
  });

  // ============ 4) 数据故事 ============
  T.register("data-story", function (s) {
    const palette = s.palette || "skyBlue";
    const title = s.title || "数据洞察";
    const metrics = s.metrics || [
      { label: "用户数", value: 120000, suffix: "" },
      { label: "增长", value: 87, suffix: "%" },
      { label: "评分", value: 4.9, suffix: "" }
    ];
    const bgOut = "#020610";
    return {
      meta: U.mkMeta(s, 12),
      palette: palette,
      post: U.defaultPost(),
      acts: [
        {
          id: "intro", dur: 2.5,
          background: U.bgGrad("#02101e", "#050f1f", 135),
          transitionIn: { type: "fade", dur: 0.5, color: "#000" },
          transitionOut: { type: "wipe", dur: 0.3, dir: "left", color: bgOut },
          tracks: [
            { effect: "gridWarp", at: 0, dur: 2.5, opacity: 0.25,
              params: { cols: 32, rows: 32, dot: 1, noiseAmp: 0.02, noiseScale: 1.2, speed: 0.08, color: "$0" } },
            { effect: "titleCard", at: 0.3, dur: 2.2, ease: "outCubic", opacity: 1,
              params: { badge: "DATA REPORT", title: title, x: 0.5, y: 0.5,
                        titleSize: 0.075, titleWeight: 800, stagger: 0.5, divider: false } }
          ]
        },
        {
          id: "metrics", dur: 5,
          background: U.bgGrad("#050f1f", "#020810", 180),
          transitionIn: { type: "wipe", dur: 0.3, dir: "left", color: bgOut },
          transitionOut: { type: "iris", dur: 0.35, color: bgOut },
          tracks: metrics.slice(0, 3).map(function (m, i) {
            const n = Math.min(3, metrics.length);
            const x = n === 1 ? 0.5 : (0.2 + i * (0.6 / (n - 1)));
            return { effect: "counterNumber", at: 0.3 + i * 0.2, dur: 2.5, ease: "outExpo", opacity: 1,
              params: { from: 0, to: m.value, suffix: m.suffix || "",
                        x: x, y: 0.35, size: 0.09, weight: 800,
                        color: i === 0 ? "$accent" : (i === 1 ? "$1" : "$2") } };
          }).concat(metrics.slice(0, 3).map(function (m, i) {
            const n = Math.min(3, metrics.length);
            const x = n === 1 ? 0.5 : (0.2 + i * (0.6 / (n - 1)));
            return { effect: "labelText", at: 0.3 + i * 0.2, dur: 2.5, ease: "outCubic", opacity: 1,
              params: { text: m.label, x: x, y: 0.45, size: 0.014, color: "$fg" } };
          })).concat([
            { effect: "barChart", at: 3.0, dur: 1.8, ease: "outCubic", opacity: 1,
              params: { x: 0.15, y: 0.6, w: 0.7, h: 0.3,
                        values: s.barValues || [0.3, 0.5, 0.7, 0.9, 0.6, 0.8],
                        labels: s.barLabels || null,
                        stagger: 0.4 } }
          ])
        },
        {
          id: "outro", dur: 2.5,
          background: U.bgGrad("#02101e", "#050f1f", 135),
          transitionIn: { type: "iris", dur: 0.35, color: bgOut },
          tracks: [
            { effect: "titleCard", at: 0.3, dur: 1.8, ease: "outCubic", opacity: 1,
              params: { title: s.ctaText || "数据说明一切",
                        subtitle: s.ctaSubtitle || "", x: 0.5, y: 0.5,
                        titleSize: 0.06, titleWeight: 800, stagger: 0.5, divider: false,
                        subSize: 0.022 } }
          ]
        }
      ]
    };
  });
})(window.RF = window.RF || {});