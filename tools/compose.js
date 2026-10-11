#!/usr/bin/env node
// tools/compose.js —— 构图建议器（P0-1 审美规则切片，不依赖 LLM）。
//
// 把"构图审美"锁进引擎：AI 不用自己懂三分法/安全区/视觉重心，
// 引擎检查分镜里元素的位置，给出符合构图原则的建议。
//
// 用法：node tools/compose.js <storyboard.json> [--out=suggestions.json]
// 纯函数 suggestComposition(storyboard)，确定性。

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const a = argv || process.argv.slice(2);
  const out = { input: a[0], out: null };
  a.slice(1).forEach((s) => {
    const m = s.match(/^--([\w-]+)(?:=(.+))?$/);
    if (!m) return;
    if (m[1] === "out") out.out = m[2];
  });
  return out;
}

// 三分线（rule of thirds）的黄金位置
const THIRDS = { x: [1 / 3, 2 / 3], y: [1 / 3, 2 / 3] };
const SAFE = 0.08; // 安全区边距

function nearestThird(v, axis) {
  const lines = THIRDS[axis];
  let best = lines[0], bd = Math.abs(v - lines[0]);
  lines.forEach((l) => { const d = Math.abs(v - l); if (d < bd) { bd = d; best = l; } });
  // 也算中心线
  const dCenter = Math.abs(v - 0.5);
  if (dCenter < bd) return { line: 0.5, dist: dCenter, isCenter: true };
  return { line: best, dist: bd, isCenter: false };
}

// 收集元素位置（只查有 x/y 的 clip）
function collectElements(sb) {
  const els = [];
  const visit = (tracks, actId) => {
    (tracks || []).forEach((c, i) => {
      if (!c || !c.params) return;
      const x = c.params.x, y = c.params.y;
      if (typeof x !== "number" || typeof y !== "number") return;
      els.push({
        actId: actId, index: i, effect: c.effect,
        x: x, y: y,
        isText: /text|title|lyric|label|subtitle|word|typewriter|code|bullet/i.test(c.effect || ""),
      });
    });
  };
  (sb.acts || []).forEach((a) => visit(a.tracks, a.id));
  visit(sb.tracks, "main");
  return els;
}

// 纯函数：构图建议
function suggestComposition(sb) {
  const els = collectElements(sb);
  const suggestions = [];
  const stats = { elements: els.length, textAtCenter: 0, nearEdge: 0, offThirds: 0, focalCount: 0 };

  // 1) 文字压在正中（构图大忌）
  els.forEach((e) => {
    if (e.isText && Math.abs(e.x - 0.5) < 0.06 && Math.abs(e.y - 0.5) < 0.06) {
      stats.textAtCenter++;
      suggestions.push({
        actId: e.actId, effect: e.effect, rule: "no-text-at-center",
        issue: "文字位于画面正中（构图大忌，会压住主体）",
        from: { x: e.x, y: e.y }, to: { x: 0.5, y: 0.72 },
        note: "移到下方（如 y=0.72）或上方（y=0.2）",
      });
    }
  });

  // 2) 元素贴边（超出安全区）
  els.forEach((e) => {
    if (e.x < SAFE || e.x > 1 - SAFE || e.y < SAFE || e.y > 1 - SAFE) {
      stats.nearEdge++;
      suggestions.push({
        actId: e.actId, effect: e.effect, rule: "safe-area",
        issue: "元素贴近边缘（可能被裁或显得局促）",
        from: { x: e.x, y: e.y },
        to: { x: Math.max(SAFE, Math.min(1 - SAFE, e.x)), y: Math.max(SAFE, Math.min(1 - SAFE, e.y)) },
        note: "收进安全区（边距 >= " + SAFE + "）",
      });
    }
  });

  // 3) 关键元素没落在三分线上（构图力量弱）——只对居中但非正中的元素提示
  els.forEach((e) => {
    const nx = nearestThird(e.x, "x"), ny = nearestThird(e.y, "y");
    const onThirdX = nx.dist < 0.05 && !nx.isCenter;
    const onCenterX = nx.isCenter;
    const onThirdY = ny.dist < 0.05 && !ny.isCenter;
    // 若元素在 x 上既不在三分线也不在中心 → 位置"随便"
    if (!onThirdX && !onCenterX && nx.dist > 0.08) {
      stats.offThirds++;
      suggestions.push({
        actId: e.actId, effect: e.effect, rule: "rule-of-thirds",
        issue: "元素 x 既不在三分线也不在中心，构图力量弱",
        from: { x: e.x }, to: { x: nx.line },
        note: "对齐三分线（" + THIRDS.x.map((v) => v.toFixed(2)).join(" / ") + "）或中心（0.5）",
      });
    }
  });

  // 4) 视觉焦点过多（元素位置过于分散，无主次）
  if (els.length >= 4) {
    const xs = els.map((e) => e.x), ys = els.map((e) => e.y);
    const spreadX = Math.max.apply(null, xs) - Math.min.apply(null, xs);
    const spreadY = Math.max.apply(null, ys) - Math.min.apply(null, ys);
    if (spreadX > 0.8 && spreadY > 0.8) {
      stats.focalCount++;
      suggestions.push({
        rule: "too-scattered", issue: "元素铺满整屏（无视觉焦点，缺少主次）",
        note: "收敛元素到 1-2 个焦点区域，留白",
      });
    }
  }

  return {
    meta: { elementsAnalyzed: els.length, rule: "no-text-at-center / safe-area / rule-of-thirds / focal-point" },
    stats: stats,
    suggestions: suggestions,
    ok: suggestions.length === 0,
  };
}

function main() {
  const args = parseArgs();
  if (!args.input) {
    console.error("用法: node tools/compose.js <storyboard.json> [--out=suggestions.json]");
    process.exit(1);
  }
  const p = path.resolve(args.input);
  if (!fs.existsSync(p)) { console.error("文件不存在: " + p); process.exit(1); }
  const sb = JSON.parse(fs.readFileSync(p, "utf8"));
  const r = suggestComposition(sb);
  const json = JSON.stringify(r, null, 2);
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), json);
    console.log("=== 构图建议 ===");
    console.log("文件: " + path.resolve(args.out));
    console.log("分析元素: " + r.stats.elements + "  建议数: " + r.suggestions.length);
  } else {
    process.stdout.write(json);
  }
}

module.exports = { parseArgs, suggestComposition, THIRDS, SAFE };
if (require.main === module) main();
