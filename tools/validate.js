#!/usr/bin/env node
// tools/validate.js
// 分镜 DSL 校验器。检查 effect 名、参数类型、必填项、占位符合法性。
// 用法：node tools/validate.js <storyboard.json>
//
// 也可在浏览器里调用 RF.validate(sb) 返回同样结构的问题列表。

const fs = require("fs");
const path = require("path");

// 从浏览器引擎导出的效果 meta 里读参数定义——这里用一份简化快照
// （引擎是浏览器端的，Node 侧无法直接 import，所以离线读 _meta-defs.json）
function loadEffectMeta(root) {
  // 优先用从浏览器导出的完整 meta
  const full = path.join(root, "tools", "_effect-meta.json");
  if (fs.existsSync(full)) return JSON.parse(fs.readFileSync(full, "utf8"));
  // 回落：_meta-defs.json（只有部分效果）
  const defsPath = path.join(root, "tools", "_meta-defs.json");
  const map = {};
  if (fs.existsSync(defsPath)) {
    const defs = JSON.parse(fs.readFileSync(defsPath, "utf8"));
    Object.keys(defs).forEach((name) => { map[name] = defs[name].params || {}; });
  }
  return map;
}

// 已知效果名（从浏览器导出或硬编码）——用 manifest 加载后导出更可靠
// 这里用一份静态清单（由 tools/export-effects.js 生成）
function loadEffectNames(root) {
  const p = path.join(root, "tools", "_effect-names.json");
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  return null;
}

function loadList(root, name) {
  const p = path.join(root, "tools", name);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  return null;
}

function validate(sb, effectNames, effectMeta, lists) {
  lists = lists || {};
  const problems = [];
  const push = (level, where, msg) => problems.push({ level, where, msg });

  if (!sb || typeof sb !== "object") {
    push("error", "root", "storyboard 不是对象");
    return problems;
  }

  // 模板 spec：{ template: "...", slots: {...} }
  if (sb.template) {
    const KNOWN_TPL = ["product-launch","open-source","music-video","data-story"];
    if (KNOWN_TPL.indexOf(sb.template) < 0)
      push("error", "template", "未知模板 '" + sb.template + "'。可用: " + KNOWN_TPL.join(", "));
    else
      push("info", "template", "模板 spec（会在加载时展开为完整分镜）");
    return problems;
  }

  // meta
  if (!sb.meta) push("warn", "meta", "缺少 meta（建议含 title/width/height/duration）");
  else {
    if (sb.meta.width != null && (typeof sb.meta.width !== "number" || sb.meta.width <= 0))
      push("error", "meta.width", "width 必须是正数");
    if (sb.meta.height != null && (typeof sb.meta.height !== "number" || sb.meta.height <= 0))
      push("error", "meta.height", "height 必须是正数");
    if (sb.meta.duration != null && (typeof sb.meta.duration !== "number" || sb.meta.duration <= 0))
      push("error", "meta.duration", "duration 必须是正数");
  }

  // palette
  const PALETTES = lists.palettes || ["neonDusk","cyberMint","synthSunset","paperMint","coralCream","skyBlue","monochrome","inkAndGold","deepSea","memphis","bubblegum","lavaLamp","auroraGreen"];
  if (sb.palette && PALETTES.indexOf(sb.palette) < 0)
    push("warn", "palette", "未知调色板 '" + sb.palette + "'，将回落到 neonDusk。可用: " + PALETTES.join(", "));

  // post
  const POSTFX = lists.postfx || ["bloom","vignette","grain","chroma","scanlines","glitch","tint"];
  if (sb.post != null && !Array.isArray(sb.post)) {
    push("error", "post", "post 必须是数组（当前 " + typeof sb.post + "）");
  } else if (Array.isArray(sb.post)) {
    sb.post.forEach((p, i) => {
      if (!p.effect) push("error", "post[" + i + "]", "缺少 effect");
      else if (POSTFX.indexOf(p.effect) < 0)
        push("error", "post[" + i + "].effect", "未知后处理 '" + p.effect + "'。可用: " + POSTFX.join(", "));
    });
  }

  // 收集所有 clip
  const clips = [];
  const collect = (arr, where, actDur) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((c, i) => clips.push({ clip: c, where: where + "[" + i + "]", actDur: actDur }));
  };
  if (sb.acts != null && !Array.isArray(sb.acts)) {
    push("error", "acts", "acts 必须是数组（当前 " + typeof sb.acts + "）");
  } else if (Array.isArray(sb.acts)) {
    sb.acts.forEach((a, ai) => {
      if (!a || typeof a !== "object") { push("error", "acts[" + ai + "]", "幕必须是对象"); return; }
      if (a.tracks != null && !Array.isArray(a.tracks)) push("error", "acts[" + ai + "].tracks", "tracks 必须是数组");
      collect(a.tracks, "acts[" + ai + "].tracks", a.dur);
      if (a.camera && typeof a.camera !== "object") push("warn", "acts[" + ai + "].camera", "camera 应为对象");
    });
  }
  collect(sb.tracks, "tracks");

  const TRANSITIONS = lists.transitions || ["cut","fade","wipe","zoomFade","iris","slide","glitch","blocks","shapeMask"];
  if (Array.isArray(sb.acts)) {
    sb.acts.forEach((a, ai) => {
      ["transitionIn","transitionOut"].forEach((k) => {
        if (a[k] && a[k].type && TRANSITIONS.indexOf(a[k].type) < 0)
          push("error", "acts[" + ai + "]." + k + ".type", "未知转场 '" + a[k].type + "'。可用: " + TRANSITIONS.join(", "));
      });
    });
  }


  // —— 新增结构校验：shape / path / motion / group ——
  const validateNode = (node, where) => {
    if (!node || typeof node !== "object") return;
    // group 容器
    if (node.type === "group") {
      if (!Array.isArray(node.children)) push("error", where + ".children", "group 必须有 children 数组");
      else (node.children || []).forEach((c, i) => validateNode(c, where + ".children[" + i + "]"));
      if (node.motion) validateMotion(node.motion, where + ".motion");
      if (node.transform) validateTransform(node.transform, where + ".transform");
      return;
    }
    // 通用 transform
    if (node.transform) validateTransform(node.transform, where + ".transform");
    // motion
    if (node.motion) validateMotion(node.motion, where + ".motion");
    // shape 图元
    if (node.effect === "shape" && node.params) {
      const p = node.params;
      const kinds = ["polygon","star","circle","rect","line","path"];
      if (p.kind != null && kinds.indexOf(p.kind) < 0)
        push("error", where + ".params.kind", "未知 kind '" + p.kind + "'。可用: " + kinds.join(", "));
      if (p.points != null && !Array.isArray(p.points))
        push("error", where + ".params.points", "points 必须是数组");
      else if (Array.isArray(p.points)) {
        p.points.forEach((pt, i) => {
          if (!Array.isArray(pt) || pt.length !== 2)
            push("error", where + ".params.points[" + i + "]", "点必须是 [x, y] 数组");
        });
      }
    }
    // path 图元
    if (node.effect === "path" && node.params) {
      const p = node.params;
      if (!Array.isArray(p.points) || p.points.length < 2)
        push("error", where + ".params.points", "path 至少需要 2 个点");
      const smooths = ["linear","catmullRom"];
      if (p.smooth != null && smooths.indexOf(p.smooth) < 0)
        push("error", where + ".params.smooth", "未知 smooth '" + p.smooth + "'。可用: " + smooths.join(", "));
    }
  };

  const validateTransform = (tr, where) => {
    ["x","y","scale","rotate","opacity"].forEach((k) => {
      if (tr[k] != null && typeof tr[k] !== "number")
        push("warn", where + "." + k, "应为 number");
    });
  };

  const validateMotion = (mo, where) => {
    if (!Array.isArray(mo.keys) || mo.keys.length === 0) {
      push("error", where + ".keys", "motion 必须有非空 keys 数组");
      return;
    }
    mo.keys.forEach((k, i) => {
      if (k.t == null || typeof k.t !== "number")
        push("error", where + ".keys[" + i + "].t", "关键帧必须有数字 t");
      if (k.x == null && k.y == null)
        push("warn", where + ".keys[" + i + "]", "关键帧既无 x 也无 y");
    });
    const paths = ["linear","catmullRom","bezier"];
    if (mo.path != null && paths.indexOf(mo.path) < 0)
      push("error", where + ".path", "未知 path '" + mo.path + "'。可用: " + paths.join(", "));
  };

  // 校验每个 clip
  clips.forEach(({ clip, where, actDur }) => {
    validateNode(clip, where);
    // act 边界检查：clip 应在所属幕时长内（at < actDur 且 at+dur 不过分超出）
    if (actDur != null && typeof clip.at === "number") {
      if (clip.at >= actDur) push("warn", where + ".at", "at(" + clip.at + ") 已超出所属幕时长(" + actDur + ")，该 clip 不会出现");
      else if (typeof clip.dur === "number" && clip.at + clip.dur > actDur + 0.05)
        push("warn", where + ".dur", "at+dur(" + (clip.at + clip.dur).toFixed(2) + ") 超出幕时长(" + actDur + ")，尾部会被裁掉");
    }
    if (clip.type === "group") return;  // group 容器不需要 effect
    if (!clip.effect) { push("error", where, "缺少 effect"); return; }
    if (effectNames && effectNames.indexOf(clip.effect) < 0) {
      push("error", where + ".effect", "未知效果 '" + clip.effect + "'");
      return;
    }
    // at 可以是数字、beat:xxx 字符串、{beat,offset} 对象
    if (clip.at != null) {
      const at = clip.at;
      if (typeof at === "number") { if (at < 0) push("warn", where + ".at", "at 为负数（" + at + "）"); }
      else if (typeof at === "string" && /^(beat:[\d.]+([+-][\d.]+)?|phrase:\d+|interlude:\d+|section:[a-z]+(:\d+)?)$/.test(at)) { /* ok */ }
      else if (typeof at === "object" && typeof at.beat === "number") { /* ok */ }
      else push("error", where + ".at", "at 格式非法（应为数字 / 'beat:N' / {beat:N,offset}）");
    }
    if (clip.dur != null && (typeof clip.dur !== "number" || clip.dur < 0))
      push("error", where + ".dur", "dur 必须是非负数");

    // 参数校验（若有 meta）
    if (effectMeta && effectMeta[clip.effect] && clip.params) {
      const def = effectMeta[clip.effect];
      Object.keys(clip.params).forEach((k) => {
        if (!(k in def)) {
          push("warn", where + ".params." + k, "参数 '" + k + "' 未在 " + clip.effect + " 的 meta 中声明（可能拼写错误）");
        } else {
          const spec = def[k];
          const v = clip.params[k];
          // 颜色占位符（$0/$accent/hex/rgba）允许字符串
          const isColorParam = /color/i.test(k);
          // $N 占位符越界检查（palette 通常 5 色）
          if (typeof v === "string" && /^\$\d+$/.test(v)) {
            const idx = parseInt(v.slice(1), 10);
            if (idx > 4) push("warn", where + ".params." + k, "$" + idx + " 可能越界（调色板通常 $0-$4）");
          }
          const isColorValue = typeof v === "string" && (/^\$/.test(v) || /^#/.test(v) || /^rgba?\(/.test(v));
          // 表达式（以 = 开头，动态求值）对任何类型都合法，跳过静态类型检查
          const isExprValue = typeof v === "string" && v.length > 1 && v[0] === "=";
          if (isExprValue) { /* 表达式，跳过 */ }
          else if (spec.type === "number") {
            if (typeof v !== "number" && !(isColorParam && isColorValue))
              push("warn", where + ".params." + k, "期望 number，实际 " + (typeof v) + " (" + JSON.stringify(v) + ")");
          } else if (spec.type === "array") {
            if (!Array.isArray(v)) push("warn", where + ".params." + k, "期望 array，实际 " + typeof v);
          } else if (spec.type === "boolean") {
            if (typeof v !== "boolean") push("warn", where + ".params." + k, "期望 boolean，实际 " + typeof v);
          } else if (spec.type === "string") {
            if (typeof v !== "string") push("warn", where + ".params." + k, "期望 string，实际 " + typeof v);
          }
          // range 检查：string 类型按枚举（值必须在内）；number 类型若是 [min,max] 区间则按区间判断
          if (spec.range && !isExprValue) {
            if (spec.type === "number" && Array.isArray(spec.range) && spec.range.length === 2
                && typeof spec.range[0] === "number" && typeof spec.range[1] === "number") {
              if (typeof v === "number" && (v < spec.range[0] || v > spec.range[1]))
                push("warn", where + ".params." + k, "值 " + v + " 超出范围 [" + spec.range[0] + ", " + spec.range[1] + "]");
            } else if (spec.range.indexOf(v) < 0) {
              push("warn", where + ".params." + k, "值 '" + v + "' 不在允许范围: " + spec.range.join(", "));
            }
          }
        }
      });
    }
  });

  return problems;
}

function main() {
  const input = process.argv[2];
  if (!input) { console.error("用法: node tools/validate.js <storyboard.json>"); process.exit(1); }
  const root = path.resolve(__dirname, "..");
  const sb = JSON.parse(fs.readFileSync(input, "utf8"));
  // 检查快照是否过期（比引擎文件旧则警告）
  const snapPath = path.join(root, "tools", "_effect-names.json");
  if (fs.existsSync(snapPath)) {
    const snapTime = fs.statSync(snapPath).mtimeMs;
    let newestEngine = 0;
    const scanDir = (d) => {
      const items = fs.readdirSync(d, { withFileTypes: true });
      items.forEach((it) => {
        const full = path.join(d, it.name);
        if (it.isDirectory()) scanDir(full);
        else if (it.name.endsWith(".js")) {
          const t = fs.statSync(full).mtimeMs;
          if (t > newestEngine) newestEngine = t;
        }
      });
    };
    try { scanDir(path.join(root, "engine")); } catch (e) {}
    if (newestEngine > snapTime) {
      console.warn("[提示] 快照可能过期（引擎文件更新于快照之后）。运行 npm run sync-effects 更新。");
    }
  }
  const effectNames = loadEffectNames(root);
  const effectMeta = loadEffectMeta(root);
  const lists = {
    palettes: loadList(root, "_palettes.json"),
    postfx: loadList(root, "_postfx-names.json"),
    transitions: loadList(root, "_transitions.json"),
  };
  const problems = validate(sb, effectNames, effectMeta, lists);

  if (!problems.length) {
    console.log("✓ 校验通过");
    process.exit(0);
  }
  const errors = problems.filter((p) => p.level === "error");
  const warns = problems.filter((p) => p.level === "warn");
  console.log("发现 " + errors.length + " 个错误, " + warns.length + " 个警告:");
  problems.forEach((p) => console.log("  [" + p.level + "] " + p.where + ": " + p.msg));
  process.exit(errors.length ? 1 : 0);
}

module.exports = { validate };

if (require.main === module) main();
