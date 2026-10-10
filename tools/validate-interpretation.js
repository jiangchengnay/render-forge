#!/usr/bin/env node
// tools/validate-interpretation.js —— L1《解读报告》校验器。
//
// 校验《解读报告》结构：必需字段、类型、枚举、引用完整性、以及「映射不含效果名」红线。
// 报错定位到具体路径（如 lyrics[3].emotion 缺失）。
// 退出码：有 error → 1，否则 0。可被 require。
//
// 用法：
//   node tools/validate-interpretation.js report.json

const fs = require("fs");
const path = require("path");

const KEY_MOMENT_TYPES = ["drop", "build-up", "cut", "break", "rise", "fall", "other"];
const TRANSITION_TYPES = ["fade", "dissolve", "cut", "wipe", "none"];
const LAYER_HINTS = ["subject", "background", "accent", "decoration", "text", "none"];
const FOCUS_VALUES = ["text", "subject", "background", "accent", "decoration", "none"];

// 读效果名列表（用于红线检测：映射里不得出现引擎效果名）
function loadEffectNames() {
  try {
    const p = path.join(__dirname, "_effect-names.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) { return []; }
}
const EFFECT_NAMES = loadEffectNames();
// 只检测「看起来像引擎效果名」的（避免误报常见中文/英文词）。
// 效果名多为驼峰/小写英文标识，长度 >= 4。
const EFFECT_SET = EFFECT_NAMES.filter((n) => typeof n === "string" && n.length >= 4);
function findEffectNameIn(str) {
  if (typeof str !== "string") return null;
  for (const name of EFFECT_SET) {
    // 单词边界匹配，避免 "path" 命中 "pathway" 之类误报
    const re = new RegExp("\\b" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
    if (re.test(str)) return name;
  }
  return null;
}

const isNum = (x) => typeof x === "number" && isFinite(x);
const isStr = (x) => typeof x === "string";

function validate(report) {
  const errors = [];
  const warnings = [];
  const E = (p, msg) => errors.push({ path: p, msg });
  const W = (p, msg) => warnings.push({ path: p, msg });

  if (report == null || typeof report !== "object" || Array.isArray(report)) {
    E("", "报告必须是对象");
    return { errors, warnings };
  }

  // ---- meta ----
  if (report.meta != null && typeof report.meta !== "object") {
    E("meta", "必须是对象");
  }

  // ---- lyrics ----
  let lyricIndexSet = new Set();
  if (report.lyrics == null) {
    E("lyrics", "缺失（必需）");
  } else if (!Array.isArray(report.lyrics)) {
    E("lyrics", "必须是数组");
  } else {
    report.lyrics.forEach((l, i) => {
      const p = "lyrics[" + i + "]";
      if (l == null || typeof l !== "object") { E(p, "必须是对象"); return; }
      if (!isNum(l.index)) E(p + ".index", "缺失或非数字");
      else lyricIndexSet.add(l.index);
      if (!isStr(l.text)) E(p + ".text", "缺失或非字符串");
      if (!isStr(l.emotion) || l.emotion.length === 0) E(p + ".emotion", "缺失（必需）");
      if (l.imagery != null && !Array.isArray(l.imagery)) E(p + ".imagery", "必须是数组");
      if (l.line != null && !isStr(l.line)) E(p + ".line", "必须是字符串");
      if (l.metaphor != null && !isStr(l.metaphor)) E(p + ".metaphor", "必须是字符串");
    });
  }

  // ---- music ----
  if (report.music != null) {
    const m = report.music;
    if (typeof m !== "object" || Array.isArray(m)) {
      E("music", "必须是对象");
    } else {
      if (m.emotion_curve != null) {
        if (!Array.isArray(m.emotion_curve)) E("music.emotion_curve", "必须是数组");
        else m.emotion_curve.forEach((seg, i) => {
          const p = "music.emotion_curve[" + i + "]";
          if (seg == null || typeof seg !== "object") { E(p, "必须是对象"); return; }
          if (!isNum(seg.start)) E(p + ".start", "缺失或非数字");
          if (!isNum(seg.end)) E(p + ".end", "缺失或非数字");
          if (isNum(seg.start) && isNum(seg.end) && seg.start >= seg.end) E(p, "start 必须 < end");
          if (!isNum(seg.intensity)) E(p + ".intensity", "缺失或非数字");
          else if (seg.intensity < 0 || seg.intensity > 1) E(p + ".intensity", "必须在 [0,1]");
          if (!isStr(seg.label) || seg.label.length === 0) E(p + ".label", "缺失");
        });
      }
      if (m.key_moments != null) {
        if (!Array.isArray(m.key_moments)) E("music.key_moments", "必须是数组");
        else m.key_moments.forEach((km, i) => {
          const p = "music.key_moments[" + i + "]";
          if (km == null || typeof km !== "object") { E(p, "必须是对象"); return; }
          if (!isNum(km.t)) E(p + ".t", "缺失或非数字");
          if (!isStr(km.type)) E(p + ".type", "缺失");
          else if (KEY_MOMENT_TYPES.indexOf(km.type) < 0) E(p + ".type", "非法枚举: " + km.type + "（应为 " + KEY_MOMENT_TYPES.join("/") + "）");
          if (km.note != null && !isStr(km.note)) E(p + ".note", "必须是字符串");
        });
      }
      if (m.sections_mapped != null) {
        if (!Array.isArray(m.sections_mapped)) E("music.sections_mapped", "必须是数组");
        else m.sections_mapped.forEach((s, i) => {
          const p = "music.sections_mapped[" + i + "]";
          if (s == null || typeof s !== "object") { E(p, "必须是对象"); return; }
          if (!isNum(s.start)) E(p + ".start", "缺失或非数字");
          if (!isNum(s.end)) E(p + ".end", "缺失或非数字");
          if (!isStr(s.type)) E(p + ".type", "缺失");
          if (!isStr(s.mood)) E(p + ".mood", "缺失");
        });
      }
    }
  }

  // ---- mapping ----
  if (report.mapping != null) {
    if (!Array.isArray(report.mapping)) {
      E("mapping", "必须是数组");
    } else {
      report.mapping.forEach((mp, i) => {
        const p = "mapping[" + i + "]";
        if (mp == null || typeof mp !== "object") { E(p, "必须是对象"); return; }
        if (!isNum(mp.lyric_index)) E(p + ".lyric_index", "缺失或非数字");
        else if (lyricIndexSet.size && !lyricIndexSet.has(mp.lyric_index)) {
          E(p + ".lyric_index", "引用不存在: " + mp.lyric_index + "（lyrics 中无此 index）");
        }
        if (!isStr(mp.meaning)) E(p + ".meaning", "缺失或非字符串");
        if (!isStr(mp.action) || mp.action.length === 0) E(p + ".action", "缺失（必需）");
        // 红线：action/meaning 不得含引擎效果名
        const hitA = findEffectNameIn(mp.action);
        if (hitA) E(p + ".action", "含引擎效果名『" + hitA + "』——映射只到动作候选，不指定效果名（见 schema 4.1）");
        const hitM = findEffectNameIn(mp.meaning);
        if (hitM) E(p + ".meaning", "含引擎效果名『" + hitM + "』——同上红线");
        if (mp.transition != null) {
          const t = mp.transition;
          if (typeof t !== "object" || Array.isArray(t)) E(p + ".transition", "必须是对象");
          else {
            if (!isStr(t.type)) E(p + ".transition.type", "缺失");
            else if (TRANSITION_TYPES.indexOf(t.type) < 0) E(p + ".transition.type", "非法枚举: " + t.type);
            if (!isNum(t.dur)) E(p + ".transition.dur", "缺失或非数字");
            else if (t.dur < 0) E(p + ".transition.dur", "必须 ≥ 0");
          }
        }
        if (mp.layer_hint != null) {
          if (!isStr(mp.layer_hint) || LAYER_HINTS.indexOf(mp.layer_hint) < 0) {
            E(p + ".layer_hint", "非法枚举: " + mp.layer_hint + "（应为 " + LAYER_HINTS.join("/") + "）");
          }
        }
      });
    }
  }

  // ---- layers ----
  if (report.layers != null) {
    const ly = report.layers;
    if (typeof ly !== "object" || Array.isArray(ly)) {
      E("layers", "必须是对象");
    } else if (ly.focus_curve != null) {
      if (!Array.isArray(ly.focus_curve)) E("layers.focus_curve", "必须是数组");
      else {
        let prevT = -Infinity;
        ly.focus_curve.forEach((f, i) => {
          const p = "layers.focus_curve[" + i + "]";
          if (f == null || typeof f !== "object") { E(p, "必须是对象"); return; }
          if (!isNum(f.t)) E(p + ".t", "缺失或非数字");
          else { if (f.t < prevT) E(p + ".t", "必须非递减（前一项 t=" + prevT + "，本项 " + f.t + "）"); prevT = f.t; }
          if (!isStr(f.focus)) E(p + ".focus", "缺失");
          else if (FOCUS_VALUES.indexOf(f.focus) < 0) E(p + ".focus", "非法枚举: " + f.focus + "（应为 " + FOCUS_VALUES.join("/") + "）");
          if (!isStr(f.reason) || f.reason.length === 0) E(p + ".reason", "缺失");
        });
      }
    }
  }

  return { errors, warnings };
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("用法: node tools/validate-interpretation.js <report.json>");
    process.exit(1);
  }
  let report;
  try { report = JSON.parse(fs.readFileSync(path.resolve(file), "utf8")); }
  catch (e) { console.error("读取/解析失败: " + e.message); process.exit(1); }

  const { errors, warnings } = validate(report);
  if (errors.length === 0) {
    console.log("✓ 解读报告校验通过");
    if (warnings.length) { console.log("  警告 " + warnings.length + " 条:"); warnings.forEach((w) => console.log("    [" + w.path + "] " + w.msg)); }
    process.exit(0);
  } else {
    console.log("✗ 解读报告校验失败，共 " + errors.length + " 处错误:");
    errors.forEach((e) => console.log("  " + (e.path || "(根)") + ": " + e.msg));
    process.exit(1);
  }
}

module.exports = { validate, EFFECT_NAMES };

if (require.main === module) main();
