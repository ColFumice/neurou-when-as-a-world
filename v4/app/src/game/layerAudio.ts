/**
 * R5c-A.2 · Layer Audio 命中优先级门。
 *
 * 判定层只负责命中回调；本类只记录“最近一次 Layer Audio 的 16ms 窗口”，
 * 供 GamePlaybackSink 的 audio.play wrapper 丢弃同 tick 的 binding/NEU 音频。
 * 不依赖 React / DOM / 判定数学。
 */
export const LAYER_AUDIO_WINDOW_MS = 16;

export interface LayerAudioGuard {
  readonly assetId: string;
  readonly untilMs: number;
}

export class LayerAudioGate {
  private guard: LayerAudioGuard | null = null;

  /** 同一 asset 在窗口内只允许触发一次。 */
  isDuplicate(assetId: string, nowMs: number): boolean {
    return this.guard !== null
      && this.guard.assetId === assetId
      && nowMs < this.guard.untilMs;
  }

  /** 命中后窗口内，所有非 BGM 音频让位。 */
  shouldSuppress(nowMs: number): boolean {
    return this.guard !== null && nowMs < this.guard.untilMs;
  }

  mark(assetId: string, nowMs: number): LayerAudioGuard {
    this.guard = { assetId, untilMs: nowMs + LAYER_AUDIO_WINDOW_MS };
    return this.guard;
  }

  reset(): void {
    this.guard = null;
  }

  snapshot(): LayerAudioGuard | null {
    return this.guard;
  }
}
