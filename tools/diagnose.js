#!/usr/bin/env node
// tools/diagnose.js —— 批评归因器（P0-3 框架侧切片，不依赖外部视觉模型）。
//
// 问题：critique.js 只出像素统计（亮度/对比度/边缘密度），patch.js 基于指标"猜"补丁。
//        WORKFLOW.md 的"归因表"（局部→L3/结构→L2/理解→L0-L1）没有代码实现。
// 本工具：把像素指标 → 问题类型 → 归属层 → **具体参数修改建议**，让批评可执行。
//
// 用法：node tools/diagnose.js <critique-report.json> [--storyboard=x.json] [--out=diagnosis.json]
// 纯函数 diagnose(report, storyboard)，确定性（不碰 LLM）。

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const a = argv || process.argv.slice(2);
  const out = { report: a[0], storyboard: null, vision: null, out: null };
  a.slice(1).forEach((s) => {
    const m = s.match(/^--([\w-]+)(?:=(.+))?$/);
    if (!m) return;
    if (m[1] === "storyboard") out.storyboard = m[2];
    else if (m[1] === "vision") out.vision = m[2];
    else if (m[1] === "out") out.out = m[2];
  });
  return out;
}

// —— 归因规则（锁进引擎的审美/工程原则）——
// 每条：{ match(metrics, frame), level, where, issue, fix }
// level: L3(执行) / L2(结构) / L1(映射) / L0(理解)
const RULES = [
  { id: "too-dark", test: (m) => m.avgLum < 15,
    level: "L3", issue: "画面过暗",
    fix: { param: "post[bloom].amount / threshold", change: "提高 bloom.amount +0.1~0.2 或 threshold 降到 0.6；或提亮 background" } },
  { id: "too-bright", test: (m) => m.avgLum > 220,
    level: "L3", issue: "画面过曝",
    fix: { param: "post[bloom].amount / threshold", change: "降低 bloom.amount -0.2 或 threshold 提到 0.8" } },
  { id: "low-contrast", test: (m) => m.contrast < 12,
    level: "L3", issue: "对比度低、画面平淡",
    fix: { param: "background / tracks", change: "加深外圈色；或加 1-2 层不同 blend 的 clip（如 gradientBlob）" } },
  { id: "sparse", test: (m) => m.edgeDensity < 3,
    level: "L3", issue: "视觉元素稀疏",
    fix: { param: "tracks", change: "加装饰层（dotGrid / geoShapes / stripes）" } },
  { id: "overload", test: (m) => m.edgeDensity > 40,
    level: "L3", issue: "视觉过载、元素堆叠",
    fix: { param: "tracks[].opacity", change: "降低各 clip opacity；或减少同时活跃的 clip 数" } },
  { id: "too-many-colors", test: (m) => m.colorCount > 200,
    level: "L2", issue: "颜色过多、杂乱",
    fix: { param: "palette", change: "换更克制的调色板（monochrome / deepSea）" } },
  { id: "mono-flat", test: (m) => m.dominantRatio > 0.85,
    level: "L3", issue: "单色占比过高、缺层次",
    fix: { param: "tracks", change: "加 1-2 层 lighter 混合的元素" } },
];

// —— 从 report + storyboard 推断更高级归因（结构/理解层）——
function diagnose(report, storyboard, visionReport) {
  const frames = (report && report.frames) || [];
  const duration = (report && report.duration) || 0;
  const issues = [];      // 逐帧问题（带归属层 + 建议）
  const summary = {};     // issueId → 出现帧数
  const levels = { L0: 0, L1: 0, L2: 0, L3: 0 };

  frames.forEach((f) => {
    const m = f.metrics || {};
    // 跳过空帧（全 0 = 还没画内容，如 t=0 开场），不算"过暗/平淡"
    if ((m.avgLum || 0) === 0 && (m.contrast || 0) === 0 && (m.edgeDensity || 0) === 0 && (m.colorCount || 0) <= 1) return;
    RULES.forEach((rule) => {
      if (rule.test(m)) {
        issues.push({ t: f.t, id: rule.id, level: rule.level, issue: rule.issue, fix: rule.fix });
        summary[rule.id] = (summary[rule.id] || 0) + 1;
        levels[rule.level] = (levels[rule.level] || 0) + 1;
      }
    });
  });

  // —— 结构级归因：同一问题跨多帧（≥50%帧）→ 升级为结构问题 ——
  const total = frames.length || 1;
  const structural = [];
  Object.keys(summary).forEach((id) => {
    if (summary[id] >= total * 0.5 && id !== "sparse") {
      structural.push({ id, frames: summary[id], total, note: "全片性问题，可能需在 L2 层调整结构/palette/幕划分，而非单帧修补" });
    }
  });

  // —— 理解级归因：若 report 里 lintWarnings 或 runtimeErrors 非空，提示 L0/L1 复查 ——
  const understanding = [];
  if (report && Array.isArray(report.runtimeErrors) && report.runtimeErrors.length)
    understanding.push({ level: "L0/L1", note: "存在运行时错误，先确保语义/映射无误：" + report.runtimeErrors.slice(0, 3).join("; ") });

  // —— 视觉模型（可选）：合并语义级批评（判断构图/色彩/节奏/文字/层次）——
  const semantic = [];
  const vp = visionReport && visionReport.parsed ? visionReport.parsed : (visionReport && visionReport.issues ? visionReport : null);
  if (vp) {
    if (typeof vp.score === "number") semantic.push({ kind: "score", value: vp.score, note: "视觉模型评分 " + vp.score + "/10" });
    (vp.issues || []).forEach((it) => {
      // type → 归属层：构图/色彩/层次 → L2（结构）或 L3；文字/节奏理解性 → L1
      const type = it.type || "";
      let level = "L3";
      if (/层次|色彩/.test(type)) level = "L2";
      if (/理解|意义|隐喻|情绪基调/.test(type)) level = "L1";
      semantic.push({ kind: "issue", type: type, level: level, severity: it.severity || "medium", desc: it.desc || "" });
      levels[level] = (levels[level] || 0) + 1;
    });
    (vp.suggestions || []).forEach((s) => {
      semantic.push({ kind: "suggestion", target: s.target || "", action: s.action || "" });
    });
  }

  // —— 汇总归属 ——
  const dominantLevel = Object.keys(levels).sort((a, b) => levels[b] - levels[a])[0] || "L3";

  return {
    meta: { duration: duration, framesAnalyzed: frames.length, generatedFrom: (report && report.meta && report.meta.dossierRef) || "" },
    perFrameIssues: issues,
    summary: summary,
    structuralProblems: structural,
    understandingHints: understanding,
    semanticCritique: semantic,
    attribution: {
      levels: levels,
      dominant: dominantLevel,
      advise: "主导问题是 " + dominantLevel + " 层：" +
        (dominantLevel === "L3" ? "直接改 clip 参数/后处理（局部修补）" :
         dominantLevel === "L2" ? "调整结构：palette / 幕划分 / 全局规则" :
         "回到 L0/L1：检查理解与映射是否偏离歌曲本意"),
    },
    actionables: issues.slice(0, 20).map((i) => ({ t: i.t, level: i.level, change: i.fix.param + " → " + i.fix.change })),
  };
}

function main() {
  const args = parseArgs();
  if (!args.report) {
    console.error("用法: node tools/diagnose.js <critique-report.json> [--storyboard=x.json] [--out=diagnosis.json]");
    process.exit(1);
  }
  const rp = path.resolve(args.report);
  if (!fs.existsSync(rp)) { console.error("报告不存在: " + rp); process.exit(1); }
  const report = JSON.parse(fs.readFileSync(rp, "utf8"));
  const storyboard = args.storyboard && fs.existsSync(path.resolve(args.storyboard)) ? JSON.parse(fs.readFileSync(path.resolve(args.storyboard), "utf8")) : null;
  const visionReport = args.vision && fs.existsSync(path.resolve(args.vision)) ? JSON.parse(fs.readFileSync(path.resolve(args.vision), "utf8")) : null;
  const diag = diagnose(report, storyboard, visionReport);
  const json = JSON.stringify(diag, null, 2);
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), json);
    console.log("=== 批评归因完成 ===");
    console.log("文件: " + path.resolve(args.out));
    console.log("主导层: " + diag.attribution.dominant + "  问题类型: " + Object.keys(diag.summary).join(", "));
  } else {
    process.stdout.write(json);
  }
}

module.exports = { parseArgs, diagnose, RULES };
if (require.main === module) main();
