# R5b.1 / R5b.2 · 示例资产规格报告

生成时间：2026-10-25T15:19:24.838Z
生成器：`v4/app/tools/assets/`（全部由 DSH 从零生成，无外部素材）

## 1. 视频

| 眼睛 | 路径 | 分辨率 | 时长 | 帧率 | 体积 | assetId |
|---|---|---|---|---|---|---|
| Left | `media/theme/rain-night-left-loop.mp4` | 1280×720 | 72.00s | 30 fps | 21.32 MB | `3e47b45fe03a21bc` |
| Right | `media/theme/rain-night-right-loop.mp4` | 1280×720 | 72.00s | 30 fps | 21.31 MB | `4ee4d19a44bf992f` |

- 编码：H.264 / yuv420p / 无音轨 / faststart
- 双目基线：8px（同一程序化底板按机位偏移采样）
- 24s 原始版：`media/theme/rain-night-left.mp4` / `rain-night-right.mp4`
- 72s 循环版：`media/theme/rain-night-left-loop.mp4` / `media/theme/rain-night-right-loop.mp4`
- 抽帧与联系表：`media/theme/posters/`
- 规格文件：`media/theme/video-spec.json`

## 2. 图片

| 名称 | 尺寸 | 体积 | 质量 | sha256 |
|---|---|---|---|---|
| theme-rain-night | 1920×1080 | 96.4 KB | q90 | `d5ce5c3a2db011f7…` |
| world-rain-night | 1920×1080 | 70.4 KB | q90 | `b9f2439c18fc199f…` |
| logo-horizontal | 1920×1080 | 25.9 KB | q90 | `531f6eb7778f62ed…` |
| logo-vertical | 1920×1080 | 19.6 KB | q90 | `5c14c94eb02261df…` |
| logo-mark | 1920×1080 | 18.8 KB | q90 | `85fb1143a911dec9…` |
| logo-title | 1920×1080 | 41.0 KB | q90 | `eeedca73de7ea0e7…` |

- 全部为 1920×1080 WebP，q90，单图 ≤ 500KB（实际均 < 150KB）
- 场景底图与视频共用同一套程序化渲染器和调色
- Logo 版式与动效建议：`media/images/logo-variants.json`
- 规格文件：`media/images/images-spec.json`

### 2.1 Logo：用户 head-logo + 历史 DSH mark

| 项 | 值 |
|---|---|
| **默认运行 Logo** | `assets/resources/guidance/head-logo.png`（R5c-A.0 恢复） |
| 用户 Logo 尺寸 | 172×168 / PNG |
| 历史 DSH mark | `assets/resources/guidance/rain-night-mark.png`（512×512 RGBA；仅 `VITE_NEUROU_LOGO_PATH` 显式启用） |
| 历史 mark 体积 | 14,719 bytes |
| 历史 mark 生成器 | `v4/app/tools/assets/generate-logo-mark.mjs` |
| 约束 | 不替换 `head-logo.png`，不修改任何 Cocos `.meta` |

> 1920×1080 的 `logo-mark` 是版式海报，不能当透明小图标；R5b.2 的 512×512 DSH mark 已降级为历史/显式 fallback。

## 3. 音乐

| 项 | 值 |
|---|---|
| 路径 | `media/audio/theme.wav` |
| 时长 | 72s |
| BPM | 90（4/4） |
| 采样率 / 位深 / 声道 | 48000 Hz / 16-bit / 2 |
| 编码 | PCM s16le |
| 体积 | 13.18 MB |
| 峰值 | -1 dBFS |
| 段落 RMS | intro -23.56 / verse -19.26 / chorus -16.24 / outro -20.76 dB |
| sha256 | `7b3aed0eb3b77aec8a1cf38fa84ea0e8e01d29cb836e20e2fecfbb1b4298cb65` |

结构：4 小节前奏（0–10.667s）→ 12 小节主歌（10.667–42.667s）→ 7 小节副歌（42.667–61.333s）→ 4 小节尾奏（61.333–72s）。  
所有音色由振荡器、噪声、滤波器与包络合成；混响为立体声 Schroeder 网络，延迟为附点八分乒乓。

- 规格文件：`media/audio/music-spec.json`
- 节拍网格：`media/audio/beats-grid.json`
- 图表节拍 sidecar：`charts/chart-w1.beats.json`（Manual 90 BPM，offset 0）

### 3.1 R5c-A.2 Layer Audio 占位 SFX

| 层 | 文件 | 频率 | 时长 | assetId |
|---|---|---|---|---|
| L1 | `media/audio/sfx-hit-layer1.wav` | 220Hz | 150ms | `asset:audio:sfx-layer1` |
| L2 | `media/audio/sfx-hit-layer2.wav` | 440Hz | 150ms | `asset:audio:sfx-layer2` |
| L3 | `media/audio/sfx-hit-layer3.wav` | 880Hz | 150ms | `asset:audio:sfx-layer3` |

- 48kHz / 16-bit mono PCM；纯 JS 合成，生成器 `generate-sfx.mjs`。
- 已登记到 `media/manifest.json`；后续可用真实 SFX 替换 assetId 映射。
- `chart-w1.editor.json` 的 `layerAudio` 默认绑定 L1/L2/L3 三档音高。

## 4. 字幕

- 路径：`media/subtitles/prologue.json` / `prologue.srt`
- 5 句，5–15 字，时间轴与音乐段落对齐
- 样式：Noto Serif SC / 42px / 字距 0.08em / 左下 / 600ms 淡入、800ms 淡出

## 5. 统一调色

- 主色：`#1a2332` / `#060a0f` / `#0a131b`
- 点缀：`#4f8fa8` / `#78d7e6` / `#c08a5e`
- 曝光 1.04 / 对比 1.06 / 饱和 0.86 / gamma 1.02
- 暗角 0.34 / 颗粒 1.7
- 调色参数由 `lib/style.mjs` 统一导出，视频、图片、字幕预览共用

## 6. 复现命令

```powershell
cd v4/app
node tools/assets/generate-video.mjs --preset medium --crf 19
node tools/assets/generate-images.mjs
node tools/assets/generate-logo-mark.mjs
node tools/assets/generate-music.mjs
node tools/assets/generate-subtitles.mjs
node tools/assets/apply-demo.mjs
```

或一键（不含 E2E）：`node tools/assets/generate-all.mjs`

## 7. 备注

- 所有生成媒体写入 `.gitignore`，不进仓库；R5b.2 的透明 Logo mark 是应用资源（`assets/resources/guidance/`），独立于媒体目录。
- 24s 视频与 72s 音乐均为程序化生成；没有使用任何采样库、外部图片或字体文件。
- `media/manifest.json` 的 `activePairId` 指向 `eb5ad96b7054921c`（72s 主题 pair）；旧 8s pair 保留为 fallback / fixture，不删除。
- `Analyze Beats` 是 R5a 冻结的离线分析器，对持续 pad/低音会产生帧 RMS 混叠；本次 demo 的节拍 sidecar 采用 Manual 90 BPM 网格，HUD 与谱面以该网格为准（详见 `R5b.1-changes.md`）。
