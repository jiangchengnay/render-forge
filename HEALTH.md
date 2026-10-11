# 项目健康总览

> 自动生成于 2026-10-11 自动迭代收尾。一眼看全 render-forge 状态。

## 核心指标

| 维度 | 数量 |
|---|---|
| 效果 | 58（全有 meta） |
| 后处理 | 7 |
| 转场 | 9 |
| 模板 | 4 |
| 片段库 | 4 |
| 配色 | 13 |
| 示例 | 18 |
| 工具 | 37 |
| Prompt 模板 | 12 |
| Agents | 12 |
| Schema | 6 |

## 验证状态（全部通过）

| 检查 | 命令 | 状态 |
|---|---|---|
| 单元测试 | `npm run test` | ✅ 122/122 |
| 文档数字一致 | `npm run check-docs` | ✅ |
| 文档命令/效果完整性 | `npm run check-commands` | ✅ |
| 全效果 smoke | `npm run smoke` | ✅ 58/58 |
| 端到端（L0→L4） | `npm run e2e` | ✅ 14 步 |
| 一键全验证 | `npm run verify` | ✅ |
| 性能基准 | `npm run bench` | ✅ 7.59ms/帧（131fps） |

## 架构分层

| 层 | 内容 | 状态 |
|---|---|---|
| 引擎 | 58 效果 / 音频分析 / 排版 / 表达式 / 关键帧 / 容器 | ✅ |
| L0 语境与叙事 | 创作宪法 + 冲突处理（5 分支） | ✅ |
| L1 分析层 | dossier + 解读报告 | ✅ |
| L2 决策 | 任务清单 | ✅ |
| L3 执行 | 片段 | ✅ |
| L4 组装 | 完整分镜 | ✅ |
| 导出 | WebCodecs（零 ffmpeg） | ✅ |

## Cuckoo 接入

| 块 | 位置 | 状态 |
|---|---|---|
| MCP（18 工具） | `C:\Users\Admin\.cuckoo\mcp.json` | ✅ |
| Agents（12 个） | `.cuckoo/agents/` | ✅ |
| Skill（1 个） | `.cuckoo/skills/render-forge/` | ✅ |

## 效果示例覆盖率

53/58（未覆盖：image / video / svg / imageMask 需外部素材，waveform 需音频）。

## 已知边界（非缺陷，设计使然）

- 渲染后端为 Canvas2D；WebGL 效果层与 3D/HDR 未做（架构级工程）。
- L0/L1-L4 的语义判断由外部 LLM 完成，框架只出工具/协议/模板/校验（不碰 LLM/网络）。
- 视频素材需真视频（smoke test 跳过）。

## 快速命令

```bash
npm run verify     # 一键全验证（推荐）
npm run test       # 单元测试
npm run smoke      # 全效果 smoke
npm run e2e        # 端到端
npm run bench      # 性能基准
npm run export -- x.json out.mp4   # 出片
npm run mcp        # MCP server
```
