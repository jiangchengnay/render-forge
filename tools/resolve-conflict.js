#!/usr/bin/env node
// tools/resolve-conflict.js —— L0 冲突处理（确定性分支逻辑，对应 ARCHITECTURE.md §4.3）。
//
// 输入冲突清单，产出处理决议（resolution.json）。纯函数，不碰 LLM/网络。
//
// 用法：
//   node tools/resolve-conflict.js --conflict=conflict.json [--allow-ask=true|false] [--out=resolution.json]
//
// 分支逻辑（§4.3）：
//   has_conflict == false → { action: "proceed" }（无冲突，零交互）
//   has_conflict == true:
//     allow-ask == true（默认）→ { action: "ask_user", questions: [...] }
//     allow-ask == false → 按保底规则依次：
//       a. possible_bridge 非空 → 深层串联
//       b. matching_interpretation 非空 → 网络匹配
//       c. 都没有 → { action: "ai_decide" }
//       d. 兜底 → { action: "proceed_with_default" }（垫底处理）
//
// 输出记录「依据」（对应 constitution.conflict.resolution）。
// 可被 require：resolveConflict 为纯函数。

const fs = require("fs");
const path = require("path");

// ========== 参数解析 ==========
function parseArgs(argv) {
  const a = argv || process.argv.slice(2);
  const out = { conflict: null, allowAsk: true, out: null };
  a.forEach((s) => {
    const m = s.match(/^--([\w-]+)(?:=(.+))?$/);
    if (!m) return;
    const k = m[1], v = m[2];
    if (k === "conflict") out.conflict = v;
    else if (k === "allow-ask") out.allowAsk = !(v === "false" || v === "0" || v === "no");
    else if (k === "out") out.out = v;
  });
  return out;
}

// ========== 冲突处理（纯函数）==========
// conflict: 冲突清单 { has_conflict, items:[{aspect,user_side,song_side,severity,possible_bridge,matching_interpretation}] }
// opts: { allowAsk: boolean }
// 返回决议对象。
function resolveConflict(conflict, opts) {
  opts = opts || {};
  const allowAsk = opts.allowAsk !== false;

  if (conflict == null || typeof conflict !== "object") {
    return {
      action: "proceed_with_default",
      resolution: "垫底",
      note: "冲突清单缺失或非法，按垫底处理（默认继续）。",
      basis: {},
    };
  }

  // 无冲突 → 零交互
  if (conflict.has_conflict === false) {
    return {
      action: "proceed",
      resolution: "",
      note: "无冲突，零交互直接通过。",
      basis: { has_conflict: false },
    };
  }

  const items = Array.isArray(conflict.items) ? conflict.items : [];

  // has_conflict=true 但 items 为空 → 无法处理，垫底
  if (!items.length) {
    return {
      action: "proceed_with_default",
      resolution: "垫底",
      note: "has_conflict=true 但 items 为空，按垫底处理。",
      basis: { has_conflict: true, items: 0 },
    };
  }

  // 有冲突 + 允许问 → 生成问题，问用户
  if (allowAsk) {
    const questions = items.map((it, i) => {
      const aspect = (it && it.aspect) || ("冲突" + (i + 1));
      const us = (it && it.user_side) || "（用户一侧）";
      const ss = (it && it.song_side) || "（歌曲一侧）";
      return "关于【" + aspect + "】：你的意图是「" + us + "」，但歌曲本意/共识是「" + ss + "」。请确认以哪一侧为准，或是否接受折中？";
    });
    return {
      action: "ask_user",
      resolution: "询问用户",
      note: "检测到冲突，默认询问用户（异常分支）。",
      questions: questions,
      basis: { has_conflict: true, items: items.length, severity: maxSeverity(items) },
    };
  }

  // 有冲突 + 不允许问 → 按保底规则依次尝试
  // a. 深层串联：任一 item 有 possible_bridge
  const bridgeItem = items.filter((it) => it && typeof it.possible_bridge === "string" && it.possible_bridge.length > 0)[0];
  if (bridgeItem) {
    return {
      action: "use_bridge",
      resolution: "深层串联",
      note: "用户不许问：找到深层串联依据（" + bridgeItem.aspect + "），据此处理。",
      basis: { has_conflict: true, item_index: items.indexOf(bridgeItem), aspect: bridgeItem.aspect, possible_bridge: bridgeItem.possible_bridge },
    };
  }
  // b. 网络匹配：任一 item 有 matching_interpretation
  const netItem = items.filter((it) => it && typeof it.matching_interpretation === "string" && it.matching_interpretation.length > 0)[0];
  if (netItem) {
    return {
      action: "use_network",
      resolution: "网络匹配",
      note: "用户不许问：无深层串联，改用网络解读匹配（" + netItem.aspect + "）。",
      basis: { has_conflict: true, item_index: items.indexOf(netItem), aspect: netItem.aspect, matching_interpretation: netItem.matching_interpretation },
    };
  }
  // c. 都没有 → AI 自决
  return {
    action: "ai_decide",
    resolution: "AI 自决",
    note: "用户不许问，且无深层串联/网络匹配：全凭 AI 判断，自决依据须记入创作宪法 conflict_notes（§11 第 5 条）。",
    basis: { has_conflict: true, items: items.length, severity: maxSeverity(items) },
  };
}

function maxSeverity(items) {
  const order = { low: 1, mid: 2, high: 3 };
  let max = "low";
  (items || []).forEach((it) => {
    const s = it && it.severity;
    if (order[s] > (order[max] || 0)) max = s;
  });
  return max;
}

// ========== CLI ==========
function main() {
  const args = parseArgs();
  if (!args.conflict) {
    console.error("用法: node tools/resolve-conflict.js --conflict=conflict.json [--allow-ask=true|false] [--out=resolution.json]");
    process.exit(1);
  }
  const cp = path.resolve(args.conflict);
  if (!fs.existsSync(cp)) { console.error("冲突清单不存在: " + cp); process.exit(1); }
  let conflict;
  try { conflict = JSON.parse(fs.readFileSync(cp, "utf8")); }
  catch (e) { console.error("读取/解析失败: " + e.message); process.exit(1); }

  const result = resolveConflict(conflict, { allowAsk: args.allowAsk });
  const json = JSON.stringify(result, null, 2);

  if (args.out) {
    const outPath = path.resolve(args.out);
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, json);
    console.log("=== 冲突处理决议已生成 ===");
    console.log("文件: " + outPath);
    console.log("动作: " + result.action + (result.resolution ? "  依据: " + result.resolution : ""));
  } else {
    process.stdout.write(json);
  }
}

module.exports = { parseArgs, resolveConflict };

if (require.main === module) main();
