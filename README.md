# Render Forge

让 LLM 也能做出像样的程序化动画。

你给它一段 JSON 分镜，它用 Canvas 渲染成动画，直接导出 MP4——不需要 ffmpeg，不需要 GPU，不需要 API。

**它解决什么问题？** 让不懂图形学的 AI（或人）也能做出接近专业水准的动效短片：产品发布、开源宣发、歌词 MV、数据故事。

---

## 它是怎么工作的

核心想法很简单：**把「审美」和「图形学」从 AI 手里拿走，锁进引擎。**

AI 只负责写结构化的 JSON——分几幕、每幕放什么元素、什么时候出现。至于这个元素该用什么颜色、怎么缓动、怎么和背景搭配才好看，引擎里已经有答案。

```
分镜 JSON  ->  确定性引擎渲染  ->  MP4
```

因为渲染是确定性的（同一个 seed 永远得到同一帧），所以可以放心地反复迭代、逐帧导出、精确对齐音频。

---

## 快速开始

```bash
git clone <repo>
cd render-forge
npm install

# 浏览器预览
npm run serve      # 打开 http://localhost:5173，把 dsl/examples/ 里的 JSON 拖进去

# 命令行出片
npm run export -- dsl/examples/flagship.json out.mp4
```

导出用的是 WebCodecs，浏览器里直接编码，**不需要装 ffmpeg**。

---

## 能做什么

| | |
|---|---|
| 效果 | 58 个（粒子、噪声、几何、文字、图表、UI 框……） |
| 后处理 | 7 个（bloom / 暗角 / 颗粒 / 色差 / 扫描线 / 故障 / 着色） |
| 转场 | 9 个 |
| 配色 | 13 套预设 |
| 模板 | 4 个，改几个字段就能出一片 |
| 音频 | 自动分析节拍、段落、低频——分镜里写 `at: "beat:4"` 就能卡点 |
| 中文 | 自动断行、避头尾、安全区 |
| 编排 | 关键帧运动、分组、镜头推拉、属性频道（跨幕连续） |

示例都在 `dsl/examples/`，直接拖进浏览器就能看。

---

## 三种用法

**1. 最简单——用模板**

```json
{
  "template": "product-launch",
  "slots": {
    "brand": "MyProduct",
    "tagline": "一句话说清价值",
    "features": ["快", "稳", "开源"],
    "palette": "deepSea"
  }
}
```

**2. 灵活——手写分镜**

见 `dsl/AI-GUIDE.md`。你可以控制每一幕、每个元素、每一帧。

**3. 全自动——交给 AI**

把 `dsl/AI-GUIDE.md` 丢给任何 LLM，让它按你的需求写分镜。或者接入 MCP，让 AI 从生成到出片全自动跑完。

---

## 给 AI 用

这个项目从设计上就是**给 AI 当工具**的。

- **MCP**：22 个工具，任何支持 MCP 的 AI 都能调用（生成、校验、批评、渲染、编排）。
- **编排**：五层流水线（语境理解 → 分析 → 决策 → 执行 → 组装），把复杂片子拆给多个 AI 分工。
- **提示词模板**：`prompts/` 下有每个角色的完整指令。

详见 `USAGE.md` 和 `CUCKOO-INTEGRATION.md`。

---

## 文档导航

| 我想…… | 看 |
|---|---|
| 上手 | README（本文件） |
| 完整用法 | `USAGE.md` |
| 让 AI 写分镜 | `dsl/AI-GUIDE.md` |
| 查 DSL 速览 | `dsl/SCHEMA-BRIEF.md` |
| 选效果 | `dsl/EFFECTS.md` |
| 理解架构 | `ARCHITECTURE.md` |
| 看示例 | `dsl/examples/` |

---

## 开发

```bash
npm run verify    # 一键全验证：文档、命令、测试、smoke、端到端
```

提交前请确保它全绿。见 `CONTRIBUTING.md`。

---

## 许可

MIT，见 `LICENSE`。

打包了 Vanilagy 的 mp4-muxer / webm-muxer（MIT），依赖 puppeteer（Apache-2.0）。详见 `THIRD-PARTY-NOTICES.md`。
