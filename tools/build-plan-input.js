#!/usr/bin/env node
// tools/build-plan-input.js —— 给 L2 Planner 准备输入包。
//
// 把 L1 产出（解读报告）+ L0 产出（创作宪法）整理成 Planner 可读的输入包：
//   report（解读报告）+ constitution（宪法）+ timeline（全片时间锚点）
//   + palette/effect/transition/postfx 清单（供 Planner 选）。
//
// 用法：
//   node tools/build-plan-input.js --report=report.json --constitution=constitution.json --out=plan-input.json
//
// 缺 --out 时打到 stdout。--report 必填。

const fs = require("fs");
const path = require("path");
const lib = require("./orchestrate-lib.js");

function main() {
  const args = lib.parseArgs(process.argv.slice(2), { value: ["report", "constitution", "dossier", "out"] });
  const reportPath = args.report;
  if (!reportPath) {
    console.error("用法: node tools/build-plan-input.js --report=report.json [--constitution=constitution.json] [--dossier=dossier.json] [--out=plan-input.json]");
    process.exit(1);
  }
  if (!fs.existsSync(path.resolve(reportPath))) {
    console.error("解读报告不存在: " + path.resolve(reportPath));
    process.exit(1);
  }
  const report = lib.readJson(reportPath);

  let constitution = {};
  let constitutionRef = "";
  if (args.constitution) {
    const cp = path.resolve(args.constitution);
    if (fs.existsSync(cp)) { constitution = lib.readJson(cp); constitutionRef = path.basename(cp); }
    else console.error("[警告] 创作宪法不存在，留空: " + cp);
  }

  // 可选 dossier：analyze.js 产出，含真实 beats/onsets/phrases，用于补全 timeline
  let dossier = null;
  let dossierRef = "";
  if (args.dossier) {
    const dp = path.resolve(args.dossier);
    if (fs.existsSync(dp)) { dossier = lib.readJson(dp); dossierRef = path.basename(dp); }
    else console.error("[警告] dossier 不存在，忽略: " + dp);
  }

  const pkg = lib.buildPlanInput({
    report: report,
    constitution: constitution,
    dossier: dossier,
    reportRef: path.basename(reportPath),
    constitutionRef: constitutionRef,
    dossierRef: dossierRef,
  });

  const json = JSON.stringify(pkg, null, 2);
  if (args.out) {
    const out = lib.writeJson(args.out, pkg);
    console.log("=== Planner 输入包已生成 ===");
    console.log("文件: " + out);
    console.log("时间锚点: beats=" + pkg.timeline.beats.length +
      " onsets=" + pkg.timeline.onsets.length +
      " phrases=" + pkg.timeline.phrases.length +
      " sections=" + pkg.timeline.sections.length +
      " focus=" + pkg.timeline.focus_curve.length +
      " (来源: " + pkg.meta.timeline_source + ")");
    console.log("可用: 调色板 " + pkg.palette_names.length + " / 效果 " + pkg.effect_names.length +
      " / 转场 " + pkg.transition_names.length + " / 后处理 " + pkg.postfx_names.length);
    console.log("体积: " + Math.round(json.length / 1024) + " KB");
  } else {
    process.stdout.write(json);
  }
}

module.exports = { buildPlanInput: lib.buildPlanInput, extractTimeline: lib.extractTimeline };

if (require.main === module) main();
