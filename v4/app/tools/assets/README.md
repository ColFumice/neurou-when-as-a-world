# R5b.1 / R5b.2 · 雨若示例资产生成器

这套脚本为 demo 项目从零生成一套可演示的「雨夜城市」资产：双目视频、主题图 / 世界背景 / 引导 Logo、72 秒主题音乐、序言字幕。全部由 DSH 程序化生成，不使用任何外部图片、视频、采样库或第三方 npm 包。

## 资产

| 类型 | 输出 | 规格 |
|---|---|---|
| 视频 | `media/theme/rain-night-left.mp4` / `right.mp4` | 1280×720 / 30fps / H.264 / 无音轨 / 24s |
| 视频循环版 | `media/theme/rain-night-left-loop.mp4` / `right-loop.mp4` | 72s，给 72s 音乐图表用 |
| 图片 | `media/images/theme-rain-night.webp` 等 6 张 | 1920×1080 / WebP q90 / 单图 ≤ 500KB |`n| 透明 Logo | `assets/resources/guidance/rain-night-mark.png` | 512×512 / PNG RGBA / 透明底 |
| 音乐 | `media/audio/theme.wav` | 72s / 90 BPM / 4/4 / 48kHz / 16-bit 双声道 |
| 字幕 | `media/subtitles/prologue.json` + `.srt` | 5 句，5–15 字，段落对齐 |
| 项目数据 | `media/manifest.json` / `charts/chart-w1.editor.json` / `charts/chart-w1.beats.json` | 由 `apply-demo.mjs` 写入 |
| 规格 | `media/theme/video-spec.json` / `images-spec.json` / `music-spec.json` / `theme.json` / `style.json` | 尺寸、时长、哈希、调色参数 |

生成物都在 `.gitignore` 里，只留在本地。

## 目录

```
v4/app/tools/assets/
├─ generate-video.mjs       视频（两线程并行渲染左/右眼）
├─ generate-images.mjs      图片（程序化底板 + 手写 SVG/HTML + Edge headless）`n├─ generate-logo-mark.mjs   512×512 透明 Logo mark（纯 JS 像素绘制）`n├─ generate-sfx.mjs         Layer Audio 占位 SFX（220/440/880Hz）
├─ generate-music.mjs       音乐（纯振荡器/噪声/滤波器/包络 + WAV 写出）
├─ generate-subtitles.mjs   字幕（JSON + SRT）
├─ generate-style.mjs       统一调色 / 风格参数导出
├─ verify-assets.mjs        规格检查（尺寸/时长/体积/哈希）
├─ generate-all.mjs         一键顺序执行
├─ apply-demo.mjs           写入 manifest / chart / beats / world / theme
├─ lib/
│  ├─ style.mjs             统一色板、调色 LUT、暗角、颗粒
│  ├─ surface.mjs           浮点 RGB 画布、模糊、bloom
│  ├─ scene.mjs             雨夜城市底板与逐帧叠加
│  └─ ffmpeg.mjs            ffmpeg/ffprobe/Edge headless 封装
└─ README.md
```

## 快速开始

在仓库根目录：

```powershell
# 一次生成全部并写入 demo project（约 2–4 分钟）
node v4/app/tools/assets/generate-all.mjs

# 或分开跑
node v4/app/tools/assets/generate-video.mjs --preset medium --crf 19
node v4/app/tools/assets/generate-images.mjs
node v4/app/tools/assets/generate-music.mjs
node v4/app/tools/assets/generate-subtitles.mjs
node v4/app/tools/assets/generate-style.mjs
node v4/app/tools/assets/apply-demo.mjs
node v4/app/tools/assets/verify-assets.mjs
```

依赖：Node.js 24+、`ffmpeg` / `ffprobe` 在 PATH 中、本机 Edge 或 Chrome（图片排版用 headless 渲染）。不需要 `npm install` 新包。

## 调参

### 视频

```powershell
node generate-video.mjs --width 1280 --height 720 --fps 30 --duration 24 --seed 20261025
node generate-video.mjs --preset slow --crf 17      # 更高码率
node generate-video.mjs --still --time 3.2         # 只出一张静帧，快速看构图
node generate-video.mjs --no-loop                   # 不生成 72s 循环版
```

- `--duration` 控制单段长度；`--loop` 控制循环版长度（默认 72）。
- 调色、雨量、色板在 `lib/style.mjs` 的 `STYLE` 里；改 `rain.layers` 可调雨丝密度/速度，改 `grade` 可调曝光/对比/饱和。
- 左右眼基线是 `scene.mjs` 里 `eyeShift = 8`（像素）；改这里即可调视差。

### 图片

```powershell
node generate-images.mjs --quality 90 --width 1920 --height 1080
node generate-images.mjs --only theme-rain-night,logo-mark
node generate-images.mjs --force
```

- 场景底图复用 `scene.mjs`，所以视频/图片天然同色。
- 版式在 `generate-images.mjs` 的 `overlay*()` 函数里；字体优先 Noto Serif SC / Source Han Serif SC。
- 超过 500KB 会自动降低 WebP 质量并记录在 `images-spec.json`。

### 音乐

```powershell
node generate-music.mjs --bpm 90 --seconds 72 --sample-rate 48000
node generate-music.mjs --lean                 # 更稀疏、便于 R5a 分析器锁定拍点
node generate-music.mjs --gain 0.9 --seed 42
```

- 段落：4 小节前奏 / 12 小节主歌 / 7 小节副歌 / 4 小节尾奏。
- 改 `BPM` 会整体缩放小节长度；`--seconds` 可覆盖总时长。
- 混音、侧链、混响、延迟都在脚本内；没有采样库。
- 输出 `music-spec.json`（含 RMS、峰值、哈希、节拍网格）和 `beats-grid.json`。

### 字幕

```powershell
node generate-subtitles.mjs
```

句子、时间、样式都在 `LINES` / `STYLE` 常量里；每句会校验 5–15 字与时间轴。

### 接入 demo

```powershell
node apply-demo.mjs
node apply-demo.mjs --dry-run
node apply-demo.mjs --project D:\path\to\project
```

`apply-demo.mjs` 会：

1. 校验视频/音频的尺寸、时长、编码；
2. 向 `media/manifest.json` 追加最新 stereoPair（72s 循环视频 + theme.wav）；
3. 重写 `charts/chart-w1.editor.json`（12 个关键帧、5 个绑定、72s），并写入 `activePairId`；
4. 写入 Manual 90 BPM 的 `chart-w1.beats.json`；
5. 写入 `worlds/w1/world.json` 与 `media/theme/theme.json` / `style.json`；
6. 生成 `quality-review/stage-5/r5b/asset-spec.md`。

## 实机验收

```powershell
node v4/app/tests/e2e/r5b1.e2e.mjs
```

前置：`v4/app/src-tauri/target/debug/neurou-app.exe` 已构建，1420 端口空闲。

脚本会：打开 demo project → 进 w1 → 进编辑器 → 打开 BEATS 面板 → 用新音乐跑 Analyze Beats → 记录结果 → 还原 Manual 90 BPM sidecar → 重载进游戏 → 截图 + 录屏。证据在 `quality-review/stage-5/r5b/evidence/`。

## 已知限制

- R5a 的离线节拍分析器基于 1024/512 的短时能量；面对 **持续 pad/低音 + 密集氛围纹理** 时会出现帧 RMS 混叠，本次 72s 主题曲返回 `LowConfidence`。R5b.2 已把 **Manual BPM / Tap / offset / 网格预览 / 导入导出** 做成一等公民；R5a 分析器本身未改。A3 混合算法不在本批范围。
- 实机 E2E 在无声卡的 headless 环境里会显示 `CLOCK DRIFT WARNING`；音频与视频的 `currentTime` 仍正常推进，BPM 90.00 正常显示。
- 生成的资产不提交 git；`apply-demo.mjs` 改的是本地 demo 项目数据。

## 设计约定

- 主色 `#1a2332` / `#060a0f`，点缀 `#4f8fa8` / `#78d7e6` / `#c08a5e`。
- 中等对比、深阴影、冷暗部、暖高光；统一由 `lib/style.mjs` 的 LUT 施加。
- 视频与图片共用 `scene.mjs`，避免「视频一个色、图片另一个色」。
- 所有文字版式都是手写 SVG/CSS；没有下载字体或图片。
