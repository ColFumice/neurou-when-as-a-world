# R5a.1 变更说明 · 离线节拍提取与 beats sidecar

日期：2026-10-25  
状态：**R5a.1 完成，可进入 R5a.2（AudioOutputClock re-anchor）**。

## 1. 范围

R5a.1 只做纯计算与 sidecar 读写：

- 不接 UI；
- 不接 GameScreen；
- 不做 reanchor；
- 不接 NEU 自动对齐；
- 不改 R4a~R4f 任何游戏链路；
- 不新增 A 类名。

新增文件均属于 X/app 层，`Downbeat` / `AudioMarker` A 名保持不变（325 不变）。

## 2. 分析器算法

文件：`v4/app/src/audio/beatAnalyzer.ts`

输入：

```ts
analyzeBeats(samples: Float32Array, sampleRate: number): BeatAnalysisResult
```

流程：

1. 1024 样本帧 / 512 hop，计算短时 RMS 能量。
2. 能量正向差分 + 3 点平滑 → onset envelope。
3. 一阶 120Hz 低通，单独计算低频 onset（用于 4/4 downbeat phase）。
4. onset 峰值检测（mean + 0.5×std，局部极大，最小间隔 2 帧）。
5. 相邻峰值间期聚类：
   - 250–1200ms 过滤；
   - median + 20% inlier；
   - BPM = 60000 / period，限制 60–200。
6. 对 onset envelope 做归一化 autocorrelation（60–200 BPM）细化周期；只在接近间期聚类结果时使用，避免 octave error。
7. 以第一个峰值为 offset 生成 `beatsMs`；按低频 onset 在 4 个 phase 中选择 downbeat。
8. confidence = inlierRatio × 0.65 + peakFactor × 0.2 + autocorrelation × 0.15；低于 0.35 返回 `LowConfidence`。

返回：

```ts
{
  ok: boolean;
  bpm?: number;
  meter?: 4;
  offsetMs?: number;
  beatsMs?: readonly number[];
  downbeatsMs?: readonly number[];
  confidence?: number;
  reason?: 'Silent' | 'NoBeat' | 'LowConfidence';
}
```

边界：

- 静音 → `Silent`
- 峰值不足/间期不足 → `NoBeat`
- 间期不一致 → `LowConfidence`
- 无 DOM / WebAudio / Tauri / React import。

## 3. sidecar schema

文件：`charts/<chartId>.beats.json`  
实现：`v4/app/src/audio/beatsSidecar.ts`

```json
{
  "schemaVersion": 1,
  "chartId": "chart-w1",
  "audioAssetId": "asset:audio:main",
  "audioSha256": "64 lowercase hex",
  "analyzer": "offline-onset-autocorrelation-v1",
  "bpm": 120,
  "meter": 4,
  "offsetMs": 0,
  "beatsMs": [0, 500, 1000, 2000],
  "downbeatsMs": [0, 2000],
  "confidence": 0.92,
  "source": "Detected",
  "generatedAt": "2026-10-25T00:00:00.000Z"
}
```

校验：

- `schemaVersion === 1`
- analyzer/source 固定枚举
- bpm 60–200；meter 4；confidence 0–1
- `audioSha256` 64 位小写 hex
- beats/downbeats 严格升序、非空、非负
- 传入 `durationMs` 时不得越界
- downbeat 必须是 beats 的子集
- 未知字段 / 缺失字段 / 坏 JSON / 版本错误 → `sidecar:null + warnings`
- `currentAudioSha256` 不匹配 → stale，`sidecar:null + warning`
- 缺失文件 → null + warning，不阻塞调用方

API：

```ts
writeBeatsSidecar(projectRoot, chartId, data, io?)
readBeatsSidecar(projectRoot, chartId, options?)
```

`options.io` 用于测试；`currentAudioSha256` / `durationMs` 可由 R5a.3 调用方提供。未提供时 `readBeatsSidecar` 会复用 `media/manifest.json` 中该 audioAssetId 的 sha256 与 durationMs；manifest 缺失则返回 null + warning。  
R5a.1 不接 UI。

## 4. 音频 hash

文件：`v4/app/src/audio/audioHash.ts`

- `sha256Hex(bytes)`：Web Crypto SHA-256（Node 24 / 浏览器均可用），无新 npm 依赖。
- **hash 原始音频文件字节**，不是 decode 后 PCM；避免设备采样率/解码差异导致 sidecar 误失效。
- `hashAudioFile(projectRoot, audioRelPath)`：打开 project root → `media_read_file` 原始字节 → sha256。
- R5a.3 从 media manifest 取得音频相对路径后调用；R5a.1 不写媒体 UI。

## 5. 测试

`v4/tests/r5a/beat-analyzer.test.ts`（4）：

- 120 BPM 合成 click track：BPM 误差 ≤ ±2、downbeat phase ≤20ms。
- 静音 → Silent。
- 白噪声 → NoBeat/LowConfidence。
- 自由速度 irregular clicks → 不 ok。

`v4/tests/r5a/beats-sidecar.test.ts`（10）：

- write/read round-trip；
- manifest 已有 sha256 时自动复用；
- manifest hash stale；
- audioSha256 stale → null + warning；
- bad JSON；
- schemaVersion 错误；
- 时间越界；
- 未知字段；
- 缺少文件；
- sha256("abc") 已知向量。

合计 R5a.1：**14 / 14 pass**。

## 6. 自跑结果

```text
npm run test:v4        388 / 388 pass，83 suites
npm run check:v4       4 gates 0 ERROR / allPassed=true
npm run typecheck:v4   exit 0
v4/app typecheck       exit 0
```

日志：`quality-review/stage-5/r5a/`
（`test-v4.log`、`gates.log`、`typecheck-v4.log`、`app-typecheck.log`）。

## 7. 已知限制 / 风险

1. 分析器针对节奏清晰的电子/点击轨；真实音乐弱拍/自由速度可能低置信，R5a.3 需手动标记兜底。
2. 当前为纯能量/低通算法，不是完整 spectral flux FFT；若后续要求高精度，另批引入 Rust/FFT 分析器。
3. `readBeatsSidecar` 在未显式传入 hash 时复用 media manifest sha256；manifest 缺失时返回 null + warning，不猜测音频路径。
4. 没有 UI、没有 GameScreen 集成；R5a.3 才接 Analyze Beats。
5. 没有 reanchor；R5a.2 才改 AudioOutputClock。

## 8. 一行状态

**R5a.1 完成，可进入 R5a.2。**
