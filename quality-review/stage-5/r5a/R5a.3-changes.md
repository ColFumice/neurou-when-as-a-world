# R5a.3 变更说明 · Analyze Beats UI + Downbeat HUD + E2E

日期：2026-10-25  
状态：**R5a.3 完成，R5a 可验收。**

## 1. EditorBeatsPanel

新增：

- `v4/app/src/editor/EditorBeatsPanel.tsx`
- `v4/app/src/editor/beatsPanelModel.ts`
- `EditorScreen.tsx` 挂载 `BEATS` 触发器 / 面板
- `editor.css` 面板样式

能力：

- **Analyze Beats**
  - 从 `media/manifest.json` 取最后一个 stereoPair 的 audio asset；
  - `hashAudioFile` 同源 sha256（优先 manifest sha256）；
  - `TauriMediaImporter.readMediaFile` 读取原始文件；
  - WebAudio `decodeAudioData` 下混为 mono；
  - `analyzeBeats` → 成功写 `charts/<chartId>.beats.json`；
  - 状态：Idle / Analyzing / Ready / LowConfidence / Failed；
  - 显示 BPM / Meter / Confidence / Source / reason。
- **Manual Tap**
  - 点击后记录 4 次 tap；
  - `manualBpm` 计算 BPM；写 `source='Manual'` sidecar；
  - 兜底用于低置信/真实音乐。
- **Remove Beats**
  - 新增 Rust `project_delete_file` 命令 + Tauri capability；
  - `TauriProjectIo.deleteProjectFile()` 删除 sidecar。
- 不写 chart v2 / editor.json；不碰判定/NEU。

## 2. HUD Downbeat

新增：

- `v4/app/src/game/downbeatHud.ts`
- `GameScreen` 读取 `readBeatsSidecar(projectRoot, chart.chartId)`；
- `GameHud` 显示 BPM / Meter / Downbeat 方块。

行为：

- 缺失 sidecar → 不显示，不报错；
- stale `audioSha256` → 不显示；
- playhead 越过 `downbeatsMs` → `is-pulse` 120ms；
- 只做 HUD 信息，不参与判定窗口 / NoteLogo / NEU。

## 3. E2E

新增 `v4/app/tests/e2e/r5a.e2e.mjs`：

1. 备份原始 audio/manifest；
2. 生成 8s 120 BPM 合成 click WAV，更新 manifest sha256/bytes；
3. 打开项目 → 进入 w1 → `/edit` 打开编辑器；
4. 点击 BEATS → Analyze Beats；
5. 验证 sidecar + Ready；
6. 重载进入游戏 → 验证 HUD BPM + Downbeat 脉冲；
7. finally 恢复 audio/manifest，删除 sidecar。

实测：

```text
analyze.ready = true
analyze.sidecarExists = true
BPM 119.94 / CONF 97% / SOURCE Detected

hud.beats = "BPM 119.94 / 4/4"
hud.pulses = [1]
restored = true
```

证据：

- `editor-beats-ready.png`
- `hud-downbeat.png`
- `r5a-e2e.json`

## 4. 测试

`v4/tests/r5a/editor-beats-ui.test.ts`（4）：

- Analyze success → Detected sidecar + Ready；
- silent/low confidence → Failed / LowConfidence；
- Manual Tap → BPM + Manual sidecar；
- 不足/越界 tap → null。

`v4/tests/r5a/hud-downbeat.test.ts`（4）：

- valid beats → BPM/meter 启用；
- playhead 越过 downbeat → 命中；
- missing → 不启用；
- stale audioSha256 → 不启用。

R5a.3 新增 8；R5a 总 **30**；全仓 **404 / 404**。

## 5. 实机验收

已完成：

- 编辑器 Analyze Beats：119.94 BPM / 97% / Detected / Ready。
- Manual Tap：4 tap → 116.41 BPM / Manual / Ready；Remove Beats 删除成功。
- HUD：`BPM 119.94 / 4/4`，Downbeat `is-pulse` 日志 1 次。
- beats.json 缺失：R4f E2E 主路径仍 Perfect 6/6（无 Downbeat，不报错）。
- stale：hud-downbeat 单测覆盖，不启用。

未做真实“静音音频 UI”点击验收；静音分析 + Failed 映射由 `beat-analyzer` 与 `editor-beats-ui` 单测覆盖。

## 6. 自跑

```text
npm run typecheck:v4   exit 0
npm run test:v4        404 / 404 pass，87 suites
npm run check:v4       4 gates 0 ERROR / allPassed=true
v4/app typecheck       exit 0
v4/app build           896 modules / built in 2.65s
cargo test             31 / 31
R4f E2E                Perfect 6/6，restored=true
```

日志：`quality-review/stage-5/r5a/`
（`test-v4.log`、`gates.log`、`typecheck-v4.log`、`app-typecheck.log`、`app-build.log`、`cargo-test.log`）。

## 7. 已知限制

- 未做编辑器时间轴节拍网格（按授权留 R5b）。
- 未做 NEU 自动对齐 / Downbeat 判定加成。
- Remove Beats 新增了一个 Rust 文件删除命令；能力文件已同步。
- 静音 UI 实际点击未单独录制；单测覆盖分析器 + 面板映射。
- 真实音乐低置信依赖 Manual Tap 兜底。
- 不新增 A 类名；使用既有 `Downbeat` / `AudioMarker` 语义，但 sidecar 仍为 X 层 JSON。

## 8. 一行状态

**R5a.3 完成，R5a 可验收。**
