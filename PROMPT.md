任务：把 render-forge 的视频导出从「puppeteer 逐帧截图 PNG + ffmpeg 封装」改成「页内 canvas 直接编码（WebCodecs）」，删掉截图落盘这条多余的中间步骤。

背景与实测依据（同机，1080x1080，flagship 分镜）：
- 每帧 seek 渲染仅约 19ms；
- page.screenshot({type:"png"}) 落盘约 657ms，占总耗时 97%；
- 换算 5 分钟 30fps（9000 帧）约 101 分钟，60fps（18000 帧）约 203 分钟；
- 该机器未安装 ffmpeg，tools/render.js 的封装步骤会失败退出，即当前环境下根本出不了片；
- WebCodecs 可用性已探测：Chrome 支持 H.264(avc1.640028)、VP9、AV1，VideoEncoder 编码 1080p 合成帧约 26ms/帧。

问题本质：慢的不是渲染，是「截图 → PNG 无损编码 → base64 → 磁盘 → ffmpeg」这条链。render-forge 的输出 100% 是 canvas，没有 DOM 需要截图，因此这一步完全多余。正确做法是用 new VideoFrame(canvas) 直接喂给 VideoEncoder，零磁盘 IO、零图片格式、零 ffmpeg。

参考开源做法（都已这么做，不要走图片序列）：canvas-record 默认用 WebCodecs 直接编码 canvas；helios-project/renderer 的 Canvas 模式 = WebCodecs + Zero Disk I/O；ui2v/producer 用 Puppeteer + Canvas + WebCodecs 直接出 MP4。

要做的事：
1. 新增一个导出模块（放 tools/ 还是 engine/core/ 由你判断，命名清晰即可），核心循环：seek 到第 i 帧 → new VideoFrame(canvas, {timestamp}) → encoder.encode(frame, {keyFrame}) → frame.close()。
2. 选一个纯 JS muxer 把编码后的 chunk 封装成 mp4（候选 mp4-muxer 或 mp4box.js；若 mp4 集成受阻，先出 webm，用 webm-muxer）。muxer 必须能消费 VideoEncoder 输出的 EncodedVideoChunk 和 description（avcC）。
3. 由 Node 端驱动：puppeteer 打开 index.html，注入分镜，循环 seek；编码在页面内完成，最终文件传回 Node 写盘，或页面内 Blob 生成后下载。优先选能无头跑通的方案。
4. 把编码后端做成可插拔：{ encoder: "webcodecs" | "ffmpeg" }。本次只实现 webcodecs；tools/render.js 的 ffmpeg 路径保留接口、暂不修（缺 ffmpeg 的问题延后，本次不处理）。
5. 音频先不做，预留 AudioEncoder 或 ffmpeg 合并的位置。

验证标准：
- 用 dsl/examples/flagship.json 出一段完整 mp4，能正常播放，画面与预期一致；
- 记录新的每帧耗时与 5 分钟换算，目标每帧不超过 60ms，5 分钟 30fps 不超过 10 分钟；
- 不修改 engine/ 下任何渲染逻辑（效果、runtime、scene 等），只新增/替换导出工具层；
- 跑完清理临时文件，不污染 output/。

约束：
- 确定性不能破坏：仍用 rt.seek(t) 逐帧推进；
- 不引入需要系统安装的外部二进制，这是本次改造的核心价值；
- 若 mp4 muxer 集成受阻，先交付 webm 版本并在结果里说明，不要卡死在 mp4 上；
- 完成后简要报告：实际每帧耗时、5 分钟换算、输出文件大小与格式、遇到的问题。