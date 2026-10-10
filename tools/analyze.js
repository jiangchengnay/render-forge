#!/usr/bin/env node
// tools/analyze.js —— L1 分析层：dossier（分析素材包）构建器。
//
// 职责（确定性，不碰 LLM）：
//   1. 用 puppeteer 载入 index.html，复用 RF.Audio 分析音频（tempo/beats/onsets/sections/bands/phrases/interludes）。
//   2. 解析歌词（纯文本 / SRT）。
//   3. 透传 L0 创作宪法，附上动画设计预设库。
//   4. 把音频数据「浓缩」（只保留区间/数组摘要，丢弃每帧原始数组），控制体积。
//   5. 输出 dossier.json（供外部 LLM 读）。
//
// 用法：
//   node tools/analyze.js --audio=bgm.mp3 [--lyrics=lyrics.txt] [--constitution=constitution.json] [--out=dossier.json]
//
// 可被 require：buildDossier / condenseAudio / parseLyrics 为纯函数（不依赖 puppeteer）。

const fs = require("fs");
const path = require("path");
const http = require("http");
const { puppeteerLaunchOptions } = require("./find-browser");

const ROOT = path.resolve(__dirname, "..");

// ========== 参数解析 ==========
function parseArgs(argv) {
  const a = argv || process.argv.slice(2);
  const out = { audio: null, lyrics: null, constitution: null, out: null };
  a.forEach((s) => {
    const m = s.match(/^--(\w+)(?:=(.+))?$/);
    if (!m) return;
    const k = m[1], v = m[2];
    if (k === "audio") out.audio = v;
    else if (k === "lyrics") out.lyrics = v;
    else if (k === "constitution") out.constitution = v;
    else if (k === "out") out.out = v;
  });
  return out;
}

// ========== 歌词解析（纯函数）==========
// 支持两种输入：
//   1) 纯文本：每行一句（自动跳过空行）。
//   2) SRT：形如
//        1
//        00:00:00,000 --> 00:00:02,000
//        歌词文字
// 返回 [{ index, text, start?, end? }]（start/end 仅 SRT 有）。
function parseLyrics(text) {
  if (text == null) return [];
  const raw = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const isSrt = /-->/.test(raw);
  const lines = [];
  if (isSrt) {
    const blocks = raw.split(/\n\s*\n/);
    blocks.forEach((b) => {
      const seg = b.split("\n").map((s) => s.trim()).filter(Boolean);
      if (seg.length < 2) return;
      // 找时间行
      let timeIdx = -1;
      for (let i = 0; i < seg.length; i++) { if (/-->/.test(seg[i])) { timeIdx = i; break; } }
      if (timeIdx < 0) return;
      const tm = seg[timeIdx].match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/);
      if (!tm) return;
      const toSec = (h, m, s, ms) => (+h) * 3600 + (+m) * 60 + (+s) + (+ms) / 1000;
      const start = toSec(tm[1], tm[2], tm[3], tm[4]);
      const end = toSec(tm[5], tm[6], tm[7], tm[8]);
      const txt = seg.slice(timeIdx + 1).join(" ").trim();
      if (!txt) return;
      lines.push({ text: txt, start: +start.toFixed(3), end: +end.toFixed(3) });
    });
  } else {
    raw.split("\n").forEach((l) => {
      const t = l.trim();
      if (t) lines.push({ text: t });
    });
  }
  // 编号
  lines.forEach((l, i) => { l.index = i + 1; });
  // 统一字段顺序：index, text, [start], [end]
  return lines.map((l) => {
    const o = { index: l.index, text: l.text };
    if (l.start != null) { o.start = l.start; o.end = l.end; }
    return o;
  });
}

// ========== 音频数据浓缩（纯函数）==========
// 输入为 RF.Audio.analyzeChannel 的完整结果（含每帧 rms/flux/energy/bands 数组），
// 输出为「体积可控」的摘要：丢弃每帧原始数组，只留区间 / 数组 / 分频段段落统计。
//   - tempo: 数字
//   - beats / onsets: 时间数组（保留，分析师需要节拍点）
//   - sections: [{start,end,type,energy}]，energy 由 0/1 映射为 low/high
//   - bands_summary: 每个频段按 section 给出 {start,end,mean,peak}
//   - phrases / interludes: [{start,end}]（来自 vocal）
//   - duration / hopDuration
function condenseAudio(analysis) {
  if (!analysis) return null;
  const round3 = (x) => Math.round(x * 1000) / 1000;
  const sections = (analysis.sections || []).map((s) => ({
    start: s.start, end: s.end, type: s.type,
    energy: s.energy === 1 ? "high" : "low",
  }));
  // 分频段：按 section 区间统计均值/峰值
  const bandsSummary = {};
  const hop = analysis.hopDuration || 1 / 60;
  const srcBands = (analysis.bands || {});
  ["bass", "mid", "treble"].forEach((name) => {
    const arr = srcBands[name] || [];
    bandsSummary[name] = sections.map((sec) => {
      const i0 = Math.max(0, Math.round(sec.start / hop));
      const i1 = Math.min(arr.length, Math.round(sec.end / hop));
      let sum = 0, peak = 0, n = 0;
      for (let i = i0; i < i1; i++) { const v = arr[i]; sum += v; if (v > peak) peak = v; n++; }
      return { start: sec.start, end: sec.end, mean: n ? round3(sum / n) : 0, peak: round3(peak) };
    });
  });
  const phrases = ((analysis.vocal && analysis.vocal.phrases) || []).map((p) => ({ start: p.start, end: p.end }));
  const interludes = ((analysis.vocal && analysis.vocal.interludes) || []).map((p) => ({ start: p.start, end: p.end }));
  return {
    duration: round3(analysis.duration || 0),
    tempo: Math.round(analysis.tempo || 0),
    beats: (analysis.beats || []).map(round3),
    onsets: (analysis.onsets || []).map(round3),
    sections,
    bands_summary: bandsSummary,
    phrases, interludes,
  };
}

// ========== dossier 组装（纯函数）==========
// 注意：lyrics 若为纯文本且音频有 phrases 且数量一致，则把 phrases 的时间对齐到每句（best-effort）。
function buildDossier(opts) {
  opts = opts || {};
  const meta = Object.assign({
    generatedAt: new Date().toISOString(),
    audioFile: opts.audioFile || "",
    duration: opts.audio ? opts.audio.duration : 0,
  }, opts.meta || {});

  const lyrics = (opts.lyrics || []).slice();
  const audio = opts.audio || null;
  if (audio && audio.phrases && audio.phrases.length === lyrics.length && lyrics.length > 0) {
    const anyTime = lyrics.some((l) => l.start != null);
    if (!anyTime) {
      for (let i = 0; i < lyrics.length; i++) {
        lyrics[i].start = audio.phrases[i].start;
        lyrics[i].end = audio.phrases[i].end;
      }
    }
  }

  return {
    meta,
    song: {
      title: (opts.title || "").toString(),
      lyricsAvailable: lyrics.length > 0,
    },
    audio,
    lyrics,
    constitution: opts.constitution != null ? opts.constitution : {},
    presets: opts.presets || [],
  };
}

// ========== 音频分析（puppeteer，复用 RF.Audio）==========
function startServer(root, audioPath) {
  const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
    ".css": "text/css", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4",
    ".aac": "audio/aac", ".ogg": "audio/ogg" };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]);
      if (p === "/__audio") {
        if (!audioPath || !fs.existsSync(audioPath)) { res.writeHead(404); res.end("no audio"); return; }
        res.writeHead(200, { "Content-Type": MIME[path.extname(audioPath)] || "application/octet-stream" });
        fs.createReadStream(audioPath).pipe(res);
        return;
      }
      if (p === "/") p = "/index.html";
      const file = path.join(root, p);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end("not found"); return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

async function analyzeAudioFile(audioPath) {
  let puppeteer;
  try { puppeteer = require("puppeteer"); }
  catch (e) { throw new Error("缺少 puppeteer: npm i puppeteer"); }
  const { server, port } = await startServer(ROOT, audioPath);
  const url = "http://127.0.0.1:" + port + "/index.html";
  const audioUrl = "http://127.0.0.1:" + port + "/__audio";
  const launchInfo = puppeteerLaunchOptions();
  const browser = await puppeteer.launch(launchInfo.options);
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0" });
    const result = await page.evaluate(async (au) => {
      const resp = await fetch(au); const ab = await resp.arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = await ctx.decodeAudioData(ab.slice(0)); await ctx.close();
      const mono = RF.Audio.monoFromBuffer(buf);
      const analysis = RF.Audio.analyzeChannel(mono, buf.sampleRate);
      analysis.vocal = RF.Audio.detectVocal(mono, buf.sampleRate);
      analysis.duration = buf.duration;
      return analysis;
    }, audioUrl);
    return result;
  } finally {
    await browser.close();
    server.close();
  }
}

// ========== CLI ==========
async function main() {
  const args = parseArgs();
  if (!args.audio) {
    console.error("用法: node tools/analyze.js --audio=bgm.mp3 [--lyrics=lyrics.txt] [--constitution=constitution.json] [--out=dossier.json]");
    process.exit(1);
  }
  const audioPath = path.resolve(args.audio);
  if (!fs.existsSync(audioPath)) { console.error("音频文件不存在: " + audioPath); process.exit(1); }

  const lyricsText = args.lyrics ? fs.readFileSync(path.resolve(args.lyrics), "utf8") : "";
  const lyrics = parseLyrics(lyricsText);

  let constitution = {};
  if (args.constitution) {
    const cp = path.resolve(args.constitution);
    if (fs.existsSync(cp)) constitution = JSON.parse(fs.readFileSync(cp, "utf8"));
    else console.error("[警告] 创作宪法不存在，留空: " + cp);
  }

  const presetsPath = path.join(ROOT, "dsl", "presets", "animation-presets.json");
  let presets = [];
  if (fs.existsSync(presetsPath)) {
    try { presets = (JSON.parse(fs.readFileSync(presetsPath, "utf8")).presets) || []; } catch (e) { /* ignore */ }
  }

  console.log("分析音频: " + audioPath);
  const raw = await analyzeAudioFile(audioPath);
  const audio = condenseAudio(raw);
  const title = path.basename(audioPath).replace(/\.[^.]+$/, "");

  const dossier = buildDossier({
    meta: { audioFile: path.basename(audioPath), duration: raw.duration },
    title,
    audio,
    lyrics,
    constitution,
    presets,
  });

  const json = JSON.stringify(dossier, null, 2);
  if (args.out) {
    const outPath = path.resolve(args.out);
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, json);
    console.log("=== dossier 已生成 ===");
    console.log("文件: " + outPath);
    console.log("时长: " + audio.duration + "s  速度: " + audio.tempo + "BPM");
    console.log("段落: " + audio.sections.length + "  节拍: " + audio.beats.length + "  乐句: " + audio.phrases.length);
    console.log("歌词: " + lyrics.length + " 句");
    console.log("体积: " + Math.round(json.length / 1024) + " KB");
  } else {
    process.stdout.write(json);
  }
}

module.exports = { parseArgs, parseLyrics, condenseAudio, buildDossier };

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
