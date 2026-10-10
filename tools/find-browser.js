#!/usr/bin/env node
// tools/find-browser.js
// 自动探测可用的 Chromium 内核浏览器，供 puppeteer 使用。
// 探测顺序：
//   1. 环境变量 PUPPETEER_EXECUTABLE_PATH
//   2. 环境变量 CHROME_PATH / EDGE_PATH
//   3. 系统 Chrome（多路径）
//   4. 系统 Edge（Windows 10+ 自带）
//   5. 其他 Chromium 内核浏览器（Brave / Vivaldi / Opera / 360 / QQ 等）
//   6. Electron 自带 Chromium（若在 Electron 环境中）
//   7. puppeteer 自带的 chrome（.cache/puppeteer）
// 返回 { path, name } 或 null。

const fs = require("fs");
const path = require("path");
const os = require("os");

const IS_WIN = process.platform === "win32";
const IS_MAC = process.platform === "darwin";

// Windows 常见安装路径
function winPaths() {
  const pf = process.env["ProgramFiles"] || "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const local = process.env["LOCALAPPDATA"] || path.join(os.homedir(), "AppData", "Local");
  const roaming = process.env["APPDATA"] || path.join(os.homedir(), "AppData", "Roaming");
  return [
    // Chrome
    { p: path.join(pf, "Google", "Chrome", "Application", "chrome.exe"), name: "Chrome" },
    { p: path.join(pf86, "Google", "Chrome", "Application", "chrome.exe"), name: "Chrome" },
    { p: path.join(local, "Google", "Chrome", "Application", "chrome.exe"), name: "Chrome" },
    // Edge（Win10+ 自带）
    { p: path.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"), name: "Edge" },
    { p: path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"), name: "Edge" },
    // Brave
    { p: path.join(pf, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"), name: "Brave" },
    { p: path.join(pf86, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"), name: "Brave" },
    // Vivaldi
    { p: path.join(local, "Vivaldi", "Application", "vivaldi.exe"), name: "Vivaldi" },
    // Opera
    { p: path.join(local, "Programs", "Opera", "opera.exe"), name: "Opera" },
    // 360 极速/安全
    { p: path.join(pf86, "360", "360Chrome", "Chrome", "Application", "360chrome.exe"), name: "360Chrome" },
    // QQ 浏览器
    { p: path.join(pf, "Tencent", "QQBrowser", "QQBrowser.exe"), name: "QQBrowser" },
    // 搜狗
    { p: path.join(pf86, "SogouExplorer", "SogouExplorer.exe"), name: "Sogou" },
  ];
}

function macPaths() {
  return [
    { p: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", name: "Chrome" },
    { p: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", name: "Edge" },
    { p: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", name: "Brave" },
    { p: "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi", name: "Vivaldi" },
    { p: "/Applications/Chromium.app/Contents/MacOS/Chromium", name: "Chromium" },
  ];
}

function linuxPaths() {
  return [
    { p: "/usr/bin/google-chrome", name: "Chrome" },
    { p: "/usr/bin/google-chrome-stable", name: "Chrome" },
    { p: "/usr/bin/microsoft-edge", name: "Edge" },
    { p: "/usr/bin/microsoft-edge-stable", name: "Edge" },
    { p: "/usr/bin/chromium", name: "Chromium" },
    { p: "/usr/bin/chromium-browser", name: "Chromium" },
    { p: "/usr/bin/brave-browser", name: "Brave" },
  ];
}

function exists(p) {
  try { return fs.existsSync(p); } catch (e) { return false; }
}

function findBrowser() {
  // 1. 环境变量优先
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || process.env.EDGE_PATH;
  if (envPath && exists(envPath)) {
    return { path: envPath, name: "env:" + path.basename(envPath) };
  }

  // 2. 系统浏览器
  let candidates = [];
  if (IS_WIN) candidates = winPaths();
  else if (IS_MAC) candidates = macPaths();
  else candidates = linuxPaths();

  for (const c of candidates) {
    if (exists(c.p)) return { path: c.p, name: c.name };
  }

  // 3. Electron 自带 Chromium
  // 若在 Electron 环境运行，process.versions.electron 存在
  if (process.versions && process.versions.electron) {
    // Electron 的 chromium 通过 electron 命令启动，puppeteer 可用 electron 模式
    return { path: process.execPath, name: "Electron", electron: true };
  }

  // 4. puppeteer 缓存
  const home = os.homedir();
  const cacheDirs = [
    path.join(home, ".cache", "puppeteer"),
    path.join(home, "AppData", "Local", "puppeteer"),
    path.join(home, "Library", "Caches", "puppeteer"),
  ];
  for (const dir of cacheDirs) {
    if (!exists(dir)) continue;
    try {
      const entries = fs.readdirSync(dir);
      for (const e of entries) {
        // chrome/win64-xxx/chrome-win64/chrome.exe
        const base = path.join(dir, e);
        const sub = fs.readdirSync(base);
        for (const s of sub) {
          const inner = path.join(base, s);
          const candidates2 = IS_WIN
            ? [path.join(inner, "chrome-win64", "chrome.exe"), path.join(inner, "chrome-win32", "chrome.exe"), path.join(inner, "chrome.exe")]
            : IS_MAC
            ? [path.join(inner, "chrome-mac-x64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing")]
            : [path.join(inner, "chrome-linux64", "chrome"), path.join(inner, "chrome")];
          for (const c2 of candidates2) {
            if (exists(c2)) return { path: c2, name: "puppeteer-cache" };
          }
        }
      }
    } catch (e) { /* ignore */ }
  }

  return null;
}

// 生成 puppeteer 启动参数
function puppeteerLaunchOptions(extra) {
  const b = findBrowser();
  const opts = Object.assign({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] }, extra || {});
  if (b) {
    opts.executablePath = b.path;
    if (b.electron) opts.args.push("--disable-gpu");
  }
  return { options: opts, browser: b };
}

module.exports = { findBrowser, puppeteerLaunchOptions };

if (require.main === module) {
  const b = findBrowser();
  if (b) console.log("找到浏览器: " + b.name + " → " + b.path);
  else console.log("未找到可用浏览器");
}
