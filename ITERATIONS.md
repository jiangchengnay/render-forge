# 自动迭代日志

> 2026-10-11 自动迭代（用户离线期间）。每代都经独立验收 + git 提交。
> 供醒来后快速了解"这些代都干了什么"。

## 基础设施（迭代前）
- **MCP 接入**：已挂到已安装版 Cuckoo（`C:\Users\Admin\.cuckoo\mcp.json`），18 工具。
- **12 个 Agents**：`.cuckoo/agents/rf-*.md`（五层分工）。
- **Skill**：`.cuckoo/skills/render-forge/SKILL.md`。
- **Git 仓库**：已初始化。

## 迭代记录

| 代 | 内容 | 价值 |
|---|---|---|
| iter-1 | L2 `--dossier` 补全真实时间轴锚点 + sliceForRole 跳过空切片 | 修复 report 无逐拍数据导致的锚点缺失 |
| iter-2 | assemble 覆盖率检查（缺片段拦截） | 防产出残缺分镜而无感知 |
| iter-3 | 验证 MCP 编排工具协议可用 | 确认 Cuckoo 能调编排工具 |
| iter-4 | 端到端集成脚本 e2e.js（L0-L4 共 11 步） | 整条链可复现的回归证明 |
| iter-5 | check-commands.js 文档命令一致性 + USAGE 补漏 | 防文档提到不存在的工具 |
| iter-6 | 示例库出片抽查 | 确认示例健康 |
| iter-7 | npm run verify 一键全验证 | 便捷回归 |
| iter-8 | render-forge Skill（接入第三块） | Cuckoo AI 一读即懂 |
| iter-9 | 修正 .gitignore 纳入 agents/skills | 之前误排除 |
| iter-10 | OVERVIEW 更新（MCP 18 工具 + 编排） | 修正过时信息 |
| iter-11 | EFFECTS.md 补 6 个 vfx 效果 + 完整性检查 | 防效果表 stale |
| iter-12 | agents 补 bash 工具 | **关键**：否则 agent 无法命令行自检 |
| iter-13 | Cuckoo 接入指南 | 讲清三块接入用法 |
| iter-14 | 迭代日志 ITERATIONS.md + check-commands 扩展 prompts 检查 | 存档 + 防 prompt 引用失效 |
| iter-15 | e2e 补失败路径 + 组装断言 | 从只验成功到也验失败 |
| iter-16 | 更多示例出片抽样 | 确认示例健康 |
| iter-17 | vfx 6 效果真实渲染验证 | 确认新效果非空壳 |

## 关键修正（这几代里最重要的）
1. **iter-12**：agents 没 bash → 无法跑 `node tools/xxx` 自检 → 已补。这是 agent 能真正干活的前提。
2. **iter-2**：缺片段静默通过 → 已拦截。防残缺分镜。
3. **iter-1**：report 不含 beats → 用 dossier 补真实锚点。

## 验证方式（每代都跑）
- `npm run verify` = check-docs + check-commands + test + e2e
- 最终状态：**119 测试全过、e2e 10 步全过、17 示例 0 失败、git 干净**。

## 如何继续
- 查看每代详情：`git log --oneline` + `git show <hash>`
- 重跑全验证：`npm run verify`
- 端到端：`npm run e2e`
