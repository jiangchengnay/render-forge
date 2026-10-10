#!/usr/bin/env node
// tools/assign-task.js —— 给某个 L3 Worker 准备输入包。
//
// 关键：只给该 Worker 相关的——全局约束 + 自己那条 task + 按角色裁的时间轴切片 + 文档片段。
// 不塞全片数据。
//
// 用法：
//   node tools/assign-task.js --plan=plan.json --task=s1 --out=worker-input.json
//
// 缺 --out 时打到 stdout。--plan / --task 必填。

const fs = require("fs");
const path = require("path");
const lib = require("./orchestrate-lib.js");

function main() {
  const args = lib.parseArgs(process.argv.slice(2), { value: ["plan", "task", "out"] });
  if (!args.plan || !args.task) {
    console.error("用法: node tools/assign-task.js --plan=plan.json --task=s1 [--out=worker-input.json]");
    process.exit(1);
  }
  if (!fs.existsSync(path.resolve(args.plan))) {
    console.error("计划不存在: " + path.resolve(args.plan));
    process.exit(1);
  }
  const plan = lib.readJson(args.plan);

  let pkg;
  try {
    pkg = lib.assignTask({ plan: plan, taskId: args.task });
  } catch (e) {
    console.error("[错误] " + e.message);
    process.exit(1);
  }

  const json = JSON.stringify(pkg, null, 2);
  if (args.out) {
    const out = lib.writeJson(args.out, pkg);
    console.log("=== Worker 输入包已生成 ===");
    console.log("文件: " + out);
    console.log("task: " + pkg.task.id + " (" + pkg.task.type + "/" + pkg.task.role + ")");
    console.log("时间切片: " + Object.keys(pkg.timeline_slice).map((k) => k + "=" + (pkg.timeline_slice[k].length || 0)).join(" "));
    console.log("焦点段: " + pkg.focus_slice.length + "  文档: " + pkg.docs.length);
    console.log("体积: " + Math.round(json.length / 1024) + " KB");
  } else {
    process.stdout.write(json);
  }
}

module.exports = { assignTask: lib.assignTask, sliceForRole: lib.sliceForRole };

if (require.main === module) main();
