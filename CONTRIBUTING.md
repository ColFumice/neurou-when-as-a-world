# Contributing to neurou : when as a world

感谢参与。这个仓库跨越 TypeScript 纯逻辑、React/Tauri 编辑器、Rust 媒体命令和验收脚本，
提交前请先确认改动落在正确的层。

## 开发环境

- Node.js 22+
- npm 10+
- Rust stable（桌面 / 媒体命令）
- WebView2（Windows Tauri）
- ffmpeg（媒体导入、单目转双目）

```bash
npm ci
npm --prefix v4/app ci
```

## 必跑检查

```bash
npm run typecheck:v4
npm run check:v4
npm run test:v4
npm --prefix v4/app run build
cd v4/app/src-tauri && cargo test
```

涉及媒体导入时，请额外跑相关 e2e（见 `v4/app/tests/e2e/`）。

## 分层约束

- `v4/core/`：纯逻辑；不得引入 React / Tauri / DOM / fs / 网络。
- `v4/adapters/`：只做 Tauri/HTTP/媒体等窄口适配。
- `v4/app/`：UI 与编排；不把判定数学复制到这里。
- Rust 命令：只暴露最小 capability；UI 不自行绕过。

## 冻结边界

以下内容在本版本冻结，改动需要单独立项：

- R4a.1 判定数学（`judge.ts` / `note.ts` / `grid.ts` / `ChartScore`）
- `AudioOutputClock`
- `ChartPremiereDirector`
- R4f 账本单写者
- AI 只产生 proposal，不自动写 editor/chart/ledger

## 命名与检查

- 新增源文件/导出前先跑 `npm run check:v4`。
- 不引入 `Template` 冒充真实 AI 结果；fallback 必须显式标记。
- 不在日志、issue、PR 中粘贴 Key、图片 base64、音频内容或完整 prompt。

## PR

- 一个 PR 只解决一个主题。
- 描述里写清：动机、变更层、测试命令、风险/限制。
- 使用 `.github/PULL_REQUEST_TEMPLATE.md`。
- UI 变更附截图；数据/判定变更附复现步骤。

## 版本

当前版本为 **v4.0.0**。版本号以根 `VERSION` 为准；发布 tag 使用 `v4.0.0`。
