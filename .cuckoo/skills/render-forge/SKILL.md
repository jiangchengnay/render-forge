---
name: render-forge
description: 用 render-forge 做程序化渲染动画（产品片/音乐PV/数据故事）。用户想"做视频/做动画/做MV/做个片头"时使用。
---

# Render Forge 使用技能

Render Forge 是「AI 只输出 JSON 分镜 → 确定性引擎渲染 → 导出 mp4」的程序化动画框架，项目位于 <project-dir>。

## 两种用法

### 路线 A：单分镜（快）
1. 读 dsl/AI-GUIDE.md + dsl/SCHEMA-BRIEF.md 了解 DSL
2. 写一个完整分镜 JSON（或从 dsl/examples/ 挑一个改）
3. `node tools/export-webcodecs.js my.json out.mp4 --fps=30 [--audio=bgm.mp3]`

### 路线 B：多 Agent 编排（音乐 PV 等复杂片）
五层流水线 L0→L4，每层有工具 + prompt 模板：
- **L0** 语境与叙事：`tools/build-l0-input.js` → prompts/context-analyst 等 → `tools/resolve-conflict.js` → prompts/constitution-writer → constitution.json
- **L1** 分析：`tools/analyze.js` → prompts/music-analyst 等 → report.json
- **L2** 决策：`tools/build-plan-input.js` → prompts/planner → plan.json
- **L3** 执行：`tools/assign-task.js` → prompts/worker → fragments/*.json
- **L4** 组装：`tools/assemble.js` → storyboard.json → 渲染

框架**不碰 LLM/网络**：工具准备输入包，你把 prompt 模板 + 输入包交给 AI，拿回输出存盘，再跑工具校验。

## 关键命令
- `npm run verify` — 一键全验证（docs/commands/test/e2e）
- `npm run e2e` — 端到端集成验证（L0→L4 可复现）
- `npm run export -- x.json out.mp4` — 出片（零 ffmpeg）
- `npm run validate -- x.json` — 校验分镜
- `npm run mcp` — 启动 MCP server（已挂到 Cuckoo）

## 完整流程走查
见 USAGE.md 第 7 节。各层细节见 dsl/CONTEXT-GUIDE.md / ANALYSIS-GUIDE.md / ORCHESTRATION-GUIDE.md。

## 注意
- 冲突询问只在"用户意图 vs 歌曲本意冲突"时触发，默认零交互。
- 映射分析师只到"动作候选"，不指定效果名（红线）。
- 效果库 58 个，见 dsl/EFFECTS.md。
