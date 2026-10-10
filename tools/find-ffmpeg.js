#!/usr/bin/env node
// tools/find-ffmpeg.js —— 跨平台探测 ffmpeg
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

function findFfmpeg() {
  // 1. 环境变量
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return { path: process.env.FFMPEG_PATH, source: "env" };
  }
  // 2. PATH（which/where）
  try {
    const cmd = process.platform === "win32" ? "where ffmpeg" : "which ffmpeg";
    const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (out) {
      const first = out.split(/\r?\n/)[0].trim();
      if (first && fs.existsSync(first)) return { path: first, source: "PATH" };
    }
  } catch (e) { /* 未找到 */ }
  // 2.5 项目 bin/（最高优先，随项目携带）
  const projectBin = path.join(__dirname, "..", "bin", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  if (fs.existsSync(projectBin)) return { path: projectBin, source: "project-bin" };
  // 3. ffmpeg-static（npm 包，返回绝对路径）
  try {
    const staticPath = require("ffmpeg-static");
    if (staticPath && fs.existsSync(staticPath)) return { path: staticPath, source: "ffmpeg-static" };
  } catch (e) { /* 未装 */ }
  // 4. 项目本地
  const localCandidates = [
    path.join(__dirname, "..", "bin", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
    path.join(__dirname, "..", "node_modules", "@ffmpeg-installer", process.platform + "-" + process.arch, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
  ];
  for (const c of localCandidates) {
    if (fs.existsSync(c)) return { path: c, source: "local" };
  }
  // 4. 常见安装路径
  const common = [];
  if (process.platform === "win32") {
    common.push(
      "C:\\ffmpeg\\bin\\ffmpeg.exe",
      path.join(os.homedir(), "scoop", "shims", "ffmpeg.exe"),
      path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WinGet", "Links", "ffmpeg.exe"),
    );
  } else {
    common.push("/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg", "/opt/homebrew/bin/ffmpeg");
  }
  for (const c of common) {
    if (c && fs.existsSync(c)) return { path: c, source: "common" };
  }
  return null;
}

module.exports = { findFfmpeg };

if (require.main === module) {
  const r = findFfmpeg();
  if (r) console.log("找到 ffmpeg: " + r.source + " → " + r.path);
  else {
    console.log("未找到 ffmpeg。");
    console.log("安装方式：");
    console.log("  Windows: winget install ffmpeg  或  scoop install ffmpeg");
    console.log("  macOS:   brew install ffmpeg");
    console.log("  Linux:   sudo apt install ffmpeg");
    console.log("  或运行:  npm run install-ffmpeg（自动下载到项目 bin/）");
  }
}
