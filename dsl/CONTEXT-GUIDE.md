# L0 语境与叙事层使用指南

> L0 把「用户需求 + 歌曲 + 可选解读」变成一份**创作宪法**，供 L1 及后续所有层引用。
> **render-forge 不碰 LLM、不碰网络**：语义判断与联网搜索由外部平台完成，本框架只提供「模板 + 协议 + 校验 + 确定性分支」。

## 1. 定位

L0 是**唯一需要联网、且可能打断用户**的层，也是整条流水线的**前置层**：它的产出（创作宪法）是 L1 四路分析师的输入。它解决的不是「这段音乐多强」，而是「**这首歌到底在说什么，用户想用它的哪个侧面来说事**」。

因为 L0 最特殊，本框架特意把它拆成「搜索指令 + 提示词 + 确定性分支」——**不绑死任何平台**。任何 Agent（Cuckoo 子代理 / 其它框架 / 人工）都能用这套协议接入。

## 2. 五个子步骤（WORKFLOW.md §2）

```
0.1  搜集歌曲语境 ──┐
0.1b 歌词速读    ──┼──→  0.3 冲突检测  ──→  0.4 创作宪法
0.2  解析用户意图 ──┘
```

| 子步骤 | 做什么 | 依赖 | prompt |
|---|---|---|---|
| 0.1 | 联网搜歌曲背景/意图/文化语境/已有解读 | 无 | `prompts/context-analyst.md` |
| 0.1b | 粗读歌词：字面大意 + 整体基调 | 无 | `prompts/lyrics-scan.md` |
| 0.2 | 解析用户明确/隐含意图、叙事风格 | 无 | `prompts/intent-analyst.md` |
| 0.3 | 判断用户意图 vs 歌曲本意/共识是否冲突 | 0.1+0.1b+0.2 | `prompts/conflict-detector.md` |
| 0.4 | 综合全部，产出创作宪法 | 全部 | `prompts/constitution-writer.md` |

**0.1 / 0.1b / 0.2 三路并行**（可多 AI 同时处理）；**0.3 依赖前三者**；**0.4 最后**。

**0.3 是唯一可能打断用户的点**：无冲突 → 零交互直接通过；有冲突 → 才询问（异常分支，非常规步骤）。

## 3. 五个 prompt 模板（职责）

| 模板 | 角色 | 输入占位符 | 输出 |
|---|---|---|---|
| `context-analyst.md` | 语境分析师（0.1） | `{{l0_input}}` `{{search_queries}}` | `song_context` 段 |
| `lyrics-scan.md` | 歌词速读（0.1b） | `{{lyrics}}` | `lyrics_scan` 段 |
| `intent-analyst.md` | 意图解析（0.2） | `{{user_request}}` | `user_intent` 段 |
| `conflict-detector.md` | 冲突检测（0.3） | `{{song_context}}` `{{lyrics_scan}}` `{{user_intent}}` | 冲突清单 |
| `constitution-writer.md` | 宪法撰写（0.4） | `{{song_context}}` `{{lyrics_scan}}` `{{user_intent}}` `{{conflict_resolution}}` | `creative_constitution` 段 |

### 3.1 context-analyst 的联网搜索指令设计

这是 L0 最特殊的地方。框架**不自己搜**，它只做两件事：

1. **`build-l0-input.js` 生成搜索指令**：从需求/音频提取歌名+艺术家，生成一组查询词（`search_queries`），如：
   ```
   ["晨星 创作背景", "晨星 歌词含义", "晨星 解析", "晨星 创作意图 访谈", "晨星 歌词 解读"]
   ```
2. **prompt 里明确「框架不自己搜」**：平台拿到 `search_queries` 后**逐条执行联网搜索**，把结果整理填入 `song_context`，并把**实际用过的词**记入 `search_queries_used`。

即：查询词是「该搜什么」的结构化描述，执行搜索是平台的责任。

## 4. 三个工具（输入 → 输出）

### `tools/build-l0-input.js` —— 准备 L0 输入包

```bash
node tools/build-l0-input.js --request=req.txt [--audio=bgm.mp3] [--lyrics=lyrics.txt] [--out=l0-input.json]
```

- 输入：用户需求文本（必填）、音频（可选）、歌词（可选）。
- 输出 **L0 输入包** = { user_request, song{title,artist}, audio_meta, lyrics, user_pasted, **search_queries**, search_note, **placeholders**（song_context / lyrics_scan / user_intent 的空位） }。
- **纯函数**：`extractSongInfo` / `buildSearchQueries` / `buildL0Input` 确定性、可 require。

### `tools/validate-constitution.js` —— 校验创作宪法

```bash
node tools/validate-constitution.js constitution.json
```

- 校验必需字段、类型、枚举（severity / resolution）、**引用完整性**（`has_conflict` 与 `items` 一致、`must_preserve` 与 `can_interpret` 不重复）。
- 报错定位到路径（如 `creative_constitution.core_meaning 缺失`）。
- exit 0（通过）/ exit 1（有 error）。可 require。

### `tools/resolve-conflict.js` —— 冲突处理（确定性）

```bash
node tools/resolve-conflict.js --conflict=conflict.json [--allow-ask=true|false] [--out=resolution.json]
```

- 输入冲突清单，输出**处理决议**。纯函数（`resolveConflict`）。
- 分支逻辑见下节。

## 5. 冲突处理分支逻辑（对应 ARCHITECTURE.md §4.3）

```
has_conflict == false  →  { action: "proceed" }        （无冲突，零交互）
has_conflict == true:
  allow-ask == true（默认） →  { action: "ask_user", questions:[...] }
  allow-ask == false:
    a. possible_bridge 非空        →  use_bridge     （深层串联）
    b. matching_interpretation 非空 →  use_network    （网络匹配）
    c. 都没有                       →  ai_decide      （AI 自决）
    d. 兜底（items 为空等）         →  proceed_with_default（垫底）
```

输出 `resolution.json` 记录 `action` + `resolution`（对应 `constitution.conflict.resolution`）+ `basis`（依据）。

> **保底规则 a 优先于 b**：深层串联比网络匹配更贴合用户意图，所以先试 a 再试 b（§4.3 顺序）。

## 6. 单平台接入流程

1. 跑 `build-l0-input.js` 得到 L0 输入包。
2. **0.1 / 0.1b / 0.2 三路并行**：分别喂 `context-analyst.md`（平台执行联网搜索）/ `lyrics-scan.md` / `intent-analyst.md`。
3. **0.3**：把三路产出喂 `conflict-detector.md` → 得到冲突清单。
4. `resolve-conflict.js` 处理冲突清单：
   - 若 `ask_user` → 把 questions 抛给用户，拿到答复后继续。
   - 否则用 resolution 直接继续。
5. **0.4**：把三路产出 + 冲突处理结果喂 `constitution-writer.md` → 得到 `creative_constitution` 段。
6. 把五段合并成完整创作宪法 → `validate-constitution.js` 校验（失败则让 AI 重出）。
7. 创作宪法作为 `--constitution` 喂给 L1（`tools/analyze.js`）。

## 7. 完整示例

见 `dsl/examples/l0-demo/`：

| 文件 | 说明 |
|---|---|
| `request.txt` | 用户需求原文 |
| `lyrics.txt` | 歌词 |
| `l0-input.json` | L0 输入包（含自动生成的搜索指令） |
| `song_context.json` / `lyrics_scan.json` / `user_intent.json` | 三路产出 |
| `conflict.json` | 冲突清单 |
| `resolution.json` | 冲突处理决议 |
| `constitution.json` | 最终创作宪法（通过校验，可被 L1 消费） |

## 8. 相关文件

| 文件 | 作用 |
|---|---|
| `dsl/schemas/creative-constitution.schema.md` | 创作宪法规范 |
| `dsl/schemas/conflict.schema.md` | 冲突清单规范 |
| `prompts/context-analyst.md` 等 5 个 | L0 五个子步骤的 prompt 模板 |
| `tools/build-l0-input.js` / `validate-constitution.js` / `resolve-conflict.js` | L0 三工具 |
| `dsl/examples/l0-demo/` | 完整样例 |
