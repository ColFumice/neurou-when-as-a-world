# R5b.1 变更记录 · 雨若示例资产包

日期：2026-10-25
范围：R5b.1（仅示例资产、demo 项目数据、生成脚本、验收证据；不改 R4a–R4f / R5a 游戏逻辑）

## 1. 一句话状态

**完成**：DSH 从零生成了 24s 双目雨夜视频（72s 循环版）、6 张 1920×1080 WebP、72s / 90 BPM 主题音乐、5 句序言字幕，并接入 demo project；404/404 单测通过，Tauri 实机 E2E 显示新视频/新音乐/BPM 90.00，截图与录屏已留证。

唯一保留项：R5a 的离线 Analyze Beats 对持续 pad / 低音的氛围混音返回 `LowConfidence`；demo 使用 **Manual 90 BPM** sidecar，HUD 与谱面按 90 BPM 网格运行。原因与证据见第 8 节。

## 2. 交付物

| # | 交付 | 路径 |
|---|---|---|
| 1 | 视频生成脚本 | `v4/app/tools/assets/generate-video.mjs` |
| 2 | 图片生成脚本 | `v4/app/tools/assets/generate-images.mjs` |
| 3 | 音乐生成脚本 | `v4/app/tools/assets/generate-music.mjs` |
| 4 | 字幕生成脚本 | `v4/app/tools/assets/generate-subtitles.mjs` |
| 5 | 统一风格 / 一键 / 接入 / 验证 | `v4/app/tools/assets/generate-style.mjs`、`generate-all.mjs`、`apply-demo.mjs`、`verify-assets.mjs` |
| 6 | 共享库 | `v4/app/tools/assets/lib/{style,surface,scene,ffmpeg}.mjs` |
| 7 | 生成资产 | `v4/.stereo-demo/project/media/{theme,images,audio,subtitles}/` |
| 8 | 规格报告 | `quality-review/stage-5/r5b/asset-spec.md` / `asset-spec.json` |
| 9 | 使用说明 | `v4/app/tools/assets/README.md` |
| 10 | 本文档 | `quality-review/stage-5/r5b/R5b.1-changes.md` |
| 11 | 实机证据 | `quality-review/stage-5/r5b/evidence/` |

## 3. 资产规格

### 3.1 视频

| 眼睛 | 文件 | 分辨率 | 时长 | 帧率 | 体积 |
|---|---|---|---|---|---|
| Left | `media/theme/rain-night-left.mp4` | 1280×720 | 24.00s | 30 | 6.58 MB |
| Right | `media/theme/rain-night-right.mp4` | 1280×720 | 24.00s | 30 | 6.61 MB |
| Left loop | `media/theme/rain-night-left-loop.mp4` | 1280×720 | 72.00s | 30 | 22.36 MB |
| Right loop | `media/theme/rain-night-right-loop.mp4` | 1280×720 | 72.00s | 30 | 22.35 MB |

- H.264 / yuv420p / 无音轨 / faststart / CRF 19 / `-tune film`。
- 双目基线 8px：同一程序化底板按机位水平偏移采样，右眼 +8px。
- 24s 原始版用于规格验收；72s 循环版是 manifest 的当前 stereoPair，覆盖 72s 音乐。
- 抽帧：`media/theme/posters/still-01..03.png`；联系表：`posters/contact-sheet.png`。
- 场景内容：雨夜城市、玻璃幕墙、霓虹「雨」字灯箱、湿地倒影、撑伞的人、靠边停的车、雨丝/涟漪/颗粒/暗角。

### 3.2 图片

| 文件 | 尺寸 | 体积 | 质量 |
|---|---|---|---|
| `theme-rain-night.webp` | 1920×1080 | 98.7 KB | q90 |
| `world-rain-night.webp` | 1920×1080 | 72.1 KB | q90 |
| `logo-horizontal.webp` | 1920×1080 | 26.5 KB | q90 |
| `logo-vertical.webp` | 1920×1080 | 20.1 KB | q90 |
| `logo-mark.webp` | 1920×1080 | 19.3 KB | q90 |
| `logo-title.webp` | 1920×1080 | 42.0 KB | q90 |

- 6 张全部 ≤ 500KB（实际均 < 100KB）。
- 场景底板与视频共用 `lib/scene.mjs`，文字版式是手写 SVG/CSS，由本机 Edge headless 渲染，无外部图片/字体文件。
- Logo 动效建议：`media/images/logo-variants.json`（FadeDown / Truncate / ScaleUp + Glow / FadeUp + Tracking）。

### 3.3 音乐

- `media/audio/theme.wav`：72.00s / 90 BPM / 4/4 / 48kHz / 16-bit / 双声道 / PCM s16le / 13.82 MB。
- 结构：4 小节前奏（0–10.667s）→ 12 小节主歌（10.667–42.667s）→ 7 小节副歌（42.667–61.333s）→ 4 小节尾奏（61.333–72s）。
- RMS：intro −23.56 dB / verse −19.26 dB / chorus −16.24 dB / outro −20.76 dB；峰值 −1.00 dBFS。
- 全部由振荡器、噪声、滤波器、包络合成；立体声 Schroeder 混响 + 附点八分乒乓延迟 + kick sidechain；无采样库。
- `media/audio/music-spec.json` 记录哈希、段落、BPM、节拍网格；`beats-grid.json` 是同一网格的独立副本。

### 3.4 字幕

- `media/subtitles/prologue.json` + `prologue.srt`。
- 5 句，5–15 字：
  1. 雨落了很久。（1.0–8.0s）
  2. 霓虹在水里，比在墙上更亮。（11.0–19.0s）
  3. 有些名字，只在关机前出现。（27.0–35.0s）
  4. 光开始有了重量。（43.0–51.0s）
  5. 这里曾经有过名字。（61.5–69.5s）
- 样式：Noto Serif SC / 42px / 0.08em 字距 / 左下 / 600ms 淡入、800ms 淡出。
- `worlds/w1/world.json` 同时写入 `prologue.lines` 与字幕资源引用，供 R5b.2 直接消费。

## 4. demo 项目数据变更

只改 demo 项目数据，不改游戏逻辑：

- `media/manifest.json`：追加 stereoPair `eb5ad96b7054921c`，包含 72s 左右眼循环视频与 theme.wav；旧 8s pair 保留在数组中，加载逻辑仍取最后一对。
- `charts/chart-w1.editor.json`：duration 8000 → 72000ms；12 个关键帧（layer 1 ×4 / layer 2 ×5 / layer 3 ×3）；5 个绑定；5 个效果接口；NEU 模块 chain 保留，Audio duration 改为 72000。
- `charts/chart-w1.editor.json.bak`：与新 chart 同内容。
- `charts/chart-w1.holds.json`：空 crossings。
- `charts/chart-w1.beats.json`：Manual / 90 BPM / offset 0 / 108 beats / 27 downbeats / confidence 1 / audioSha256 与 theme.wav 一致。
- `worlds/w1/world.json`：新增，含 prologue、themeColor、media 引用。
- `media/theme/theme.json`：主题资产目录，供 R5b.2 直接读取。
- `media/theme/style.json`：统一调色参数（色板 / LUT / 暗角 / 颗粒 / 雨量 / bloom）。

> 为什么 chart 只有 12 个关键帧：`NoteLogoLayer` 会给 layer 1/2 的每个 note 自动生成 Logo；72s、24 note 的版本会在同一屏幕上堆出多枚大白 Logo，遮挡画面。R5b.1 的目标是资产演示，12 帧足以覆盖四段结构并保持画面干净。R5b.2 接正式 demo 时可再扩谱。

## 5. 生成脚本与调参

```powershell
cd v4/app

# 全部
node tools/assets/generate-all.mjs

# 单步
node tools/assets/generate-video.mjs --preset medium --crf 19
node tools/assets/generate-images.mjs
node tools/assets/generate-music.mjs
node tools/assets/generate-subtitles.mjs
node tools/assets/generate-style.mjs
node tools/assets/apply-demo.mjs
node tools/assets/verify-assets.mjs
```

常用参数：

- 视频：`--width/--height/--fps/--duration/--seed/--crf/--preset/--loop/--no-loop`；`--still --time 3.2` 只出静帧。
- 图片：`--quality 90`、`--only theme-rain-night,logo-mark`、`--force`。
- 音乐：`--bpm 90`、`--seconds 72`、`--sample-rate 48000`、`--gain 0.9`、`--seed 42`、`--lean`（更稀疏、更利于节拍分析）。
- 字幕：改 `generate-subtitles.mjs` 的 `LINES` / `STYLE`。
- 统一色调：`lib/style.mjs` 的 `STYLE`；改 `grade`、`rain.layers`、`palette` 后重跑视频/图片。

完整说明见 `v4/app/tools/assets/README.md`。

## 6. 验证

### 6.1 单测

```text
npm run test:v4
tests 404 / pass 404 / fail 0
```

`npm run typecheck:v4`、`npm run check:v4` 均通过（0 errors）。

资产规格检查：

```text
node tools/assets/verify-assets.mjs
[verify] PASS · 68 checks · quality-review/stage-5/r5b/asset-verify.json
```

### 6.2 实机 E2E

脚本：`v4/app/tests/e2e/r5b1.e2e.mjs`
结果：`quality-review/stage-5/r5b/evidence/r5b1-e2e.json`
截图：
- `editor-beats-manual.png`：BEATS 面板 READY / 90.00 / 4 / 100% / Manual。
- `editor-beats-analyze.png`：用新音乐跑 Analyze Beats 的结果（LowConfidence）。
- `game-ready.png`：chart-w1 / w1 · EDITOR · 12 NOTES / START。
- `game-playing-06s.png`、`game-playing-13s.png`：新视频背景、雨、霓虹、车、人物、BPM 90.00、072.000。
- `audio-waveform.png`、`audio-spectrum.png`：72s 主题音乐的波形与频谱（低/中/高频平衡、段落能量）。
录屏：`r5b1-game.mp4`（桌面录制，约 18s，3.46 MB）。

E2E 关键读数：
- HUD：`BPM 90.00` / `4/4` / `072.000`。
- 视频：`readyState=4`、`duration=72`、`currentTime` 3.17 → 10.47s 正常推进。
- 画布：1280×800（WebGL2）。
- `MISS` 计数存在，因为自动化脚本没有按谱面击键；不影响资产显示与音乐播放。
- 无声卡 headless 环境出现 `CLOCK DRIFT WARNING`；音频/视频时钟仍推进，BPM 显示正常。

## 7. 约束核对

| 约束 | 结果 |
|---|---|
| 不借用外部素材 | 全部程序化生成；无外部图片/视频/采样/字体文件 |
| 不引入新 npm / Rust 依赖 | 只用了 Node 内置模块 + 本机 ffmpeg/ffprobe + 本机 Edge headless |
| 脚本可复用 / 参数化 | 每个生成器都有 CLI 参数；共享 `lib/style.mjs` |
| 资产不进 git | 已把 `media/theme|images|audio|subtitles`、beats、world 写入 `.gitignore` |
| 不改 R4a–R4f / R5a 逻辑 | 未改 `src/`、`core/`、`adapters/`；只新增工具、E2E 与 demo 数据 |
| 脚本在 `v4/app/tools/assets/` | 是 |

## 8. 已知限制：Analyze Beats 对氛围混音返回 LowConfidence

R5a 的 `beatAnalyzer.ts` 用 1024/512 的短时帧能量 + 峰值/间期聚类。它对 click track 有效，但对本曲的持续 pad、低音与密集和声纹理会：

1. 21ms 分析帧内的低频/和弦干涉造成帧 RMS 波动，被误当成额外 onset；
2. 峰值间隔中位数被拉短；
3. 最终 `inlierRatio` 不足，返回 `LowConfidence`。

实机截图 `editor-beats-analyze.png` 记录了 `STATUS / LOWCONFIDENCE`、`REASON / LowConfidence`。本次没有改 R5a 分析器（冻结），而是：

- 由 `apply-demo.mjs` 写入 **Manual 90 BPM / offset 0 / 108 beats** sidecar；
- 编辑器 BEATS 面板显示 `READY / 90.00 / Manual / 100%`；
- 游戏 HUD 显示 `BPM 90.00` 并按 90 BPM 网格提示 downbeat；
- 谱面/字幕/音乐段落都按 90 BPM / 72s 对齐。

后续若要自动分析通过，建议 R5b.2 二选一：
- 用更稀疏的 stem（去掉持续 pad/低音）给分析器；
- 或在 R5a 分析器里加入低频帧 RMS 平滑 / 多频带 onset（属于 R5a.4 范围，需重新冻结）。

## 9. 下一步（R5b.2 建议）

1. 把 `media/images/logo-*.webp` 接入 `GAME_LOGO_PATH` 或编辑器资源栏，替换当前 built-in head-logo。
2. 把 `media/theme/theme.json` 作为主题目录读取，接入世界背景/标题卡/字幕层。
3. 需要更密集的谱面时扩到 24–32 个关键帧，并处理 NoteLogoLayer 的 Logo 堆叠（按 keyframe 控制显示，或只对特定 layer 生成）。
4. 若要 Analyze Beats 自动通过，按第 8 节处理 stem 或分析器。
5. 用真实声卡复核 `CLOCK DRIFT WARNING` 是否只是在 headless/无声卡环境出现。

## 10. 一句话状态（收尾）

**R5b.1 完成：资产已生成、已接入、已实机跑通；唯一保留项是 R5a 分析器对氛围混音的 LowConfidence，已由 Manual 90 BPM sidecar 兜底并留证。**
