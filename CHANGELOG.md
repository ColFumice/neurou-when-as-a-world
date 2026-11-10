# Changelog

## v4.0.0 — 2026-11-10

首个公开的 **neurou : when as a world** 版本，冻结至 R5c-B-patch。

### Added

- Tauri 2 + React 19 + Vite 桌面世界 / 编辑器 / 游戏壳。
- **R5c-A**
  - Layer 3+ 全屏判定与时间轴/Inspector 支持。
  - Layer Audio：220 / 440 / 880 Hz SFX，16 ms 命中优先级。
  - 单目 → 双目：整数帧伪双目、左右等时长、音频只保留一次。
  - 节拍网格 / Beat Snap / Ctrl+A / Shift 范围 / 组拖拽 / 单次 Undo。
- **R5c-B**
  - `Explore / Rhythm / Cutscene` 正交 GameMode。
  - 默认 Explore；NEU `EnterRhythmMode / PlayCutscene / ExitToExplore`。
  - Rhythm 懒创建 clock/snapshot；自然完成写首演，中途退出不写。
  - Cutscene schema v1：视频/音频/字幕/跳过/未知 id 告警。
- **R5c-B-patch**
  - `?mode=rhythm` 一次性 debug；closeGame / 编辑器返回重置 Explore 并清 sessionStorage。
- GitHub Pages 静态演示、Release 静态包、CI badge、Issue/PR 模板、英文 README。

### Tests

- TypeScript: **442 / 442**
- Rust: **35 / 35**
- Asset checks: **84 / 84**
- Legacy e2e: **9 / 9**
- R5c-B e2e: **3 / 3**

### Known limitations

- GitHub Pages 是静态项目树 showcase；完整编辑器/游戏依赖 Tauri 桌面后端。
- R5c-C 四类 AI 任务尚未实现（只有 C0 契约计划）。
- 媒体导入/单目转双目需要本机 ffmpeg。
- 本版本不发布 Tauri 桌面安装包，只发布 Web 静态包。
