#!/usr/bin/env node
// tools/build-l0-input.js —— L0 语境与叙事层：输入包构建器。
//
// 职责（确定性，不碰 LLM、不碰网络）：
//   1. 读用户需求文本（必填）。
//   2. 读音频元信息（可选，复用 analyze.js 的音频分析得到时长；不重跑全分析时退化为文件名）。
//   3. 读歌词（可选）。
//   4. 从需求/音频元信息提取歌曲名与艺术家，自动生成一组「搜索指令」（搜索查询词）。
//   5. 输出 L0 输入包（含占位符字段，供平台填搜索结果）。
//
// 用法：
//   node tools/build-l0-input.js --request=req.txt [--audio=bgm.mp3] [--lyrics=lyrics.txt] [--out=l0-input.json]
//
// 可被 require：extractSongInfo / buildSearchQueries / buildL0Input 为纯函数。

const fs = require("fs");
const path = require("path");
const { parseLyrics } = require("./analyze.js");

// ========== 参数解析 ==========
function parseArgs(argv) {
  const a = argv || process.argv.slice(2);
  const out = { request: null, audio: null, lyrics: null, out: null };
  a.forEach((s) => {
    const m = s.match(/^--(\w+)(?:=(.+))?$/);
    if (!m) return;
    const k = m[1], v = m[2];
    if (k === "request") out.request = v;
    else if (k === "audio") out.audio = v;
    else if (k === "lyrics") out.lyrics = v;
    else if (k === "out") out.out = v;
  });
  return out;
}

// ========== 歌曲信息提取（纯函数）==========
// 从需求文本中尽力提取「歌名 - 艺术家」。支持常见写法：
//   《歌名》、"歌名"、用「歌名」、歌名 by 艺术家、歌名 - 艺术家
// 无法提取时返回 { title: "", artist: "" }。
function extractSongInfo(requestText, audioFile) {
  const text = (requestText || "").toString();
  let title = "";
  let artist = "";
  // 优先：中文书名号
  let m = text.match(/《([^》]{1,60})》/);
  if (m) title = m[1].trim();
  // 其次：引号
  if (!title) {
    m = text.match(/[“"「]([^”"」]{1,60})[”"」]/);
    if (m) title = m[1].trim();
  }
  // 艺术家：title 后面的 " - xxx" / " by xxx" / "·xxx"
  if (title) {
    const after = text.slice(text.indexOf(title) + title.length);
    let am = after.match(/^[》」”"'\s]*(?:-|—|–|by|BY|·)\s*([^\s，。,.；;、]{1,40})/);
    if (am) artist = am[1].trim();
  }
  // 兜底：用音频文件名（去扩展名、去常见后缀）
  if (!title && audioFile) {
    title = path.basename(audioFile).replace(/\.[^.]+$/, "").trim();
  }
  return { title, artist };
}

// ========== 搜索指令生成（纯函数）==========
// 根据歌名/艺术家生成一组搜索查询词。框架不自己搜，这是「该搜什么」的结构化描述。
// 返回 { queries: string[], note: string }。
function buildSearchQueries(songInfo) {
  const info = songInfo || {};
  const title = (info.title || "").trim();
  const artist = (info.artist || "").trim();
  if (!title) {
    return {
      queries: [],
      note: "未能从需求/音频中提取歌名，无法生成搜索指令。请平台据用户需求自行判断该搜什么。",
    };
  }
  const base = artist ? title + " " + artist : title;
  const queries = [
    base + " 创作背景",
    base + " 歌词含义",
    base + " 解析",
    base + " 创作意图 访谈",
    base + " 歌词 解读",
  ];
  return {
    queries: queries,
    note: "框架不自己搜：以上为搜索指令（查询词），实际执行联网搜索的是平台。搜索后把结果填入 song_context 字段，并把实际用过的词记入 search_queries_used。",
  };
}

// ========== L0 输入包组装（纯函数）==========
// opts: { userRequest, audioMeta, lyrics, songInfo, searchQueries, source }
function buildL0Input(opts) {
  opts = opts || {};
  const songInfo = opts.songInfo || { title: "", artist: "" };
  const search = opts.searchQueries || buildSearchQueries(songInfo);
  const lyrics = opts.lyrics || [];
  return {
    meta: Object.assign({
      generatedAt: new Date().toISOString(),
      source: opts.source || "build-l0-input",
    }, opts.meta || {}),
    // 用户需求原文（必填）
    user_request: opts.userRequest != null ? String(opts.userRequest) : "",
    // 歌曲信息（从需求或音频提取）
    song: {
      title: songInfo.title || "",
      artist: songInfo.artist || "",
    },
    // 音频元信息（可选）
    audio_meta: opts.audioMeta || null,
    // 歌词（可选）
    lyrics: lyrics,
    // 用户粘贴的解读（由平台/用户填，初始空）
    user_pasted: opts.userPasted != null ? String(opts.userPasted) : "",
    // 搜索指令（框架生成，平台执行）
    search_queries: search.queries,
    search_note: search.note,
    // 搜索结果占位符（平台填）
    placeholders: {
      song_context: {
        factual_background: "",
        cultural_roots: "",
        known_interpretations: [],
        search_queries_used: [],
      },
      lyrics_scan: { summary: "", overall_tone: "" },
      user_intent: { stated: "", implied: "", pasted: "", narrative_style: "" },
    },
  };
}

// ========== CLI ==========
function main() {
  const args = parseArgs();
  if (!args.request) {
    console.error("用法: node tools/build-l0-input.js --request=req.txt [--audio=bgm.mp3] [--lyrics=lyrics.txt] [--out=l0-input.json]");
    process.exit(1);
  }
  const reqPath = path.resolve(args.request);
  if (!fs.existsSync(reqPath)) { console.error("需求文件不存在: " + reqPath); process.exit(1); }
  const userRequest = fs.readFileSync(reqPath, "utf8");

  // 音频：只取文件名做元信息（不重跑全分析；如需时长，平台可另跑 analyze.js）
  let audioMeta = null;
  let audioFile = null;
  if (args.audio) {
    const ap = path.resolve(args.audio);
    if (fs.existsSync(ap)) {
      audioFile = path.basename(ap);
      audioMeta = { file: audioFile };
    } else {
      console.error("[警告] 音频不存在，忽略: " + ap);
    }
  }

  // 歌词
  let lyrics = [];
  if (args.lyrics) {
    const lp = path.resolve(args.lyrics);
    if (fs.existsSync(lp)) lyrics = parseLyrics(fs.readFileSync(lp, "utf8"));
    else console.error("[警告] 歌词不存在，忽略: " + lp);
  }

  const songInfo = extractSongInfo(userRequest, audioFile);
  const search = buildSearchQueries(songInfo);
  const pkg = buildL0Input({
    userRequest, audioMeta, lyrics, songInfo, searchQueries: search,
    source: "build-l0-input",
  });

  const json = JSON.stringify(pkg, null, 2);
  if (args.out) {
    const outPath = path.resolve(args.out);
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, json);
    console.log("=== L0 输入包已生成 ===");
    console.log("文件: " + outPath);
    console.log("歌名: " + (songInfo.title || "(未提取到)") + "  艺术家: " + (songInfo.artist || "(未提取到)"));
    console.log("搜索指令: " + search.queries.length + " 条" + (search.queries.length ? " → " + search.queries[0] : ""));
    console.log("歌词: " + lyrics.length + " 句");
    console.log("体积: " + Math.round(json.length / 1024) + " KB");
  } else {
    process.stdout.write(json);
  }
}

module.exports = { parseArgs, extractSongInfo, buildSearchQueries, buildL0Input };

if (require.main === module) main();
