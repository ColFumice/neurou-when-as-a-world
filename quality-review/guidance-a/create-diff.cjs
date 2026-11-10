// Workspace has no .git. Reconstruct the recorded pre-edit text by reversing
// this turn's exact edits, then emit a reviewable unified diff with git --no-index.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const root = path.resolve(__dirname, '../..');
const baseline = path.join(__dirname, 'baseline');
function restore(file, edits) {
  let text = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
  for (const [after, before] of edits) {
    if (!(typeof after === 'string' ? text.includes(after) : after.test(text))) {
      throw new Error(`Missing recorded edit in ${file}: ${String(after).slice(0, 90)}`);
    }
    text = text.replace(after, before);
  }
  const dest = path.join(baseline, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, text);
}
restore('constants/index.ts', [[
  '\n/** Head 独立启动窗口，含两个端点；2026-10-09 用户调整为 1000ms。 */\nexport const HEAD_WINDOW_MS = 1000;\n', ''
]]);
restore('src/chart/Strike.ts', [[
  "  /** 带媒体时间的物理按下/松开边沿；旧调用省略时为 Down。 */\n  readonly phase?: 'Down' | 'Up';\n", ''
]]);
restore('src/director/PlayerIntent.ts', [[
  "      /** 引导线边沿采集；世界及既有 T7 省略时保持按下语义。 */\n      readonly phase?: 'Down' | 'Up';\n", ''
]]);
restore('src/chart/KeyboardPadLayout.ts', [[
  `  return keys.map((keyId, index) => {
    const u = leftU + index * slotWidth;
    const rightU = index + 1 === keys.length ? RIGHT_EDGE : leftU + (index + 1) * slotWidth;
    return { keyId, padKind: kindOf(keyId), u, v: vBottom,
      width: rightU - u, height: ROW_HEIGHT };
  });`,
  `  return keys.map((keyId, index) => ({
    keyId,
    padKind: kindOf(keyId),
    u: leftU + index * slotWidth,
    v: vBottom,
    width: slotWidth,
    height: ROW_HEIGHT,
  }));`
], [/\n\/\*\* 半开网格归属；[\s\S]*$/, '']]);
restore('src/chart/ChartPremiere.ts', [
  ["import { parseGuidanceChart } from './GuidanceChart';\nimport type { GuidanceChart } from './GuidanceChart';\nimport { GuidanceLineRuntime } from './GuidanceLineRuntime';\nimport type { GuidanceLineSnapshot, GuidanceJudgement } from './GuidanceLineRuntime';\n", ''],
  ['  /** 引导线只读逻辑快照；兼容旧 ChartData 时返回 null。 */\n  getGuidanceSnapshot(): GuidanceLineSnapshot | null;\n', ''],
  ['  private readonly guidance: GuidanceLineRuntime | null;\n', ''],
  ['constructor(data: ChartData | GuidanceChart,', 'constructor(data: ChartData,'],
  ["    this.guidance = 'lines' in data\n      ? new GuidanceLineRuntime(parseGuidanceChart(data, layout), layout) : null;\n    if ('lines' in data) { return; }\n", ''],
  ['return this.guidance !== null ? 1 : this.noteStatuses.length;', 'return this.noteStatuses.length;'],
  ['    if (this.guidance !== null) { return this.guidance.getResolvedCount(); }\n', ''],
  ['if (this.getTotalNoteCount() === 0)', 'if (this.noteStatuses.length === 0)'],
  ['return this.getResolvedCount() / this.getTotalNoteCount();', 'return this.getResolvedCount() / this.noteStatuses.length;'],
  ['\n  getGuidanceSnapshot(): GuidanceLineSnapshot | null {\n    return this.guidance?.getSnapshot() ?? null;\n  }\n', ''],
  ['      if (this.guidance !== null) { this.applyGuidanceJudgements(this.guidance.advance(0)); }\n', ''],
  ['if (this.allJudgementsSettled() && unavailable', 'if (this.noteStatuses.every(status => status.resolved) && unavailable'],
  [`    // Paused 期间只释放已按住键，不启动、不判定、不移动。
    if (this.state === 'Paused' && strike.phase === 'Up' && this.guidance !== null) {
      this.guidance.submitStrike(strike);
      return;
    }
`, ''],
  [`    if (this.guidance !== null) {
      this.applyGuidanceJudgements(this.guidance.submitStrike(strike));
      if (strike.phase !== 'Up') {
        this.currentTimeMsValue = Math.max(this.currentTimeMsValue, strike.videoTimeMs);
      }
      this.checkCompleted(this.currentTimeMsValue);
      return;
    }
    if (strike.phase === 'Up') { return; }
`, ''],
  [`    if (this.guidance !== null) {
      this.applyGuidanceJudgements(this.guidance.advance(videoTimeMs));
      this.checkCompleted(videoTimeMs);
      return;
    }
`, ''],
  ['    this.guidance?.exit();\n', ''], ['    this.guidance?.reset();\n', ''],
  [/\n  private applyGuidanceJudgements\([\s\S]*?\n  \/\*\* 同槽候选/, '\n  /** 同槽候选'],
  ['if (this.allJudgementsSettled() &&\n', 'if (this.noteStatuses.every((status) => status.resolved) &&\n'],
]);
restore('src/director/IntentPort.ts', [
  ['  /** 媒体结束/异常只读探针；在本帧输入消费后执行 R26 B。 */\n  private chartMediaProbe: (() => { ended: boolean; unavailable: boolean }) | null = null;\n', ''],
  ['\n  bindChartMediaProbe(probe: () => { ended: boolean; unavailable: boolean }): void {\n    this.chartMediaProbe = probe;\n  }\n', ''],
  ['              phase: intent.phase,\n', ''],
  ['this.driveChartPlayback(frameDurationSeconds);', 'this.driveChartPlayback();'],
  ['private driveChartPlayback(frameDurationSeconds: number): void', 'private driveChartPlayback(): void'],
  [`    const media = this.chartMediaProbe?.();
    if (media !== undefined) {
      this.chartPremiere.advanceMediaStatus(media.ended, media.unavailable, frameDurationSeconds * 1000);
    }
`, ''],
]);
restore('src/presentation/InputCollector.ts', [
  ['    const state = this.readChartState();\n    const mediaTime = this.chartTimeProbe?.() ?? -1;\n    const releaseKeys = [...this.physicalKeysDown].map(resolveChartKeyId);\n', ''],
  [`    // 焦点丢失可能没有原生 keyup；清采集状态也必须释放逻辑边沿守卫。
    if ((state === 'Playing' || state === 'Paused') && Number.isFinite(mediaTime) && mediaTime >= 0) {
      for (const keyId of releaseKeys) {
        if (keyId !== null) {
          this.discreteIntents.push({ kind: 'Strike', videoTimeMs: mediaTime, keyId, phase: 'Up' });
        }
      }
    }
`, ''],
  [`    const state = this.readChartState();
    if (state === 'Playing' || state === 'Paused') {
      const keyId = resolveChartKeyId(code);
      const mediaTime = this.chartTimeProbe?.() ?? -1;
      if (keyId !== null && Number.isFinite(mediaTime) && mediaTime >= 0) {
        this.discreteIntents.push({ kind: 'Strike', videoTimeMs: mediaTime, keyId, phase: 'Up' });
      }
    }
`, ''],
  ["      phase: 'Down',\n", ''],
]);
restore('assets/scripts/SceneBuilder.ts', [
  ['  SpriteFrame,\n', ''],
  ["import { parseGuidanceChart } from './src/chart/GuidanceChart';\nimport type { GuidanceChart } from './src/chart/GuidanceChart';\n", ''],
  ["  /** 保留旧 T7 资源入口；A 步默认加载独立引导线谱面。 */\n  @property({ tooltip: '使用 A 步 Head + Tap 谱面；关闭可运行原 T7' })\n  UseGuidanceChart = true;\n", ''],
  ['private chartData: ChartData | GuidanceChart | null', 'private chartData: ChartData | null'],
  ['  private chartFallbackTimeMs = -1;\n', ''],
  [/    resources.load\('guidance\/head-logo\/spriteFrame'[\s\S]*?    \}\);\n/, ''],
  ['// —— 独立谱面 JSON：引导线严格拒绝非法/超范围数据；旧 T7 保留 ——', '// —— 谱面 JSON：解析失败 / 缺失 → 回退确定性谱面 ——'],
  ["this.UseGuidanceChart ? 'chart/guidance_a' : 'chart/chart_placeholder',", "'chart/chart_placeholder',"],
  [/        if \(this.UseGuidanceChart\) \{[\s\S]*?          return;\n        \}\n/, ''],
  [`      // 这里只提供媒体时间；判定推进归 director，先消费本帧时间戳输入。
      if (unavailable && !ended && this.chartMediaUnavailableElapsedMs >= CHART_MEDIA_END_TIMEOUT_MS) {
        if (state === 'Ready' || state === 'Playing') {
          this.chartFallbackTimeMs = this.chartPremiere.getCurrentTimeMs() + dt * 1000;
        }
      }
`, `      // Failed loading / stalled media still resolves Notes on an independent clock.
      // Paused premieres ignore both advance calls, so neither timeout nor Notes move.
      if (unavailable && !ended && this.chartMediaUnavailableElapsedMs >= CHART_MEDIA_END_TIMEOUT_MS) {
        this.chartPremiere.begin();
        this.chartPremiere.advance(this.chartPremiere.getCurrentTimeMs() + dt * 1000);
      } else {
        const timeMs = this.audioOutputClock.readChartTimeMs();
        if (timeMs >= 0) { this.chartPremiere.advance(timeMs); }
      }
      this.chartPremiere.advanceMediaStatus(ended, unavailable, dt * 1000);
`],
  [/        if \(this.videoPlayer && this.chartPremiere\) \{[\s\S]*?        \}\n/, ''],
  ["    if (this.chartPremiere?.getState() === 'Paused') { return this.chartPremiere.getCurrentTimeMs(); }\n    return Math.max(this.audioOutputClock.readChartTimeMs(), this.chartFallbackTimeMs);", '    return Math.max(this.audioOutputClock.readChartTimeMs(), this.chartPremiere?.getCurrentTimeMs() ?? -1);'],
  [`    this.graph.session.bindChartMediaProbe(() => ({
      ended: this.audioOutputClock.hasChartMediaEnded(),
      unavailable: this.audioOutputClock.isChartMediaUnavailable(),
    }));
`, ''],
  ['    this.chartFallbackTimeMs = -1;\n', ''],
]);
const changed = ['constants/index.ts', 'src/chart/KeyboardPadLayout.ts', 'src/chart/ChartPremiere.ts',
  'src/chart/Strike.ts', 'src/director/PlayerIntent.ts', 'src/director/IntentPort.ts',
  'src/presentation/InputCollector.ts', 'src/presentation/ChartPadView.ts', 'assets/scripts/SceneBuilder.ts'];
const added = ['src/chart/GuidanceChart.ts', 'src/chart/GuidanceChart.ts.meta',
  'src/chart/GuidanceLineRuntime.ts', 'src/chart/GuidanceLineRuntime.ts.meta',
  'src/presentation/LineEraseEffect.ts', 'src/presentation/LineEraseEffect.ts.meta',
  'assets/resources/chart/guidance_a.json', 'assets/resources/chart/guidance_a.json.meta',
  'assets/resources/guidance.meta', 'assets/resources/guidance/head-logo.png', 'assets/resources/guidance/head-logo.png.meta'];
let diff = '';
for (const file of [...changed, ...added]) {
  const before = changed.includes(file) ? path.relative(root, path.join(baseline, file)).replace(/\\/g, '/') : 'NUL';
  const after = file;
  const result = cp.spawnSync('git', ['diff', '--no-index', '--ignore-space-at-eol', '--', before, after], { encoding: 'utf8', cwd: root });
  if (result.status > 1 || result.error) throw result.error ?? new Error(result.stderr);
  diff += result.stdout.replaceAll(`a/${before}`, `a/${file}`);
}
fs.writeFileSync(path.join(__dirname, 'implementation.diff'), diff);
fs.writeFileSync(path.join(__dirname, 'files.json'), JSON.stringify({ baselineMethod: 'Exact reversal of recorded edits; no Git repository available', changed, added }, null, 2) + '\n');
console.log(`Diff generated for ${changed.length} modified and ${added.length} added files.`);
