# 第三方声明（Third-Party Notices）

本项目（Render Forge）采用 MIT 许可（见 LICENSE）。运行时包含/依赖以下第三方作品，其版权与许可声明如下。

---

## 1. 依赖（不打包，随 npm 安装）

### puppeteer
- 用途：Node 端无头浏览器（渲染/导出/批评管线）。
- 许可：Apache License 2.0
- 主页：https://github.com/puppeteer/puppeteer
- 说明：作为依赖安装，不在本仓库分发其源码。

---

## 2. 打包的第三方代码（vendor/）

### mp4-muxer（vendor/mp4-muxer.mjs）
- 作者：Vanilagy
- 许可：MIT
- 主页：https://github.com/Vanilagy/mp4-muxer
- 用途：把 WebCodecs 编码的 H.264 帧封装为 MP4。

### webm-muxer（vendor/webm-muxer.mjs）
- 作者：Vanilagy
- 许可：MIT
- 主页：https://github.com/Vanilagy/webm-muxer
- 用途：把 WebCodecs 编码的 VP9 帧封装为 WebM。

> 两个 muxer 均为 MIT 许可。按 MIT 要求，其版权与许可声明保留于对应文件头部。

---

## 3. 概念参考（无代码复用）

以下工作为本项目的设计思路参考，未复制其代码：

- Remotion：程序化视频渲染的思路（React 到帧到视频）。
- Motion Canvas：代码驱动的动效编排。
- canvas-record / helios-project/renderer：从 canvas 直接编码（WebCodecs）而非截图的做法。

---

## 4. 本项目原创部分

engine/、tools/、dsl/、prompts/、.cuckoo/ 下的全部代码与文档为本项目原创，采用 MIT 许可。
