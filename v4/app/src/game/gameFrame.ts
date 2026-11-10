/** GameScreen rAF 一帧的两条独立轨道：R4a 判定快照 + NEU 运行时。 */
export interface GameFrameSnapshot {
  advance(timeMs: number): void;
}

export interface GameFrameNeuRuntime {
  advanceTo(playheadMs: number, playing: boolean): void;
}

export interface GameFrameInput {
  readonly snapshot: GameFrameSnapshot;
  readonly neuRuntime: GameFrameNeuRuntime | null;
}

export interface GameFrameResult {
  /** NEU 异常只回传，不向调用方抛出；R4a 判定已先执行。 */
  readonly neuError: unknown | null;
}

/**
 * 固定顺序：先 snapshot.advance(now)，再 neuRuntime.advanceTo(now, playing)。
 * NEU 轨道被 try/catch 隔离，绝不影响 R4a 判定或 rAF 调度。
 */
export function advanceGameFrame(
  input: GameFrameInput,
  nowMs: number,
  playing: boolean,
): GameFrameResult {
  input.snapshot.advance(nowMs);
  if (!input.neuRuntime) return { neuError: null };
  try {
    input.neuRuntime.advanceTo(nowMs, playing);
    return { neuError: null };
  } catch (error) {
    return { neuError: error };
  }
}
