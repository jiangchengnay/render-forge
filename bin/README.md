# bin/

放置 ffmpeg 二进制（可选）。

## 自动获取

```bash
npm run install-ffmpeg   # 下载到本目录
```

## 手动获取

- Windows: https://www.gyan.dev/ffmpeg/builds/ 下载 essentials 版，把 ffmpeg.exe 放这里
- macOS/Linux: `brew install ffmpeg` 或 `apt install ffmpeg`（系统级，无需放这里）

## 说明

- 浏览器导出 MP4 **不需要** ffmpeg
- 只有 `npm run render`（Node 高质量渲染）需要
- 缺 ffmpeg 时 render.js 会给出安装指引
