# 贡献指南（Contributing）

感谢参与 Render Forge。

## 开发环境

```bash
git clone <repo>
cd render-forge
npm install
npm run verify    # 一键全验证（docs + commands + test + smoke + e2e）
```

## 提交前自检

务必跑通：

```bash
npm run verify
```

它包含：文档数字一致（check-docs）、文档命令/效果完整性（check-commands）、单元测试（test，142 项）、全效果 smoke（smoke，58 项）、端到端（e2e，14 步）。**任何一项失败都不应提交。**

## 代码风格

- 引擎文件用 IIFE + `RF.xxx` 注册（见 engine/ 现有文件）。
- 中文注释，与现有风格一致。
- 不改动无关代码。

## 加新效果

1. 在 `engine/effects/` 或 `engine/components/` 新增（或改现有文件）。
2. 必须带 `meta`（category/desc/params）。
3. 纯确定性（不用 Math.random，用 `env.rng`）。
4. 跑 `npm run gen-manifest` 更新 index.html。
5. 跑 `npm run sync-effects` 刷新快照。
6. 加测试；确保 `npm run verify` 通过。

## 许可

贡献即表示同意以 MIT 许可发布（见 LICENSE）。
