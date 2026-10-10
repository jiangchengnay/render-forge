#!/usr/bin/env node
// tools/assemble.js —— L4 组装：收集片段 → 校验 → 拼成完整分镜。
//
// 用法：
//   node tools/assemble.js --plan=plan.json --fragments=fragments/ --out=storyboard.json
//
// --fragments 可为目录（读目录下所有 .json）或单个文件。
// 组装结果确定（纯函数 assemble）。产出后可直接 node tools/validate.js 校验。

const fs = require("fs");
const path = require("path");
const lib = require("./orchestrate-lib.js");

function loadFragments(p) {
  const abs = path.resolve(p);
  const out = [];
  if (!fs.existsSync(abs)) throw new Error("片段路径不存在: " + abs);
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    fs.readdirSync(abs).filter((f) => f.endsWith(".json")).sort().forEach((f) => {
      const full = path.join(abs, f);
      try { out.push(lib.readJson(full)); }
      catch (e) { throw new Error("读取片段失败 " + f + ": " + e.message); }
    });
  } else {
    out.push(lib.readJson(abs));
  }
  return out;
}

function main() {
  const args = lib.parseArgs(process.argv.slice(2), { value: ["plan", "fragments", "out"] });
  if (!args.plan || !args.fragments) {
    console.error("用法: node tools/assemble.js --plan=plan.json --fragments=fragments/ [--out=storyboard.json]");
    process.exit(1);
  }
  if (!fs.existsSync(path.resolve(args.plan))) { console.error("计划不存在: " + path.resolve(args.plan)); process.exit(1); }
  const plan = lib.readJson(args.plan);
  const fragments = loadFragments(args.fragments);

  // 校验每个片段（有 plan 时做交叉校验）
  let bad = 0;
  fragments.forEach((f) => {
    const { errors } = lib.validateFragment(f, { plan: plan });
    if (errors.length) {
      bad++;
      console.error("[片段错误] " + (f && f.task_id ? f.task_id : "(无 task_id)"));
      errors.forEach((e) => console.error("  " + (e.path || "(根)") + ": " + e.msg));
    }
  });
  if (bad) { console.error("\n" + bad + " 个片段校验失败，组装中止。"); process.exit(1); }

  const sb = lib.assemble(plan, fragments);
  const json = JSON.stringify(sb, null, 2);

  if (args.out) {
    const out = lib.writeJson(args.out, sb);
    console.log("=== 组装完成 ===");
    console.log("文件: " + out);
    console.log("范式: " + plan.paradigm + "  片段: " + fragments.length);
    console.log("幕数: " + (sb.acts ? sb.acts.length : 0) + "  时长: " + (sb.meta && sb.meta.duration));
    if (sb._assembly_notes) {
      console.log("组装提示 " + sb._assembly_notes.length + " 条:");
      sb._assembly_notes.forEach((n) => console.log("  - " + n));
    }
    console.log("提示: 运行 node tools/validate.js " + args.out + " 做最终校验");
  } else {
    process.stdout.write(json);
  }
}

module.exports = { assemble: lib.assemble };

if (require.main === module) main();
