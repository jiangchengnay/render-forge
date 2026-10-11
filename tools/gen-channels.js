#!/usr/bin/env node
// tools/gen-channels.js —— 从 dossier 自动生成"视觉强度曲线"等属性频道（P0-1 审美规则切片）。
//
// 把"节奏 → 视觉强度"这条审美规则锁进引擎：AI 不用自己算"哪里该强、哪里该弱"，
// 引擎根据音频的 sections/bands/beats 自动产出一条合理的视觉强度/低音/节拍曲线。
//
// 用法：node tools/gen-channels.js --dossier=dossier.json [--out=channels.json]
// 输出：可直接合并进分镜的 channels 字段。
//
// 纯函数 generateChannels(dossier, opts)，确定性。

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const a = argv || process.argv.slice(2);
  const out = { dossier: null, out: null };
  a.forEach((s) => {
    const m = s.match(/^--([\w-]+)(?:=(.+))?$/);
    if (!m) return;
    if (m[1] === "dossier") out.dossier = m[2];
    else if (m[1] === "out") out.out = m[2];
  });
  return out;
}

// —— 从 dossier 生成属性频道（纯函数，确定性）——
// 规则（锁进引擎的审美原则）：
//   intensity：段落 energy(low/high) → 视觉强度基线，用 catmullRom 平滑，起收淡入淡出
//   bassEnergy：各段 bass 均值 → 低音驱动曲线（鼓点/低频脉动）
//   beatPulse：每个 beat 处脉冲（1 → 衰减），用于卡点
//   buildDrop：识别 build-up（能量上升段）与 drop（能量骤升点）
function generateChannels(dossier, opts) {
  opts = opts || {};
  const audio = (dossier && dossier.audio) || {};
  const duration = audio.duration || (dossier && dossier.meta && dossier.meta.duration) || 0;
  const sections = Array.isArray(audio.sections) ? audio.sections : [];
  const bands = audio.bands_summary || {};
  const beats = Array.isArray(audio.beats) ? audio.beats : [];
  const channels = {};

  // —— intensity：段落能量 → 视觉强度 ——
  if (sections.length) {
    const lowV = opts.lowIntensity != null ? opts.lowIntensity : 0.3;
    const highV = opts.highIntensity != null ? opts.highIntensity : 0.85;
    const keys = [{ t: 0, value: lowV }];
    sections.forEach((s) => {
      const v = s.energy === "high" ? highV : lowV;
      const mid = (s.start + s.end) / 2;
      keys.push({ t: +mid.toFixed(3), value: v });
    });
    if (duration) keys.push({ t: +duration.toFixed(3), value: lowV });
    channels.intensity = { keys: keys, path: "catmullRom", ease: "inOutSine" };
  }

  // —— bassEnergy：各段 bass 均值 → 低频驱动 ——
  if (bands.bass && bands.bass.length) {
    const keys = bands.bass.map((b) => ({ t: +((b.start + b.end) / 2).toFixed(3), value: +(b.mean || 0).toFixed(3) }));
    if (keys.length) channels.bassEnergy = { keys: keys, path: "catmullRom" };
  }

  // —— beatPulse：每个 beat 处脉冲 ——
  if (beats.length) {
    const decay = opts.beatDecay != null ? opts.beatDecay : 0.12; // 秒
    const keys = [];
    beats.forEach((bt) => {
      keys.push({ t: +bt.toFixed(3), value: 1 });
      keys.push({ t: +(bt + decay).toFixed(3), value: 0 });
    });
    channels.beatPulse = { keys: keys, path: "linear" };
  }

  // —— buildDrop：drop 点（能量从 low 跳到 high 处）——
  if (sections.length >= 2) {
    const keys = [{ t: 0, value: 0 }];
    for (let i = 1; i < sections.length; i++) {
      const prev = sections[i - 1], cur = sections[i];
      const isDrop = (prev.energy !== "high" && cur.energy === "high");
      keys.push({ t: +cur.start.toFixed(3), value: isDrop ? 1 : 0 });
    }
    if (duration) keys.push({ t: +duration.toFixed(3), value: 0 });
    channels.buildDrop = { keys: keys, path: "linear" };
  }

  return {
    meta: { generatedFrom: (dossier && dossier.meta && dossier.meta.audioFile) || "dossier", duration: duration, rule: "intensity from section energy; bassEnergy from bands; beatPulse from beats; buildDrop from energy jumps" },
    channels: channels,
  };
}

function main() {
  const args = parseArgs();
  if (!args.dossier) {
    console.error("用法: node tools/gen-channels.js --dossier=dossier.json [--out=channels.json]");
    process.exit(1);
  }
  const dp = path.resolve(args.dossier);
  if (!fs.existsSync(dp)) { console.error("dossier 不存在: " + dp); process.exit(1); }
  const dossier = JSON.parse(fs.readFileSync(dp, "utf8"));
  const result = generateChannels(dossier);
  const names = Object.keys(result.channels);
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), JSON.stringify(result.channels, null, 2));
    console.log("=== 视觉强度曲线已生成 ===");
    console.log("文件: " + path.resolve(args.out));
    console.log("频道: " + names.join(", "));
  } else {
    process.stdout.write(JSON.stringify(result.channels, null, 2));
  }
}

module.exports = { parseArgs, generateChannels };
if (require.main === module) main();
