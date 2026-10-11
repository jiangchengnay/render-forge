# L2-L4 编排使用指南

> 本指南说明如何用「工具 + 协议 + 模板 + 校验」打通 render-forge 的 **L2 决策层 / L3 执行层 / L4 组装层**。
> **render-forge 不碰 LLM（A 模式）**：语义决策由外部 LLM 完成，本框架只提供数据准备、协议、模板、校验。

## 1. 定位

L1 分析层产出《解读报告》后，还需要三步把它变成能渲染的完整分镜：

\`\`\`
《解读报告》+ 创作宪法
   │  L2 Planner：定范式 / 定全局约束 / 切任务
   ▼
任务清单（plan.json）
   │  L3 Worker × N：每人领一条 task，产出片段
   ▼
片段集合（fragments/*.json）
   │  L4 Assembler：校验 + 拼接
   ▼
完整分镜（storyboard.json）→ 现有引擎渲染
\`\`\`

**「单 AI 顺序扮演」**：不要求框架自己起多个 AI。一个外部 AI 按顺序扮演 Planner → Worker × N → Assembler，框架提供每一步的**输入输出契约 + 校验**，帮它兜底。

## 2. 三份规范（schema）

| 规范 | 产物 | 角色 |
|---|---|---|
| \`dsl/schemas/interpretation.schema.md\` | 《解读报告》 | L1（已有） |
| \`dsl/schemas/task-plan.schema.md\` | 任务清单 | L2 Planner |
| \`dsl/schemas/fragment.schema.md\` | 片段 | L3 Worker |

## 3. 三个工具（输入 → 输出）

### \`tools/build-plan-input.js\` —— 给 Planner 备料

\`\`\`bash
node tools/build-plan-input.js --report=report.json --constitution=constitution.json --out=plan-input.json
\`\`\`

- 输入：解读报告（必填）+ 创作宪法（可选）。
- 输出：**计划输入包** = { report, constitution, timeline（全片时间锚点）, palette_names, effect_names, transition_names, postfx_names }。
- 用途：Planner 据此选调色板、定范式、切任务。

### \`tools/assign-task.js\` —— 给某个 Worker 备料

\`\`\`bash
node tools/assign-task.js --plan=plan.json --task=s1 --out=worker-input.json
\`\`\`

- 输入：任务清单 + 某条 task id。
- 输出：**Worker 输入包** = { global, task（只这一条）, timeline_slice（按角色裁）, focus_slice, docs（展开的文档片段） }。
- **关键**：只给该 Worker 相关的，不塞全片（按角色裁时间轴切片，见 §5）。

### \`tools/assemble.js\` —— 收集 + 校验 + 拼接

\`\`\`bash
node tools/assemble.js --plan=plan.json --fragments=fragments/ --out=storyboard.json
\`\`\`

- 输入：任务清单 + 片段目录（或单文件）。
- 输出：**完整分镜**（含 meta/palette/post/acts），可直接 \`node tools/validate.js\` 校验、\`node tools/export-webcodecs.js\` 出片。
- 拼接前会先校验每个片段（有 plan 时做交叉校验）；组装是确定性纯函数。

## 4. 两个校验器

| 命令 | 校验 |
|---|---|
| \`node tools/validate-plan.js plan.json\` | 范式、全局约束、任务字段、docs 引用真实性、splice 覆盖 / choreography 层次 |
| \`node tools/validate-fragment.js frag.json [--plan=plan.json]\` | 片段结构 + **复用 \`tools/validate.js\` 的 clip 校验**（含未知效果名拦截）+ task_id/type 交叉校验 |

均 exit 0（通过）/ exit 1（报错并定位路径）。

## 5. 时间轴切片（按角色下发）

来自 WORKFLOW.md §B3。Planner 已按角色裁好，Worker 只拿相关的：

| Worker 角色 | 下发时间轴 | 下发焦点段 |
|---|---|---|
| text（文字） | phrases | focus:"text" |
| accent / effect（特效·粒子） | beats + onsets | focus:"accent" |
| background（背景） | sections | —（全程） |
| subject（主体） | beats + phrases | focus:"subject" |

若 task 未显式给切片，\`assign-task.js\` 会按上表自动裁。

## 6. 三个 prompt 模板（职责）

| 模板 | 角色 | 输入 | 输出 | 核心约束 |
|---|---|---|---|---|
| \`prompts/planner.md\` | Planner（L2） | 计划输入包 | 任务清单 | 定范式 / 定全局约束 / 切任务；**自检不过就重来** |
| \`prompts/worker.md\` | Worker（L3） | Worker 输入包 | 片段 | **只写自己那条 task**；效果名/参数真实；遵守底线规则 |
| \`prompts/assembler.md\` | Assembler（L4） | plan + 所有片段 | 完整分镜 | 按 schema 拼接；三项校验；**冲突时报告而非静默改** |

均含占位符：Planner 用 \`{{plan_input}}\`，Worker 用 \`{{worker_input}}\`，Assembler 用 \`{{plan}}\` / \`{{fragments}}\`。

## 7. 单 AI 顺序扮演流程

1. 跑 \`build-plan-input.js\` 得到计划输入包 → 喂给 AI + \`planner.md\` → 得到 \`plan.json\`。
2. \`validate-plan.js\` 校验（失败则让 AI 重出）。
3. 对每条 task：跑 \`assign-task.js\` → 喂给 AI + \`worker.md\` → 得到 \`fragments/<id>.json\`。
4. \`validate-fragment.js\` 校验每条片段（失败则重出）。
5. 跑 \`assemble.js\` 拼接 → \`storyboard.json\`。
6. \`validate.js\` 最终校验 → \`export-webcodecs.js\` 出片。

## 8. 完整示例

见 \`dsl/examples/orchestration-demo/\`：

| 文件 | 说明 |
|---|---|
| \`plan.json\` | 任务清单（4 个 system，choreography 范式） |
| \`fragments/s1..s4.json\` | 背景 / 主体 / 特效 / 文字 四个片段 |
| \`storyboard.json\` | 组装结果（能过 validate.js，能出 mp4） |

## 9. 相关文件

| 文件 | 作用 |
|---|---|
| \`tools/orchestrate-lib.js\` | L2-L4 共享库（纯函数 + IO） |
| \`tools/build-plan-input.js\` / \`assign-task.js\` | 输入包构建器 |
| \`tools/validate-plan.js\` / \`validate-fragment.js\` | 校验器 |
| \`tools/assemble.js\` | 组装器 |
| \`dsl/schemas/task-plan.schema.md\` / \`fragment.schema.md\` | 规范 |
| \`prompts/planner.md\` / \`worker.md\` / \`assembler.md\` | 三角色模板 |


## 从音频自动生成视觉强度曲线（gen-channels）

把 节奏到视觉强度 的审美规则锁进引擎——AI 不用自己算强度曲线：

```bash
node tools/gen-channels.js --dossier=dossier.json --out=channels.json
```

生成 4 条 channel（可直接并入分镜的 channels 字段）：
- `intensity`：段落能量到视觉强度（low/high）
- `bassEnergy`：各段低音均值到低频驱动
- `beatPulse`：每个 beat 处脉冲（卡点用）
- `buildDrop`：能量从 low 跳到 high 的 drop 点

用 `bind` 或表达式 `=ch.intensity` 驱动画面。
