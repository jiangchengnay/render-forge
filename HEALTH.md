# 项目健康总览

> 更新于 2026-10-11 自动迭代第 65 代。

## 核心指标

| 维度 | 数量 |
|---|---|
| 效果 | 58（全有 meta） |
| 后处理 | 7 |
| 转场 | 9 |
| 模板 | 4 |
| 片段库 | 4 |
| 配色 | 13 |
| 示例 | 19 |
| 工具 | 38+ |
| Prompt 模板 | 12 |
| Agents | 12 |
| Schema | 6 |

## 验证状态（全部通过）

| 检查 | 命令 | 状态 |
|---|---|---|
| 单元测试 | npm run test | 124/124 |
| 文档数字 | npm run check-docs | OK |
| 文档命令/效果/死链 | npm run check-commands | OK |
| 全效果 smoke | npm run smoke | 58/58 |
| 端到端 L0→L4 | npm run e2e | 14 步 |
| 环境自检 | npm run doctor | 8 项 |
| 性能基准 | npm run bench | 7.59ms/帧 |
| 一键全验证 | npm run verify | OK |

## 累计修复的真实缺陷（65 代迭代中）

1. groupTransform 完全失效（0%→18%）
2. assets 打包功能未实现
3. SRT 字幕加载未实现
4. 批评工具缺素材加载
5. count 无边界保护（8 处，1e6 卡死→76ms）
6. validate 漏检（acts/tracks 非数组、post 非数组、at 负数、color 越界、clip 超边界）
7. SVG 内联字符串注册
8. 测试计数漏算
9. validate 表达式/区间误报
10. agents 缺 bash
11. 缺片段静默通过
12. report 缺 beats
13. .gitignore 误排除
14. 三处资源加载不一致

## 架构

- 引擎：58 效果 / 音频分析 / 排版 / 表达式 / 关键帧 / 容器 / 素材
- 五层：L0 语境 → L1 分析 → L2 决策 → L3 执行 → L4 组装
- 导出：WebCodecs（零 ffmpeg）
- 接入：Cuckoo（MCP 19 工具 + 12 Agents + 1 Skill）

## 快速命令

```bash
npm run verify     # 一键全验证（推荐）
npm run doctor     # 环境自检
npm run export -- x.json out.mp4   # 出片
```
