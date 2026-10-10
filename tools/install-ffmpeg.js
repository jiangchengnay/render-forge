#!/usr/bin/env node
// tools/install-ffmpeg.js —— 尝试下载静态 ffmpeg 到项目 bin/
// 注意：网络受限时可能失败。失败不影响浏览器导出 MP4（那条路径零依赖）。
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const binDir = path.join(root, 'bin');
if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

const isWin = process.platform === 'win32';
const target = path.join(binDir, isWin ? 'ffmpeg.exe' : 'ffmpeg');

if (fs.existsSync(target)) { console.log('已存在: ' + target); process.exit(0); }

// 多个镜像源（依次尝试）
const urls = [
  'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip',
  'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
  'https://registry.npmmirror.com/-/binary/ffmpeg-static/ffmpeg-win32-x64.zip',
];

if (!isWin) {
  console.log('请用系统包管理器安装 ffmpeg：');
  console.log('  macOS:  brew install ffmpeg');
  console.log('  Linux:  sudo apt install ffmpeg');
  console.log('');
  console.log('（浏览器导出 MP4 不需要 ffmpeg）');
  process.exit(0);
}

console.log('尝试下载 ffmpeg...（浏览器导出 MP4 不需要它）');
let ok = false;
for (const url of urls) {
  console.log('  源: ' + url);
  try {
    const ps = [
      '[System.Net.ServicePointManager]::SecurityProtocol = \"Tls12,Tls13\";',
      '[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true };',
      '$zip = Join-Path $env:TEMP \"rf-ffmpeg.zip\";',
      'Invoke-WebRequest -Uri \"' + url + '\" -OutFile $zip -UseBasicParsing -TimeoutSec 300;',
      'if ((Get-Item $zip).Length -lt 1000000) { throw \"文件过小\" };',
      '$out = Join-Path $env:TEMP \"rf-ffmpeg-x\";',
      'Remove-Item -Recurse -Force $out -ErrorAction SilentlyContinue;',
      'Expand-Archive -Path $zip -DestinationPath $out -Force;',
      '$exe = Get-ChildItem -Path $out -Recurse -Filter ffmpeg.exe | Select-Object -First 1;',
      'Copy-Item $exe.FullName \"' + target + '\" -Force;',
      'Write-Output ok'
    ].join(' ');
    const out = execSync('powershell -NoProfile -Command "' + ps + '"', { encoding: 'utf8' });
    if (fs.existsSync(target)) { ok = true; break; }
  } catch (e) {
    console.log('   失败，试下一个源');
  }
}

if (ok) {
  console.log('已安装: ' + target);
} else {
  console.log('');
  console.log('自动下载失败（网络受限）。');
  console.log('');
  console.log('影响：仅 npm run render（Node 高质量渲染）需要 ffmpeg。');
  console.log('不影响：浏览器「导出 MP4」按钮（零依赖，直接可用）。');
  console.log('');
  console.log('手动安装：');
  console.log('  1. winget install ffmpeg');
  console.log('  2. 或下载 https://www.gyan.dev/ffmpeg/builds/ 解压，把 ffmpeg.exe 放到 bin/');
  process.exit(0);
}
