# Render Forge

让普通 LLM 也能产出接近 Opus 级**程序化渲染动画**的框架。

## 核心思路

AI 只输出 JSON 分镜 → 确定性引擎渲染 → 批评循环迭代 → 导出成片。

把「审美判断」「长程编排」「图形学知识」从 AI 手里拿走，锁进确定性引擎。

## 快速开始（零依赖）

```bash
# 直接双击 index.html，或用本地服务
npm run serve    # 访问 http://localhost:5173
```

打开后可：
- 拖入分镜 JSON 播放
- 点「♪ 载入音频」自动分析节拍（分镜用 `at: "beat:4"` 卡点）
- 点「⬆ 载入素材」导入图片/视频/SVG
- 点「⤓ 导出 MP4」出片（**无需 ffmpeg**）
- 点「⤓ 逐帧导出」出 WebM（精确帧率）

## 能力总览

| 维度 | 数量/内容 |
|---|---|
| 效果/组件 | 58（+ 插件系统，可无限扩展） |
| 单元测试 | 137 个全通过 |
| 后处理 | 7（bloom 走 WebGL2） |
| 转场 | 9 |
| 配色 | 13 套 |
| 模板 | 4（product-launch / open-source / music-video / data-story） |
| 片段库 | 4（brand-intro / feature-list / metrics / cta-outro） |
| 系统 | 音频分析 / 中文排版 / 素材导入 / SRT 字幕 / 表达式 / 布局 / 分组 / 镜头 / 批评 / 推荐 / 插件 |

## 三种写分镜的方式

### A) 片段库（最快，4 行出一个产品片）

```json
{
  "meta": { "title": "Demo", "duration": 12 },
  "palette": "deepSea",
  "acts": [
    { "include": "brand-intro", "slots": { "title": "品牌名" } },
    { "include": "feature-list", "slots": { "items": ["特性1", "特性2"] } },
    { "include": "metrics", "slots": { "value": 100 } },
    { "include": "cta-outro", "slots": { "title": "npm i x" } }
  ]
}
```

### B) 模板（改文案）

```json
{ "template": "product-launch", "slots": { "brand": "X", "tagline": "...", "features": [...] } }
```

### C) 手写 acts（完全控制）

见 `dsl/AI-GUIDE.md`。

## 素材清单（可打包的工程）

```json
{
  "assets": [
    { "id": "logo", "src": "./logo.png" },
    { "id": "demo", "src": "./screen.mp4" }
  ],
  "acts": [{ "tracks": [{ "effect": "image", "params": { "src": "logo" } }] }]
}
```

素材与分镜一起打包 = 完整工程。视频会逐帧预解码（确定性）。

> `assets` 由 `RF.Media.loadStoryboardAssets` 加载，导出时自动处理（图片/svg/视频/字体）。

字幕用 `subtitles` 清单声明，导出时自动加载 SRT：
```json
{ "subtitles": [{ "id": "s1", "src": "./sub.srt" }],
  "acts": [{ "tracks": [{ "effect": "subtitle", "params": { "src": "s1" } }] }] }
```

## 导出

| 方式 | 依赖 | 输出 |
|---|---|---|
| 浏览器「导出 MP4」 | 无 | mp4（含音轨） |
| 浏览器「逐帧导出」 | 无 | WebM（精确帧率） |
| `npm run export` | puppeteer | mp4（WebCodecs 页内编码，零 ffmpeg，快） |
| `npm run render` | puppeteer + ffmpeg | mp4（旧路径，需 ffmpeg） |

> Node 渲染需要 ffmpeg：`npm run install-ffmpeg` 自动下载到 `bin/`（或系统安装）。浏览器导出**不需要**。

## 批评闭环（完整）

```bash
npm run critique -- x.json                # 报告（含关键帧指标 + contact sheet）
npm run patch -- x.json report.json       # 修改方案
npm run apply-patch -- x.json patch.json  # 应用 → x.patched.json
npm run render -- x.patched.json out.mp4
```

或通过 MCP：`rf_critique` → `rf_apply_patch` → `rf_render`

## MCP 集成

```bash
npm run mcp   # 启动 MCP Server（stdio）
```

提供 8 个工具：`rf_list` / `rf_schema` / `rf_generate` / `rf_validate` / `rf_recommend` / `rf_critique` / `rf_apply_patch` / `rf_render`

任何支持 MCP 的 AI 都能完整驱动框架。

## 完整工具链

```bash
npm run gen-manifest         # 更新 index.html script 区块
npm run sync-effects         # 同步效果快照（供校验用）
npm run test                 # 单元测试
npm run validate -- x.json   # DSL 校验
npm run critique -- x.json   # 批评
npm run patch -- x.json r.json  # 生成修改方案
npm run apply-patch -- x.json p.json  # 应用
npm run render -- x.json out.mp4  # 渲染
npm run find-browser         # 探测浏览器
npm run find-ffmpeg          # 探测 ffmpeg
npm run install-ffmpeg       # 自动装 ffmpeg
npm run mcp                  # MCP Server
npm run vision -- sheet.jpg  # 视觉模型批评
npm run serve                # 本地服务
```

## 文档

- `dsl/AI-GUIDE.md` — 给 AI 的完整生成指南
- `dsl/SCHEMA-BRIEF.md` — DSL 速览（首轮读）
- `dsl/EFFECTS.md` — 58 效果分类速查
- `dsl/TEMPLATE-SLOTS.md` — 模板 slots
- `dsl/schemas/storyboard.schema.md` — 全量规范
- `dsl/CONTEXT-GUIDE.md` / `dsl/ANALYSIS-GUIDE.md` / `dsl/ORCHESTRATION-GUIDE.md` — L0 语境叙事 / L1 分析层 / L2-L4 编排使用指南
- `ARCHITECTURE.md` / `WORKFLOW.md` — 五层架构 / 完整工作流
- `PROGRESS.md` — 跨会话记忆（含四份诊断报告对照）
- `dsl/examples/` — 21 个示例

## 浏览器要求

Chrome / Edge / Brave / Vivaldi / Opera 等 Chromium 内核（自动探测）。

## 许可

MIT
