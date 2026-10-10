# Render Forge — 项目总览

> 一页看懂整个项目。

## 一句话

让普通 LLM 通过输出 JSON 分镜，就能产出接近 Opus 级程序化渲染动画的框架。

## 核心理念

把「审美判断」「长程编排」「图形学知识」从 AI 手里拿走，锁进确定性引擎。
AI 只产出 JSON，引擎负责一切渲染。

## 三种写分镜的方式（由易到难）

1. **片段库**（4 行出一个产品片）
2. **模板**（填 slots）
3. **手写 acts**（完全控制）

## 工作流

```
写分镜 JSON
    ↓
浏览器预览（拖入即可）
    ↓
批评工具评估（npm run critique）
    ↓
生成补丁方案（npm run patch）
    ↓
应用补丁（npm run apply-patch）
    ↓
导出 MP4（浏览器点按钮，无需 ffmpeg）
```

## 或让 AI 全自动（MCP）

```
AI → rf_generate（生成分镜）
   → rf_validate（校验）
   → rf_critique（批评）
   → rf_apply_patch（改）
   → rf_render（出片）
```

## 能力清单

| 类别 | 内容 |
|---|---|
| 效果 | 58（+ 插件系统） |
| 后处理 | 7 |
| 转场 | 9 |
| 模板 | 4 |
| 片段库 | 4 |
| 配色 | 13 |
| 音频 | FFT + 节拍检测 + downbeat |
| 排版 | 中文断行 + 避头尾 + 安全区 |
| 素材 | image / video（预解码）/ svg |
| 字幕 | SRT |
| 表达式 | =t*0.5 · =audio.rms |
| 布局 | 九宫格锚点 |
| 编排 | 分组 / 镜头 / 关键帧 |
| 导出 | MP4（零依赖）/ WebM / ffmpeg |
| 集成 | MCP（8 工具） |

## 目录导航

| 想做什么 | 看哪个文件 |
|---|---|
| 快速上手 | README.md |
| 让 AI 写分镜 | dsl/AI-GUIDE.md |
| 查 DSL 速览 | dsl/SCHEMA-BRIEF.md |
| 选效果 | dsl/EFFECTS.md |
| 用模板 | dsl/TEMPLATE-SLOTS.md |
| 看示例 | dsl/examples/ |
| 了解历史 | PROGRESS.md |
| 深入规范 | dsl/schemas/storyboard.schema.md |

## 零依赖起步

```bash
git clone <repo>
cd render-forge
npm run serve
# 打开 http://localhost:5173，拖入任意 dsl/examples/*.json
```

## 可选增强（装依赖）

```bash
npm i puppeteer       # Node 渲染 + 批评管线
npm run install-ffmpeg # 高质量 mp4 编码
```

## 许可

MIT
