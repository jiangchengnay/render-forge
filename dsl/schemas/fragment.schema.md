# 片段规范（L3 执行层产出）

> 本文件定义 render-forge L3 执行层产出的**片段**（Fragment）结构。
> 外部 LLM 读「Worker 输入包 + \`prompts/worker.md\`」→ 产出片段 → 由 \`tools/validate-fragment.js\` 校验。
> 校验通过后，片段是 L4 组装层的输入。

## 0. 定位

- 一个 Worker 领**一条 task**，产出一个片段。
- 片段的 \`tracks\` 必须是**现有引擎能直接消费的 clip 数组**（与分镜 act 内的 tracks 同构）。
- Worker **不能**产出引擎不认识的效果名/参数——校验器会复用 \`tools/validate.js\` 的 clip 校验拦截。

## 1. 顶层结构

\`\`\`json
{
  "task_id": "s1",
  "type": "system",
  "tracks": [
    { "effect": "fbmNoise", "at": 0, "dur": 8, "opacity": 0.3, "params": { "scale": 2, "warp": 0.6 } }
  ],
  "meta": { "worker_note": "氛围底纹，随 section 缓慢演化" }
}
\`\`\`

| 字段 | 类型 | 约束 |
|---|---|---|
| \`task_id\` | string | **必须**对应任务清单里某条 task 的 id（引用完整性） |
| \`type\` | enum | \`act\` / \`system\`，**必须与该 task 的 type 一致** |
| \`tracks\` | clip[] | 该幕 / 该系统的 clip 数组，格式与现有分镜一致 |
| \`meta\` | object | 自由备注；\`worker_note\` 建议填写 |

## 2. tracks 段（clip 数组）

每个 clip 与现有引擎的 clip 同构，常见字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| \`effect\` | string | 效果名，**必须是真实效果名**（见 \`tools/_effect-names.json\`） |
| \`at\` | number \| string \| object | 起始时间：数字（秒）/ \`"beat:N"\` / \`"phrase:N"\` / \`{beat:N,offset}\ optionally。**不做合法性保证时建议用数字** |
| \`dur\` | number | 持续秒数，≥0 |
| \`ease\` | string \| array | 缓动名或 bezier 数组 |
| \`opacity\` | number | 0–1 |
| \`blend\` | string | 混合模式（如 lighter） |
| \`params\` | object | 效果参数，见 \`tools/_effect-meta.json\` |
| \`transform\` | object | {x,y,scale,rotate,opacity} |
| \`motion\` | object | {keys:[{t,x,y}], path} |
| \`type\` | "group" | 分组容器（含 children） |

> 完整 clip 规范见 \`dsl/schemas/storyboard.schema.md\`。

## 3. 约束（Worker 必须遵守）

1. **只写自己那条 task**，不越界（不写别的角色/别的系统）。
2. **遵守底线规则**：如「文字避开中心」——文字类 clip 的 \`y\` 不要正好 0.5。
3. **参考 docs 指定的效果**：\`task.docs\` 里 \`EFFECTS#<name>\` 提示可用效果族，优先在其中选。
4. **效果名真实**：不得编造效果名/参数名。
5. **时间对齐**：\`at\` / \`dur\` 应落在任务的时间切片范围内（在片内合理分布，不整片空白也不全堆一处）。
6. **配色统一**：用调色板占位符（\`$0\` \`$accent\` \`$fg\` \`$bg\`）或与全局 palette 一致的色，不引入突兀色。

## 4. 校验

\`\`\`bash
node tools/validate-fragment.js frag.json --plan=plan.json
\`\`\`

- 不给 \`--plan\`：只做片段自身结构 + clip 合法性校验（能拦截未知效果名）。
- 给 \`--plan\`：额外校验 \`task_id\` 存在、\`type\` 与任务一致。
- exit 0：无 error；exit 1：报错并定位路径。

## 5. 完整示例

见 \`dsl/examples/orchestration-demo/fragments/\`。

## 6. 与组装的关系

\`tools/assemble.js\` 收集所有片段 → 校验 → 按 plan 拼接为完整分镜：
- splice：每个 \`type:"act"\` 片段 → 一幕（\`start/dur\` 取自 \`task.scope\`）。
- choreography：每个 \`type:"system"\` 片段 → 把 tracks 合并进同一幕（全片一幕）。
