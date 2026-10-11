# 接入 Cuckoo Code 指南

> 本文说明如何从 Cuckoo Code（本应用）使用 render-forge 的全部能力。
> 三块接入：**MCP**（工具）+ **Agents**（多 AI 分工）+ **Skill**（使用知识）。

---

## 一、MCP（工具）——已挂到已安装版

配置位置：`C:\Users\Admin\.cuckoo\mcp.json`
```json
{
  "mcpServers": {
    "render-forge": {
      "command": "node",
      "args": ["E:/奇思妙想/render-forge/tools/mcp-server.js"]
    }
  }
}
```

**18 个工具**（基础 8 + 编排 10）：

| 基础 | 编排 |
|---|---|
| rf_list / rf_schema / rf_generate / rf_validate | rf_l0_input / rf_resolve_conflict / rf_validate_constitution |
| rf_critique / rf_recommend / rf_apply_patch / rf_render | rf_analyze / rf_validate_interpretation |
| | rf_build_plan_input / rf_validate_plan |
| | rf_assign_task / rf_validate_fragment |
| | rf_assemble |

配置后**重启 Cuckoo**（或重新初始化项目）即生效。AI 对话中可自动调用这些工具。

---

## 二、Agents（多 AI 分工）——12 个已就位

位置：`E:\奇思妙想\render-forge\.cuckoo\agents\`

| Agent | 角色（对应五层） |
|---|---|
| rf-context-analyst / rf-lyrics-scan / rf-intent-analyst | L0 语境 |
| rf-conflict-detector / rf-constitution-writer | L0 冲突 + 宪法 |
| rf-music-analyst / rf-lyrics-analyst | L1 分析 |
| rf-mapping-analyst / rf-layer-analyst | L1 映射 + 层次 |
| rf-planner | L2 决策 |
| rf-worker | L3 执行 |
| rf-assembler | L4 组装 |

**用法**：主对话说"用 render-forge 做一首歌的 PV"，AI 会判断任务适合委派，用 `runAgent` 把各步分给对应子代理（独立上下文、只回摘要）。

**关键**：每个 agent 的 `tools` 含 `bash`，能执行 `node tools/xxx` 自检。这是 agent 真正能干活的前提。

---

## 三、Skill（使用知识）——1 个已就位

位置：`E:\奇思妙想\render-forge\.cuckoo\skills\render-forge\SKILL.md`

AI 判断任务匹配时，会 `read` 这个 SKILL.md 加载使用知识（两种路线 + 关键命令）。

---

## 四、怎么用（典型对话）

### 场景 A：快速做个片
> 你："用 render-forge 做个 15 秒的产品发布片，主题 XX"
> AI：调 `rf_generate` 生成 → `rf_validate` 校验 → `rf_render` 出片。

### 场景 B：做音乐 PV（多 Agent）
> 你："用 render-forge 给这首《晨星》做 MV，我要表达'黑夜中找回自己'"
> AI：调 `rf_l0_input` 准备语境输入 → `runAgent(rf-context-analyst)` 搜背景 → `runAgent(rf-conflict-detector)` 判断冲突 → `rf_resolve_conflict` 处理 → `runAgent(rf-constitution-writer)` 产出宪法 → `rf_analyze` → `runAgent(rf-music-analyst/rf-lyrics-analyst)` → … → `rf_assemble` → `rf_render` 出片。

---

## 五、验证接入是否正常

```bash
cd E:/奇思妙想/render-forge
node tools/check-commands.js   # 文档命令一致性
npm run verify                 # 全验证（docs + commands + test + e2e）
```

若 `npm run verify` 全过，说明项目自身健康；MCP/Agents 是否被 Cuckoo 识别，在 Cuckoo 里看「可用子代理」和 MCP 状态。

---

## 六、注意

- render-forge **不碰 LLM/网络**：MCP 工具只做数据准备、校验、组装、渲染；语义判断（搜索、理解、创作）由 Cuckoo 的 AI 完成。
- 冲突询问：只在"用户意图 vs 歌曲本意冲突"时触发，默认零交互。
- 零外部依赖：导出走 WebCodecs，不需要 ffmpeg。
