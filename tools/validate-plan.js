#!/usr/bin/env node
// tools/validate-plan.js —— L2 任务清单校验器。
//
// 校验任务清单结构：范式、全局约束、任务字段、引用完整性、splice 覆盖 / choreography 层次。
// 报错定位到具体路径。退出码：有 error → 1，否则 0。可被 require。
//
// 用法：
//   node tools/validate-plan.js plan.json

const fs = require("fs");
const path = require("path");
const lib = require("./orchestrate-lib.js");

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("用法: node tools/validate-plan.js <plan.json>");
    process.exit(1);
  }
  let plan;
  try { plan = lib.readJson(file); }
  catch (e) { console.error("读取/解析失败: " + e.message); process.exit(1); }

  const { errors, warnings } = lib.validatePlan(plan);
  if (errors.length === 0) {
    console.log("✓ 任务清单校验通过");
    if (warnings.length) {
      console.log("  警告 " + warnings.length + " 条:");
      warnings.forEach((w) => console.log("    [" + w.path + "] " + w.msg));
    }
    process.exit(0);
  } else {
    console.log("✗ 任务清单校验失败，共 " + errors.length + " 处错误:");
    errors.forEach((e) => console.log("  " + (e.path || "(根)") + ": " + e.msg));
    if (warnings.length) console.log("  （另有 " + warnings.length + " 条警告）");
    process.exit(1);
  }
}

module.exports = { validatePlan: lib.validatePlan };

if (require.main === module) main();
