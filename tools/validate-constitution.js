#!/usr/bin/env node
// tools/validate-constitution.js —— L0《创作宪法》校验器。
//
// 校验创作宪法结构：必需字段、类型、枚举、引用完整性（conflict.has_conflict 与 items 一致）。
// 报错定位到具体路径（如 creative_constitution.core_meaning 缺失）。
// 退出码：有 error → 1，否则 0。可被 require。
//
// 用法：
//   node tools/validate-constitution.js constitution.json

const fs = require("fs");
const path = require("path");

const SEVERITIES = ["low", "mid", "high"];
const RESOLUTIONS = ["询问用户", "深层串联", "网络匹配", "AI 自决", "垫底"];

const isNum = (x) => typeof x === "number" && isFinite(x);
const isStr = (x) => typeof x === "string";
const isNonEmptyStr = (x) => isStr(x) && x.length > 0;
const isArr = (x) => Array.isArray(x);

function validate(con) {
  const errors = [];
  const warnings = [];
  const E = (p, msg) => errors.push({ path: p, msg });
  const W = (p, msg) => warnings.push({ path: p, msg });

  if (con == null || typeof con !== "object" || Array.isArray(con)) {
    E("", "创作宪法必须是对象");
    return { errors, warnings };
  }

  // ---- meta（可选）----
  if (con.meta != null && (typeof con.meta !== "object" || Array.isArray(con.meta))) {
    E("meta", "必须是对象");
  }

  // ---- song_context ----
  if (con.song_context == null) {
    E("song_context", "缺失（必需）");
  } else if (typeof con.song_context !== "object" || Array.isArray(con.song_context)) {
    E("song_context", "必须是对象");
  } else {
    const sc = con.song_context;
    if (sc.factual_background != null && !isStr(sc.factual_background)) E("song_context.factual_background", "必须是字符串");
    if (sc.cultural_roots != null && !isStr(sc.cultural_roots)) E("song_context.cultural_roots", "必须是字符串");
    if (sc.known_interpretations != null) {
      if (!isArr(sc.known_interpretations)) E("song_context.known_interpretations", "必须是数组");
      else sc.known_interpretations.forEach((k, i) => {
        const p = "song_context.known_interpretations[" + i + "]";
        if (k == null || typeof k !== "object") { E(p, "必须是对象"); return; }
        if (!isNonEmptyStr(k.source)) E(p + ".source", "缺失（必需）");
        if (!isNonEmptyStr(k.meaning)) E(p + ".meaning", "缺失（必需）");
      });
    }
    if (sc.search_queries_used != null && !isArr(sc.search_queries_used))
      E("song_context.search_queries_used", "必须是数组");
  }

  // ---- lyrics_scan ----
  if (con.lyrics_scan == null) {
    E("lyrics_scan", "缺失（必需）");
  } else if (typeof con.lyrics_scan !== "object" || Array.isArray(con.lyrics_scan)) {
    E("lyrics_scan", "必须是对象");
  } else {
    const ls = con.lyrics_scan;
    if (!isNonEmptyStr(ls.summary)) E("lyrics_scan.summary", "缺失（必需）");
    if (!isNonEmptyStr(ls.overall_tone)) E("lyrics_scan.overall_tone", "缺失（必需）");
  }

  // ---- user_intent ----
  if (con.user_intent == null) {
    E("user_intent", "缺失（必需）");
  } else if (typeof con.user_intent !== "object" || Array.isArray(con.user_intent)) {
    E("user_intent", "必须是对象");
  } else {
    const ui = con.user_intent;
    ["stated", "implied", "pasted", "narrative_style"].forEach((k) => {
      if (ui[k] != null && !isStr(ui[k])) E("user_intent." + k, "必须是字符串");
    });
    const stated = ui.stated || "";
    const implied = ui.implied || "";
    if (!isNonEmptyStr(stated) && !isNonEmptyStr(implied))
      E("user_intent", "stated 与 implied 至少一个非空（不能完全没有意图信息）");
  }

  // ---- conflict ----
  if (con.conflict == null) {
    E("conflict", "缺失（必需）");
  } else if (typeof con.conflict !== "object" || Array.isArray(con.conflict)) {
    E("conflict", "必须是对象");
  } else {
    const cf = con.conflict;
    if (typeof cf.has_conflict !== "boolean") {
      E("conflict.has_conflict", "缺失或非布尔");
    }
    if (!isArr(cf.items)) {
      E("conflict.items", "必须是数组");
    } else {
      cf.items.forEach((it, i) => {
        const p = "conflict.items[" + i + "]";
        if (it == null || typeof it !== "object") { E(p, "必须是对象"); return; }
        if (!isNonEmptyStr(it.aspect)) E(p + ".aspect", "缺失（必需）");
        if (!isNonEmptyStr(it.user_side)) E(p + ".user_side", "缺失（必需）");
        if (!isNonEmptyStr(it.song_side)) E(p + ".song_side", "缺失（必需）");
        if (!isStr(it.severity)) E(p + ".severity", "缺失");
        else if (SEVERITIES.indexOf(it.severity) < 0) E(p + ".severity", "非法枚举: " + it.severity + "（应为 " + SEVERITIES.join("/") + "）");
      });
      // 引用完整性：has_conflict 与 items 一致
      if (cf.has_conflict === false && cf.items.length > 0)
        E("conflict.items", "has_conflict=false 时 items 必须为空数组");
      if (cf.has_conflict === true && cf.items.length === 0)
        E("conflict.items", "has_conflict=true 时 items 不能为空");
    }
    if (cf.resolution != null && cf.resolution !== "") {
      if (!isStr(cf.resolution)) E("conflict.resolution", "必须是字符串");
      else if (RESOLUTIONS.indexOf(cf.resolution) < 0)
        W("conflict.resolution", "非标准枚举: " + cf.resolution + "（建议 " + RESOLUTIONS.join("/") + "）");
    }
    if (cf.resolution_note != null && !isStr(cf.resolution_note)) E("conflict.resolution_note", "必须是字符串");
  }

  // ---- creative_constitution ----
  if (con.creative_constitution == null) {
    E("creative_constitution", "缺失（必需）");
  } else if (typeof con.creative_constitution !== "object" || Array.isArray(con.creative_constitution)) {
    E("creative_constitution", "必须是对象");
  } else {
    const cc = con.creative_constitution;
    if (!isNonEmptyStr(cc.core_meaning)) E("creative_constitution.core_meaning", "缺失（必需）");
    if (!isNonEmptyStr(cc.narrative_style)) E("creative_constitution.narrative_style", "缺失（必需）");
    if (cc.must_preserve != null && !isArr(cc.must_preserve)) E("creative_constitution.must_preserve", "必须是数组");
    else if (isArr(cc.must_preserve)) cc.must_preserve.forEach((s, i) => {
      if (!isStr(s)) E("creative_constitution.must_preserve[" + i + "]", "必须是字符串");
    });
    if (cc.can_interpret != null && !isArr(cc.can_interpret)) E("creative_constitution.can_interpret", "必须是数组");
    else if (isArr(cc.can_interpret)) cc.can_interpret.forEach((s, i) => {
      if (!isStr(s)) E("creative_constitution.can_interpret[" + i + "]", "必须是字符串");
    });
    if (cc.conflict_notes != null && !isStr(cc.conflict_notes)) E("creative_constitution.conflict_notes", "必须是字符串");
    // must_preserve 与 can_interpret 不得含完全相同条目
    if (isArr(cc.must_preserve) && isArr(cc.can_interpret)) {
      const inter = cc.must_preserve.filter((x) => cc.can_interpret.indexOf(x) >= 0);
      if (inter.length) E("creative_constitution", "must_preserve 与 can_interpret 存在重复项（同一事物不能既不可改又可发挥）: " + inter.join(" / "));
    }
  }

  return { errors, warnings };
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("用法: node tools/validate-constitution.js <constitution.json>");
    process.exit(1);
  }
  let con;
  try { con = JSON.parse(fs.readFileSync(path.resolve(file), "utf8")); }
  catch (e) { console.error("读取/解析失败: " + e.message); process.exit(1); }

  const { errors, warnings } = validate(con);
  if (errors.length === 0) {
    console.log("✓ 创作宪法校验通过");
    if (warnings.length) {
      console.log("  警告 " + warnings.length + " 条:");
      warnings.forEach((w) => console.log("    [" + w.path + "] " + w.msg));
    }
    process.exit(0);
  } else {
    console.log("✗ 创作宪法校验失败，共 " + errors.length + " 处错误:");
    errors.forEach((e) => console.log("  " + (e.path || "(根)") + ": " + e.msg));
    if (warnings.length) console.log("  （另有 " + warnings.length + " 条警告）");
    process.exit(1);
  }
}

module.exports = { validate, SEVERITIES, RESOLUTIONS };

if (require.main === module) main();
