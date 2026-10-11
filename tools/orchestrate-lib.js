#!/usr/bin/env node
// tools/orchestrate-lib.js —— L2/L3/L4 编排共享工具库（纯函数 + 文件读写）。
//
// 被 build-plan-input / assign-task / validate-plan / validate-fragment / assemble 复用。
// 设计原则：确定性、零新依赖、可 require。
//
// 提供：
//   - parseArgs / readJson / writeJson：CLI 与 IO 辅助
//   - loadEffectNames / loadEffectMeta / loadLists：读取 tools 下的清单快照
//   - sliceForRole(role, timeline)：按角色裁时间轴切片（WORKFLOW §B3）
//   - resolveDocs(docs)：把 task.docs 引用展开成文档片段
//   - summarizeDossier / buildPlanInput / assignTask：输入包构建
//   - assemble：把 plan + fragments 拼成完整分镜（纯函数）
//   - validatePlan / validateFragment：结构与引用校验（纯函数）

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// ========== 参数解析 ==========
// 支持 --key=value 与 --key value；返回 { key: value, _: [位置参数] }
function parseArgs(argv, spec) {
  spec = spec || {};
  const a = (argv || process.argv.slice(2)).slice();
  const out = { _: [] };
  const takesValue = (k) => (spec.value || []).indexOf(k) >= 0;
  for (let i = 0; i < a.length; i++) {
    const s = a[i];
    const m = s.match(/^--([\w-]+)(?:=(.*))?$/);
    if (!m) { out._.push(s); continue; }
    const k = m[1];
    let v = m[2];
    if (v === undefined) {
      // --key value 形式（仅当该 key 声明为取 value 且下一项不是 --x）
      const nxt = a[i + 1];
      if (takesValue(k) && nxt != null && !/^--/.test(nxt)) { v = nxt; i++; }
      else v = true;
    }
    out[k] = v;
  }
  return out;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(path.resolve(p), "utf8"));
}

function writeJson(p, obj) {
  const abs = path.resolve(p);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(obj, null, 2));
  return abs;
}

function readJsonIf(p) {
  try { return JSON.parse(fs.readFileSync(path.resolve(p), "utf8")); }
  catch (e) { return null; }
}

// ========== 清单快照 ==========
function loadEffectNames() {
  return readJsonIf(path.join(ROOT, "tools", "_effect-names.json")) || [];
}

function loadEffectMeta() {
  const full = readJsonIf(path.join(ROOT, "tools", "_effect-meta.json"));
  if (full) return full;
  return {};
}

function loadLists() {
  return {
    palettes: readJsonIf(path.join(ROOT, "tools", "_palettes.json")) || [],
    postfx: readJsonIf(path.join(ROOT, "tools", "_postfx-names.json")) || [],
    transitions: readJsonIf(path.join(ROOT, "tools", "_transitions.json")) || [],
  };
}

// ========== 时间轴切片（WORKFLOW §B3）==========
// 按角色返回「下发哪些时间锚点 + 哪些焦点段」。
// 未知角色 → 给全部（保守）。
const ROLE_SLICE = {
  text:       { timeline: ["phrases"],                 focus: ["text"] },
  subtitle:   { timeline: ["phrases"],                 focus: ["text"] },
  accent:     { timeline: ["beats", "onsets"],         focus: ["accent"] },
  effect:     { timeline: ["beats", "onsets"],         focus: ["accent"] },
  particle:   { timeline: ["beats", "onsets"],         focus: ["accent"] },
  background: { timeline: ["sections"],                focus: [] },
  subject:    { timeline: ["beats", "phrases"],        focus: ["subject"] },
  decoration: { timeline: ["sections", "beats"],       focus: ["decoration"] },
};

function sliceForRole(role, timeline) {
  timeline = timeline || {};
  const rule = ROLE_SLICE[role] || null;
  const tKeys = rule ? rule.timeline : ["beats", "onsets", "phrases", "sections"];
  const fKeys = rule ? rule.focus : null;
  const timeline_slice = {};
  tKeys.forEach((k) => {
    const v = timeline[k];
    // 跳过缺失或空数组：空切片会误导 Worker（以为有锚点却拿到 []）。
    if (v == null) return;
    if (Array.isArray(v) && v.length === 0) return;
    timeline_slice[k] = v;
  });
  let focus_slice = [];
  if (Array.isArray(timeline.focus_curve)) {
    focus_slice = timeline.focus_curve.filter((f) => !fKeys || fKeys.indexOf(f.focus) >= 0);
  }
  return { timeline_slice, focus_slice };
}

// ========== docs 引用展开 ==========
// task.docs 形如 ["EFFECTS#particles", "audio#bands"]。
// 返回 [{ ref, kind, name, content }]。
function resolveDocs(docs, opts) {
  opts = opts || {};
  const effectNames = opts.effectNames || loadEffectNames();
  const effectMeta = opts.effectMeta || loadEffectMeta();
  const out = [];
  (docs || []).forEach((ref) => {
    if (typeof ref !== "string") return;
    const hash = ref.indexOf("#");
    const kind = hash >= 0 ? ref.slice(0, hash) : "raw";
    const name = hash >= 0 ? ref.slice(hash + 1) : ref;
    if (kind === "EFFECTS") {
      const params = effectMeta[name];
      out.push({
        ref: ref, kind: kind, name: name,
        known: effectNames.indexOf(name) >= 0,
        content: params ? describeEffect(name, params) : ("（无参数 meta；效果名" + (effectNames.indexOf(name) >= 0 ? "存在" : "不存在") + "）"),
      });
    } else if (kind === "audio") {
      out.push({ ref: ref, kind: kind, name: name, known: true, content: describeAudioDoc(name) });
    } else {
      out.push({ ref: ref, kind: kind, name: name, known: true, content: "（自定义文档引用）" });
    }
  });
  return out;
}

function describeEffect(name, params) {
  const keys = Object.keys(params || {});
  if (!keys.length) return "效果 " + name + "（无参数）";
  const lines = keys.map((k) => {
    const s = params[k] || {};
    let d = "  - " + k + " (" + (s.type || "?");
    if (s.default !== undefined) d += ", 默认 " + JSON.stringify(s.default);
    if (s.range) d += ", 取值 " + s.range.join("/");
    d += ")";
    if (s.desc) d += " " + s.desc;
    return d;
  });
  return "效果 " + name + " 的参数：\n" + lines.join("\n");
}

function describeAudioDoc(name) {
  const m = {
    bands: "audio#bands：可用 audio.bass / audio.mid / audio.treble（0-1）在表达式里驱动参数，如 \"=\$accent\" 或数值 \"=0.5+audio.bass\"",
    beats: "audio#beats：节拍锚点。clip 的 at 可用 \"beat:N\"（第 N 拍）或 {beat:N,offset:0.1}",
    phrases: "audio#phrases：乐句锚点。clip 的 at 可用 \"phrase:N\"（第 N 句起始）",
    sections: "audio#sections：段落。可用 at \"section:chorus\" 之类（取决于引擎解析）",
  };
  return m[name] || ("audio 文档：" + name);
}

// ========== Planner 输入包 ==========
// report + constitution → plan-input
function buildPlanInput(opts) {
  opts = opts || {};
  const report = opts.report || null;
  const constitution = opts.constitution != null ? opts.constitution : {};
  const lists = opts.lists || loadLists();
  const effectNames = opts.effectNames || loadEffectNames();
  const timeline = extractTimeline(report, opts.dossier || null);
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      reportRef: opts.reportRef || "",
      constitutionRef: opts.constitutionRef || "",
      dossierRef: opts.dossierRef || "",
      timeline_source: opts.dossier ? "dossier+report" : "report",
    },
    report: report,
    constitution: constitution,
    timeline: timeline,
    palette_names: lists.palettes,
    postfx_names: lists.postfx,
    transition_names: lists.transitions,
    effect_names: effectNames,
  };
}

// 从解读报告 + （可选）dossier 抽取全片时间轴锚点（Planner 切片的原料）。
// 优先用 dossier.audio 的真实锚点（analyze.js 算出的 beats/onsets/phrases）；
// report 本身不含逐拍数据，缺 dossier 时才降级：phrases 从 report.lyrics 抽，
// beats 从 report.music.key_moments 兜底（语义不完全等价，仅作降级）。
function extractTimeline(report, dossier) {
  const tl = { beats: [], onsets: [], phrases: [], sections: [], focus_curve: [] };
  const audio = dossier && dossier.audio ? dossier.audio : null;
  // beats / onsets：report 无此类数据，用 dossier（音频检测）。
  if (audio) {
    if (Array.isArray(audio.beats)) tl.beats = audio.beats.slice();
    if (Array.isArray(audio.onsets)) tl.onsets = audio.onsets.slice();
  }
  const m = (report && report.music) || {};
  // sections：优先 report.music.sections_mapped（L1 分析师映射后的语义段落，带 mood），
  // 缺失时降级用 dossier.sections（音频自动检测的原始段落，只有 energy）。
  (m.sections_mapped || []).forEach((s) => {
    if (s && s.start != null && s.end != null) {
      tl.sections.push({ start: s.start, end: s.end, type: s.type || "", mood: s.mood || "" });
    }
  });
  if (!tl.sections.length && audio && Array.isArray(audio.sections)) {
    tl.sections = audio.sections.map((s) => ({ start: s.start, end: s.end, type: s.type || "" }));
  }
  // phrases：优先 report.lyrics 的时间戳（分析师判断的句子时间），缺失时用 dossier.phrases（VAD 检测）。
  (report ? report.lyrics : [] || []).forEach((l) => {
    if (l && l.start != null && l.end != null) tl.phrases.push({ start: l.start, end: l.end });
  });
  if (!tl.phrases.length && audio && Array.isArray(audio.phrases)) {
    tl.phrases = audio.phrases.map((p) => ({ start: p.start, end: p.end }));
  }
  // beats 兜底：report.music.key_moments（语义不完全等价，仅降级）。
  if (!tl.beats.length) {
    (m.key_moments || []).forEach((k) => { if (k && typeof k.t === "number") tl.beats.push(k.t); });
  }
  const fc = (report && report.layers && report.layers.focus_curve) || [];
  tl.focus_curve = fc.map((f) => ({ t: f.t, focus: f.focus, reason: f.reason }));
  return tl;
}

// ========== Worker 输入包 ==========
// plan + taskId + docs → worker-input
function assignTask(opts) {
  opts = opts || {};
  const plan = opts.plan;
  if (!plan || !Array.isArray(plan.tasks)) throw new Error("plan.tasks 缺失");
  const taskId = opts.taskId;
  const task = plan.tasks.filter((t) => t.id === taskId)[0];
  if (!task) throw new Error("找不到 task: " + taskId);
  const timeline = plan.timeline || {};
  // 优先用 task 自带切片；缺失则按角色裁
  const auto = sliceForRole(task.role, timeline);
  const timeline_slice = (task.timeline_slice && Object.keys(task.timeline_slice).length) ? task.timeline_slice : auto.timeline_slice;
  const focus_slice = (task.focus_slice && task.focus_slice.length) ? task.focus_slice : auto.focus_slice;
  const docs = resolveDocs(task.docs, opts);
  return {
    meta: { generatedAt: new Date().toISOString(), taskId: taskId },
    global: plan.global || {},
    paradigm: plan.paradigm || "",
    task: {
      id: task.id, type: task.type, role: task.role, scope: task.scope,
      brief: task.brief, docs: task.docs || [],
    },
    timeline_slice: timeline_slice,
    focus_slice: focus_slice,
    docs: docs,
    effect_names: opts.effectNames || loadEffectNames(),
    palette_names: (opts.lists || loadLists()).palettes,
  };
}

// ========== 组装（纯函数）==========
// plan + fragments[] → storyboard
function assemble(plan, fragments) {
  if (!plan || typeof plan !== "object") throw new Error("plan 缺失");
  const g = plan.global || {};
  const duration = g.duration != null ? g.duration : 6;
  const frags = (fragments || []).slice();
  const notes = [];

  // 索引
  const taskById = {};
  (plan.tasks || []).forEach((t) => { taskById[t.id] = t; });

  const sb = {
    meta: {
      title: (plan.meta && plan.meta.title) || g.title || "orchestration-demo",
      width: g.width || 1080,
      height: g.height || 1080,
      duration: duration,
      seed: g.seed != null ? g.seed : 42,
    },
    palette: g.palette || "neonDusk",
    acts: [],
  };
  if (Array.isArray(g.post) && g.post.length) sb.post = g.post.map((p) => Object.assign({}, p));

  const defaultBg = { type: "radial", cx: 0.5, cy: 0.5, radius: 1, inner: "$bg", outer: "#000" };

  if (plan.paradigm === "splice") {
    // 每个 act 片段 → 一幕（按 task.scope 的 start/dur）
    const actFrags = frags.filter((f) => f && f.type === "act");
    actFrags.sort((a, b) => {
      const ta = taskById[a.task_id] || {}; const tb = taskById[b.task_id] || {};
      const sa = ta.scope && ta.scope.start != null ? ta.scope.start : 0;
      const sbb = tb.scope && tb.scope.start != null ? tb.scope.start : 0;
      return sa - sbb;
    });
    actFrags.forEach((f, i) => {
      const t = taskById[f.task_id] || {};
      const scope = (t.scope && typeof t.scope === "object") ? t.scope : {};
      const start = scope.start != null ? scope.start : 0;
      const end = scope.end != null ? scope.end : (start + (duration / Math.max(1, actFrags.length)));
      const act = {
        id: t.id || f.task_id || ("act" + i),
        start: start,
        dur: Math.max(0, end - start),
        background: t.background || defaultBg,
        tracks: Array.isArray(f.tracks) ? f.tracks : [],
      };
      if (t.transitionIn) act.transitionIn = t.transitionIn;
      if (t.transitionOut) act.transitionOut = t.transitionOut;
      sb.acts.push(act);
    });
    if (!sb.acts.length) notes.push("splice 范式但没有任何 type:'act' 片段");
  } else {
    // choreography：所有 system 片段合并进一幕（全片）
    const sysFrags = frags.filter((f) => f && f.type === "system");
    const tracks = [];
    sysFrags.forEach((f) => { (f.tracks || []).forEach((c) => tracks.push(c)); });
    sb.acts.push({ id: "main", start: 0, dur: duration, background: defaultBg, tracks: tracks });
    if (!sysFrags.length) notes.push("choreography 范式但没有任何 type:'system' 片段");
  }

  // 一致性提示（不静默改语义）
  const endMax = sb.acts.reduce((m, a) => Math.max(m, (a.start || 0) + (a.dur || 0)), 0);
  if (endMax > duration + 1e-6) notes.push("有 clip 超出 global.duration（" + endMax + " > " + duration + "）");
  if (plan.paradigm === "splice") {
    for (let i = 1; i < sb.acts.length; i++) {
      const prev = sb.acts[i - 1], cur = sb.acts[i];
      const pe = prev.start + prev.dur, cs = cur.start;
      if (Math.abs(pe - cs) > 1e-6) notes.push("splice 幕不接续：act" + (i - 1) + " 结束 " + pe + " vs act" + i + " 开始 " + cs);
    }
  }

  if (notes.length) sb._assembly_notes = notes;
  return sb;
}

// ========== 校验：任务清单 ==========
const FOCUS_VALUES = ["text", "subject", "background", "accent", "decoration", "none"];

function validatePlan(plan, opts) {
  opts = opts || {};
  const errors = [];
  const warnings = [];
  const E = (p, m) => errors.push({ path: p, msg: m });
  const W = (p, m) => warnings.push({ path: p, msg: m });
  const effectNames = opts.effectNames || loadEffectNames();
  const lists = opts.lists || loadLists();

  if (plan == null || typeof plan !== "object" || Array.isArray(plan)) {
    E("", "任务清单必须是对象");
    return { errors, warnings };
  }

  const paradigm = plan.paradigm;
  if (paradigm !== "splice" && paradigm !== "choreography")
    E("paradigm", "必须是 splice 或 choreography，实际: " + JSON.stringify(paradigm));

  // global
  if (plan.global == null || typeof plan.global !== "object") E("global", "缺失或非对象");
  else {
    const g = plan.global;
    if (g.palette != null && lists.palettes.length && lists.palettes.indexOf(g.palette) < 0)
      W("global.palette", "未知调色板 '" + g.palette + "'");
    ["width", "height", "duration"].forEach((k) => {
      if (g[k] == null) E("global." + k, "缺失");
      else if (typeof g[k] !== "number" || g[k] <= 0) E("global." + k, "必须是正数");
    });
    if (g.seed != null && typeof g.seed !== "number") E("global.seed", "必须是数字");
    if (g.bottom_line_rules != null && !Array.isArray(g.bottom_line_rules))
      E("global.bottom_line_rules", "必须是数组");
  }
  const duration = (plan.global && plan.global.duration) || 0;

  // timeline
  if (plan.timeline == null || typeof plan.timeline !== "object") {
    W("timeline", "缺失（Planner 通常应给出时间轴锚点）");
  } else {
    const tl = plan.timeline;
    ["beats", "phrases", "sections", "focus_curve"].forEach((k) => {
      if (tl[k] != null && !Array.isArray(tl[k])) E("timeline." + k, "必须是数组");
    });
    if (Array.isArray(tl.focus_curve)) {
      let prev = -Infinity;
      tl.focus_curve.forEach((f, i) => {
        const p = "timeline.focus_curve[" + i + "]";
        if (f == null || typeof f !== "object") { E(p, "必须是对象"); return; }
        if (typeof f.t !== "number") E(p + ".t", "缺失或非数字");
        else { if (f.t < prev) E(p + ".t", "必须非递减"); prev = f.t; }
        if (FOCUS_VALUES.indexOf(f.focus) < 0) E(p + ".focus", "非法枚举: " + f.focus);
      });
    }
  }

  // tasks
  const ids = {};
  if (!Array.isArray(plan.tasks)) { E("tasks", "必须是数组"); return { errors, warnings }; }
  if (!plan.tasks.length) E("tasks", "不能为空");
  plan.tasks.forEach((t, i) => {
    const p = "tasks[" + i + "]";
    if (t == null || typeof t !== "object") { E(p, "必须是对象"); return; }
    if (!t.id || typeof t.id !== "string") E(p + ".id", "缺失或非字符串");
    else if (ids[t.id]) E(p + ".id", "重复 id: " + t.id);
    else ids[t.id] = true;

    if (t.type !== "act" && t.type !== "system") E(p + ".type", "必须是 act 或 system");
    if (paradigm === "splice" && t.type !== "act") E(p + ".type", "splice 范式的 task 必须是 act");
    if (paradigm === "choreography" && t.type !== "system") E(p + ".type", "choreography 范式的 task 必须是 system");

    if (!t.role || typeof t.role !== "string") E(p + ".role", "缺失或非字符串");
    if (!t.brief || typeof t.brief !== "string") E(p + ".brief", "缺失或非字符串");
    if (t.docs != null && !Array.isArray(t.docs)) E(p + ".docs", "必须是数组");

    // docs 引用效果真实性
    if (Array.isArray(t.docs)) {
      t.docs.forEach((d, di) => {
        if (typeof d !== "string") return;
        const m = d.match(/^EFFECTS#(.+)$/);
        if (m && effectNames.length && effectNames.indexOf(m[1]) < 0) {
          // 类别名给出警告，其余算错误
          const CATS = ["noise","particle","primitive","text","ui","decor","geometry","math","media","data","interactive","feedback"];
          if (CATS.indexOf(m[1]) >= 0) W(p + ".docs[" + di + "]", "'" + m[1] + "' 是效果类别名而非具体效果名（建议用具体名）");
          else E(p + ".docs[" + di + "]", "引用未知效果名: " + m[1]);
        }
      });
    }

    // scope
    if (paradigm === "splice") {
      if (t.scope == null || typeof t.scope !== "object") E(p + ".scope", "splice 的 scope 必须是 {start,end}");
      else {
        if (typeof t.scope.start !== "number") E(p + ".scope.start", "缺失或非数字");
        if (typeof t.scope.end !== "number") E(p + ".scope.end", "缺失或非数字");
        if (typeof t.scope.start === "number" && typeof t.scope.end === "number" && t.scope.start >= t.scope.end)
          E(p + ".scope", "start 必须 < end");
      }
    } else {
      // choreography：scope 可为 "全片" 字符串或 {start,end}
      if (t.scope == null) E(p + ".scope", "缺失");
      else if (typeof t.scope === "object") {
        if (typeof t.scope.start !== "number" || typeof t.scope.end !== "number") E(p + ".scope", "应为 {start,end}");
        else if (t.scope.start >= t.scope.end) E(p + ".scope", "start 必须 < end");
      } else if (typeof t.scope !== "string") E(p + ".scope", "应为字符串或 {start,end}");
    }
  });

  // splice 覆盖检查（幕无缝覆盖 [0,duration] 且不重叠）
  if (paradigm === "splice" && plan.tasks.length) {
    const segs = plan.tasks
      .filter((t) => t && t.type === "act" && t.scope && typeof t.scope.start === "number" && typeof t.scope.end === "number")
      .map((t) => ({ id: t.id, start: t.scope.start, end: t.scope.end }))
      .sort((a, b) => a.start - b.start);
    if (segs.length) {
      if (Math.abs(segs[0].start - 0) > 1e-6) E("tasks", "splice 幕未从 0 开始（首幕 start=" + segs[0].start + "）");
      for (let i = 1; i < segs.length; i++) {
        if (segs[i].start < segs[i - 1].end - 1e-6)
          E("tasks", "splice 幕重叠: " + segs[i - 1].id + " 结束 " + segs[i - 1].end + " vs " + segs[i].id + " 开始 " + segs[i].start);
        else if (segs[i].start > segs[i - 1].end + 1e-6)
          E("tasks", "splice 幕之间有间隙: " + segs[i - 1].end + " → " + segs[i].start);
      }
      const last = segs[segs.length - 1];
      if (duration && Math.abs(last.end - duration) > 1e-6)
        W("tasks", "splice 末幕结束 " + last.end + " 与 global.duration " + duration + " 不一致");
    }
  }

  // choreography 层次覆盖
  if (paradigm === "choreography" && plan.tasks.length) {
    const roles = {};
    plan.tasks.forEach((t) => { if (t && t.role) roles[t.role] = true; });
    const n = Object.keys(roles).length;
    if (n < 2) W("tasks", "choreography 只有一个角色，视觉层次单薄（建议覆盖多个层次）");
  }

  return { errors, warnings };
}

// ========== 校验：片段 ==========
function validateFragment(frag, opts) {
  opts = opts || {};
  const errors = [];
  const warnings = [];
  const E = (p, m) => errors.push({ path: p, msg: m });
  const W = (p, m) => warnings.push({ path: p, msg: m });
  const plan = opts.plan || null;
  const effectNames = opts.effectNames || loadEffectNames();
  const effectMeta = opts.effectMeta || loadEffectMeta();
  const lists = opts.lists || loadLists();

  if (frag == null || typeof frag !== "object" || Array.isArray(frag)) {
    E("", "片段必须是对象");
    return { errors, warnings };
  }

  if (!frag.task_id || typeof frag.task_id !== "string") E("task_id", "缺失或非字符串");
  if (frag.type !== "act" && frag.type !== "system") E("type", "必须是 act 或 system");
  if (!Array.isArray(frag.tracks)) E("tracks", "必须是数组");
  if (frag.meta != null && typeof frag.meta !== "object") E("meta", "必须是对象");

  // 与 plan 交叉校验
  if (plan && Array.isArray(plan.tasks)) {
    const t = plan.tasks.filter((x) => x.id === frag.task_id)[0];
    if (!t) E("task_id", "引用不存在: " + frag.task_id + "（plan.tasks 中无此 id）");
    else if (t.type !== frag.type) E("type", "与 task 的 type 不一致（task=" + t.type + "，fragment=" + frag.type + "）");
  }

  // 复用现有 clip 校验逻辑（tools/validate.js 的 validate）
  if (Array.isArray(frag.tracks)) {
    let clipValidator = null;
    try { clipValidator = require("./validate.js"); } catch (e) { /* ignore */ }
    if (clipValidator && typeof clipValidator.validate === "function") {
      // 把片段包成一个 storyboard，让现有校验器检查 clip
      const pseudo = { meta: { width: 1080, height: 1080, duration: 1 }, tracks: frag.tracks, palette: (plan && plan.global && plan.global.palette) || undefined };
      const probs = clipValidator.validate(pseudo, effectNames, effectMeta, lists);
      probs.forEach((pr) => {
        if (pr.level === "error") E("tracks: " + pr.where, pr.msg);
        else W("tracks: " + pr.where, pr.msg);
      });
    } else {
      // 兜底：至少检查效果名
      frag.tracks.forEach((c, i) => {
        if (c && c.type !== "group" && c.effect && effectNames.length && effectNames.indexOf(c.effect) < 0)
          E("tracks[" + i + "].effect", "未知效果 '" + c.effect + "'");
      });
    }
  }

  return { errors, warnings };
}

module.exports = {
  ROOT, parseArgs, readJson, writeJson, readJsonIf,
  loadEffectNames, loadEffectMeta, loadLists,
  ROLE_SLICE, sliceForRole, resolveDocs, describeEffect,
  buildPlanInput, extractTimeline, assignTask, assemble,
  validatePlan, validateFragment,
};
