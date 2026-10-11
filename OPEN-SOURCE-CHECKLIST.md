# 开源前检查清单（Open-Source Checklist）

> 用于开源发布前逐项确认。

## 协议与合规
- [x] LICENSE（MIT）就位
- [x] package.json 的 license 字段 = MIT
- [x] THIRD-PARTY-NOTICES.md（依赖 + 打包代码的归属）
- [x] vendor/ 第三方代码带版权头（mp4-muxer / webm-muxer）
- [x] 无密钥/凭证泄露（RF_VISION_KEY 仅为环境变量名）
- [x] 无硬编码本地路径（已占位符化 <project-dir> / ~/.cuckoo）

## 文档
- [x] README（含许可/致谢/贡献）
- [x] CONTRIBUTING.md
- [x] ROADMAP.md（P1 不做 / P2 待定 / P3）
- [x] USAGE.md（使用总纲）
- [x] ARCHITECTURE.md / WORKFLOW.md / ARCH-CRITIQUE.md
- [x] 各层指南（CONTEXT/ANALYSIS/ORCHESTRATION-GUIDE）

## 质量
- [x] 单元测试 142 全过
- [x] 全效果 smoke 58/58
- [x] 端到端 e2e 14 步
- [x] 文档数字一致（check-docs）
- [x] 文档命令/效果/死链检查（check-commands）
- [x] 一键验证（npm run verify）

## 卫生
- [x] .gitignore 排除 node_modules / output / tool-results
- [x] 无临时脚本残留（tools/ 无 _*.js）
- [x] git 历史干净（每代有意义的提交信息）

## 发布前手动步骤（由项目所有者执行）
- [ ] 选定远程仓库（GitHub / Gitee）
- [ ] 创建仓库，配置 origin
- [ ] 决定 PROGRESS.md / ITERATIONS.md 是否随仓库发布（开发记忆，建议保留）
- [ ] 选择发布版本号（当前 package.json v1.0.0）
- [ ] 打 tag：git tag v1.0.0 && git push --tags
