#!/usr/bin/env node
// tools/validate-fragment.js —— L3 片段校验器。
//
// 校验片段结构 + 复用现有 tools/validate.js 的 clip 校验（含未知效果名拦截）。
// 给 --plan 时额外校验 task_id 存在、type 与 task 一致。
// 退出码：有 error → 1，否则 0。可被 require。
//
// 用法：
//   node tools/validate-fragment.js frag.json [--plan=plan.json]

const fs = require("fs");
const path = require("path");
const lib = require("./orchestrate-lib.js");

function main() {
  const args = lib.parseArgs(process.argv.slice(2), { value: ["plan"] });
  const file = args._[0];
  if (!file) {
    console.error("用法: node tools/validate-fragment.js <frag.json> [--plan=plan.json]");
    process.exit(1);
  }
  let frag;
  try { frag = lib.readJson(file); }
  catch (e) { console.error("读取/解析失败: " + e.message); process.exit(1); }

  let plan = null;
  if (args.plan) {
    if (!fs.existsSync(path.resolve(args.plan))) { console.error("计划不存在: " + path.resolve(args.plan)); process.exit(1); }
    plan = lib.readJson(args.plan);
  }

  const { errors, warnings } = lib.validateFragment(frag, { plan: plan });
  if (errors.length === 0) {
    console.log("✓ 片段校验通过" + (plan ? "（含与 plan 的引用校验）" : ""));
    if (warnings.length) {
      console.log("  警告 " + warnings.length + " 条:");
      warnings.forEach((w) => console.log("    [" + w.path + "] " + w.msg));
    }
    process.exit(0);
  } else {
    console.log("✗ 片段校验失败，共 " + errors.length + " 处错误:");
    errors.forEach((e) => console.log("  " + (e.path || "(根)") + ": " + e.msg));
    if (warnings.length) console.log("  （另有 " + warnings.length + " 条警告）");
    process.exit(1);
  }
}

module.exports = { validateFragment: lib.validateFragment };

if (require.main === module) main();
