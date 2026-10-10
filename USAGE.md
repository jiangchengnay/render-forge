# Render Forge 使用总纲

> 更新：2026-10-11
> 本文档是**用户视角**的完整使用指南：两种用法、多 Agent 编排全流程、每个平台怎么接、每步给什么拿什么。
> 架构细节见 ARCHITECTURE.md，工作流细节见 WORKFLOW.md。

---

## 0. 两条路线：先判断你要哪条

| | 路线 A：单分镜（简单） | 路线 B：多 Agent 编排（强大） |
|---|---|---|
| 适合 | 快速出片、强模型、完全定制 | 音乐 PV、复杂编舞、弱模型也能用 |
| 谁写 | 一个 AI 一次写出完整 JSON | 多个 AI 分工：理解→分析→决策→执行→组装 |
| 入口 | 拖 JSON / npm run export | L0→L4 五层流水线 |
| 文档 | README + dsl/AI-GUIDE.md | 本文件 + WORKFLOW.md |

**路线 A** 是原有的、成熟的用法，保留不变。
**路线 B** 是新增的编排架构，下面重点讲。

---

## 1. 环境准备（一次性）

```bash
cd E:\奇思妙想\render-forge
npm install            # 装 puppeteer（唯一依赖）
npm run find-browser   # 确认探测到 Chrome/Edge
```

**不需要 ffmpeg**（导出走 WebCodecs）。

---

## 2. 路线 A：单分镜（最快出片）

### 2.1 浏览器手点
```bash
npm run serve   # 访问 http://localhost:5173，或直接双击 index.html
```
拖入 JSON → 播放 → 点「导出 MP4」。

### 2.2 命令行
```bash
npm run export -- dsl/examples/flagship.json out.mp4
npm run export -- x.json out.mp4 --audio=bgm.mp3 --fps=30
```

### 2.3 让 AI 写分镜
把 `dsl/AI-GUIDE.md` + `dsl/SCHEMA-BRIEF.md` 丢给任意 LLM，描述需求，它输出 JSON，你存盘后 `npm run export`。

---

## 3. 路线 B：多 Agent 编排（音乐 PV 等复杂片）

### 3.0 全景：五层流水线

```
用户需求 + 歌曲 (+解读/素材)
   │
   ▼  L0 语境与叙事  →  创作宪法 constitution.json
   ▼  L1 分析层      →  解读报告 report.json (+ dossier.json)
   ▼  L2 决策        →  任务清单 plan.json
   ▼  L3 执行        →  片段 fragments/s1.json ...
   ▼  L4 组装        →  完整分镜 storyboard.json
   ▼  渲染           →  成片 mp4
```

**核心原则**：render-forge **不碰 LLM、不碰网络**。它只提供「工具 + 协议 + 提示词 + 校验」。语义判断（搜索、理解、创作）由**外部平台/模型**完成；render-forge 负责数据准备、校验、组装、渲染。

所以 L0→L4 每一步都是：**「工具准备输入包 → 平台/LLM 处理 → 工具校验/合并」**。

---

### 3.1 L0 语境与叙事（前置理解）

**目的**：理解"这首歌在说什么 + 用户想用它的哪个侧面"，产出**创作宪法**。

**输入**：用户需求、歌曲（可选）、歌词（可选）、用户解读（可选）。

**步骤**：

1. **准备输入包**：
   ```bash
   node tools/build-l0-input.js --request=req.txt --audio=bgm.mp3 --lyrics=lyrics.txt --out=l0-input.json
   ```
   产出 `l0-input.json`，含**自动生成的搜索指令**（该搜什么）。

2. **三路并行处理**（可开多个 AI 同时做）：
   - `prompts/context-analyst.md` → 搜歌曲背景 → `song_context.json`（**平台执行联网搜索**）
   - `prompts/lyrics-scan.md` → 歌词粗读 → `lyrics_scan.json`
   - `prompts/intent-analyst.md` → 用户意图 → `user_intent.json`

3. **冲突检测**：
   `prompts/conflict-detector.md` 读三者 → `conflict.json`（只判断不处理）

4. **冲突处理**（确定性分支）：
   ```bash
   node tools/resolve-conflict.js --conflict=conflict.json --allow-ask=true --out=resolution.json
   ```
   - 无冲突 → proceed（零交互）
   - 有冲突 + 允许问 → ask_user（**此时才问用户**）
   - 有冲突 + 不许问 → 深层串联 / 网络匹配 / AI自决 / 垫底

5. **产出创作宪法**：
   `prompts/constitution-writer.md` → `constitution.json`
   ```bash
   node tools/validate-constitution.js constitution.json
   ```

---

### 3.2 L1 分析层

**目的**：把歌曲拆解成《解读报告》（情绪曲线、逐句意义、动作候选、焦点曲线）。

**步骤**：

1. **准备 dossier**：
   ```bash
   node tools/analyze.js --audio=bgm.mp3 --lyrics=lyrics.txt --constitution=constitution.json --out=dossier.json
   ```
   dossier 是浓缩后的分析素材包（10KB 级，不塞每帧原始数组）。

2. **四路分析师**（DAG，有依赖）：
   - 第一批并行：`prompts/music-analyst.md`（→music段）、`prompts/lyrics-analyst.md`（→lyrics段）
   - 第二批：`prompts/mapping-analyst.md`（依赖 lyrics，→mapping段）
   - 第三批：`prompts/layer-analyst.md`（依赖全部，→focus_curve）

   产出合并成 `report.json`（《解读报告》）。

3. **校验**：
   ```bash
   node tools/validate-interpretation.js report.json
   ```
   校验器会拦截"映射里出现效果名"这类越界。

---

### 3.3 L2 决策层（Planner）

**目的**：定范式、定全局约束、切任务。

**步骤**：

1. ```bash
   node tools/build-plan-input.js --report=report.json --constitution=constitution.json --out=plan-input.json
   ```

2. `prompts/planner.md` 读 plan-input → `plan.json`（任务清单）

3. ```bash
   node tools/validate-plan.js plan.json
   ```

**Planner 决定范式**：
- `splice`（幕拼接）：每幕一个 task，`type:"act"`
- `choreography`（连续编舞）：每个视觉系统一个 task，`type:"system"`

---

### 3.4 L3 执行层（多 Worker）

**目的**：每个 Worker 只写自己那条任务，产出片段。

**步骤**（对 plan 里每条 task 重复）：

1. ```bash
   node tools/assign-task.js --plan=plan.json --task=s1 --out=worker-input-s1.json
   ```
   只给该 Worker 相关的切片（不塞全片）。

2. `prompts/worker.md` 读 worker-input → `fragments/s1.json`

3. ```bash
   node tools/validate-fragment.js fragments/s1.json --plan=plan.json
   ```

**关键**：Worker 之间**互不可见**——这是让弱模型也不崩的原因。

---

### 3.5 L4 组装层（Assembler）

**目的**：把所有片段缝成完整分镜。

```bash
node tools/assemble.js --plan=plan.json --fragments=fragments/ --out=storyboard.json
node tools/validate.js storyboard.json
```

校验三项：一致性、流畅性、时间轴对齐。

---

### 3.6 渲染

```bash
node tools/export-webcodecs.js storyboard.json out.mp4 --fps=30 --audio=bgm.mp3
```

---

## 4. 平台怎么接（三种方式）

### 方式 1：手动（任何 AI + 命令行）
每一步：用工具准备输入包 → 把 `prompts/xxx.md` 模板 + 输入包贴给 AI → 拿到输出存盘 → 跑校验工具。**适合先把流程走通。**

### 方式 2：MCP（Agent 平台自动调）
```bash
npm run mcp
```
在支持 MCP 的平台配置里加：
```json
{ "mcpServers": { "render-forge": { "command": "node", "args": ["E:/奇思妙想/render-forge/tools/mcp-server.js"] } } }
```
平台即可自动调用生成/校验/批评/渲染工具。

### 方式 3：多 Agent 协作（方案三，最强）
把 L1-L4 各步的 `prompts/*.md` 分发给不同 AI：
- 一个主控读 `planner.md` 做规划
- 多个执行读 `worker.md` 各写一条
- 一个收口读 `assembler.md` 组装

**render-forge 只出协议和工具，实际"起几个 AI"由你的平台决定。**

---

## 5. 冲突处理（L0 唯一会打断用户的地方）

**默认全程零交互。** 只有当 L0 检测到"用户意图与歌曲本意冲突"时，才触发询问。

`resolve-conflict.js` 的分支：
```
无冲突                → proceed（继续，不打扰）
有冲突 + 允许问        → ask_user（问用户）
有冲突 + 不许问：
  ├ 有"深层串联"      → use_bridge
  ├ 有"网络匹配"      → use_network
  ├ 都没有            → ai_decide
  └ 兜底              → proceed_with_default
```

用户可一开始就说"不要问"，走保底规则。

---

## 6. 全部命令速查

| 用途 | 命令 |
|---|---|
| 生成/更新脚本清单 | `npm run gen-manifest` |
| 单元测试 | `npm run test` |
| 文档数字校验 | `npm run check-docs` |
| 校验分镜 | `npm run validate -- x.json` |
| 批评 | `npm run critique -- x.json` |
| **导出 mp4** | `npm run export -- x.json out.mp4 [--audio=bgm.mp3]` |
| MCP 服务 | `npm run mcp` |
| 本地服务 | `npm run serve` |
| **L0** 输入包 | `node tools/build-l0-input.js --request=... --out=...` |
| **L0** 冲突处理 | `node tools/resolve-conflict.js --conflict=... --out=...` |
| **L0** 宪法校验 | `node tools/validate-constitution.js constitution.json` |
| **L1** 分析 | `node tools/analyze.js --audio=... --out=dossier.json` |
| **L1** 报告校验 | `node tools/validate-interpretation.js report.json` |
| **L2** 计划输入 | `node tools/build-plan-input.js --report=... --out=...` |
| **L2** 计划校验 | `node tools/validate-plan.js plan.json` |
| **L3** 任务输入 | `node tools/assign-task.js --plan=... --task=s1 --out=...` |
| **L3** 片段校验 | `node tools/validate-fragment.js frag.json --plan=plan.json` |
| **L4** 组装 | `node tools/assemble.js --plan=... --fragments=dir/ --out=sb.json` |

---

## 7. 一份完整走查：做一首歌的 PV

以"给一首歌做连续编舞型 MV"为例，端到端：

```
# L0 理解
node tools/build-l0-input.js --request=req.txt --audio=song.mp3 --lyrics=lyrics.txt --out=l0-input.json
#   → 三路 AI（context/lyrics-scan/intent）并行 → song_context/lyrics_scan/user_intent
#   → conflict-detector → conflict.json
node tools/resolve-conflict.js --conflict=conflict.json --out=resolution.json
#   → constitution-writer → constitution.json
node tools/validate-constitution.js constitution.json

# L1 分析
node tools/analyze.js --audio=song.mp3 --lyrics=lyrics.txt --constitution=constitution.json --out=dossier.json
#   → music/lyrics-analyst（并行）→ mapping → layer → report.json
node tools/validate-interpretation.js report.json

# L2 决策
node tools/build-plan-input.js --report=report.json --constitution=constitution.json --out=plan-input.json
#   → planner → plan.json
node tools/validate-plan.js plan.json

# L3 执行（对每条 task）
node tools/assign-task.js --plan=plan.json --task=s1 --out=worker-input-s1.json
#   → worker → fragments/s1.json
node tools/validate-fragment.js fragments/s1.json --plan=plan.json
# ... 对 s2/s3/... 重复

# L4 组装
node tools/assemble.js --plan=plan.json --fragments=fragments/ --out=storyboard.json
node tools/validate.js storyboard.json

# 渲染
node tools/export-webcodecs.js storyboard.json out.mp4 --fps=30 --audio=song.mp3
```

**注意**：带 `→` 的行是"把对应 prompts/xxx.md + 输入包交给 AI，拿回输出存盘"，不是命令行。render-forge 不自己跑 LLM。

---

## 8. 提示词模板在哪

| 层 | 模板 |
|---|---|
| L0 | prompts/context-analyst.md、lyrics-scan.md、intent-analyst.md、conflict-detector.md、constitution-writer.md |
| L1 | prompts/music-analyst.md、lyrics-analyst.md、mapping-analyst.md、layer-analyst.md |
| L2 | prompts/planner.md |
| L3 | prompts/worker.md |
| L4 | prompts/assembler.md |

每个模板都含 `{{占位符}}`，把对应输入包注入即可。

---

## 9. 文档地图

| 文档 | 内容 |
|---|---|
| README.md | 项目总览、快速开始 |
| ARCHITECTURE.md | 五层架构、两种范式、关键决定 |
| WORKFLOW.md | 完整工作流、交互点、待定问题解答 |
| dsl/AI-GUIDE.md | 写分镜的完整指南（AI 用） |
| dsl/CONTEXT-GUIDE.md | L0 用法 |
| dsl/ANALYSIS-GUIDE.md | L1 用法 |
| dsl/ORCHESTRATION-GUIDE.md | L2-L4 用法 |
| dsl/EFFECTS.md | 58 效果速查 |
| dsl/SCHEMA-BRIEF.md | DSL 速览 |
| PROGRESS.md | 项目记忆、历史决策、淘汰方案留档 |

---

## 10. 常见问题

**Q：没有 ffmpeg 能出片吗？**
能。导出走 WebCodecs，零 ffmpeg 依赖。

**Q：弱模型能用来做音乐 PV 吗？**
能。路线 B 的多 Agent 分工，每个 AI 只写一小块（几十行），上下文隔离，弱模型也不崩。

**Q：框架会自己调 LLM 吗？**
不会。它只出工具/协议/模板，实际调模型由你的平台负责。这是为了不绑死任何一家 API。

**Q：L0 会一直问我问题吗？**
不会。默认零交互，只有检测到"用户意图 vs 歌曲本意冲突"时才问一次。你也可以一开始就说"不要问"。

**Q：报错了怎么查？**
- 分镜问题 → `npm run validate -- x.json`
- 数字不一致 → `npm run check-docs`
- 渲染问题 → 看 `node tools/export-webcodecs.js` 的输出
- 回归 → `npm run test`
