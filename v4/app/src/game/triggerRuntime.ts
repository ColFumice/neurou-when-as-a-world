import type {
  TriggerDwell,
  TriggerEnter,
  TriggerExit,
  TriggerInstance,
  TriggerOccupancy,
  TriggerParallax,
  TriggerRegion,
} from '../../../core/world/trigger';

export interface TriggerSink {
  enter(signal: TriggerEnter): void;
  exit(signal: TriggerExit): void;
  dwell(signal: TriggerDwell): void;
  occupancy(signal: TriggerOccupancy): void;
  parallax(signal: TriggerParallax): void;
}

/**
 * X · game / trigger runtime。
 * 每帧把 frameRect / frameDeltaX 喂给 TriggerInstance，并把非空信号转发到 sink。
 * 单个实例异常只回调 onError，不打断同一帧其他实例或 rAF。
 */
export class TriggerRuntime {
  private readonly instances: readonly TriggerInstance[];
  private readonly sink: TriggerSink;
  private readonly onError: ((error: unknown) => void) | null;
  private disposed = false;

  constructor(
    instances: readonly TriggerInstance[],
    sink: TriggerSink,
    onError?: (error: unknown) => void,
  ) {
    this.instances = [...instances];
    this.sink = sink;
    this.onError = onError ?? null;
  }

  get instanceCount(): number {
    return this.instances.length;
  }

  advanceTo(
    nowMs: number,
    frameRect: TriggerRegion,
    frameDeltaX = 0,
  ): void {
    if (this.disposed) return;
    for (const instance of this.instances) {
      try {
        const result = instance.update({ nowMs, frameRect, frameDeltaX });
        if (result.enter) this.sink.enter(result.enter);
        if (result.exit) this.sink.exit(result.exit);
        if (result.dwell) this.sink.dwell(result.dwell);
        if (result.occupancy) this.sink.occupancy(result.occupancy);
        if (result.parallax) this.sink.parallax(result.parallax);
      } catch (error) {
        this.report(error);
      }
    }
  }

  reset(): void {
    if (this.disposed) return;
    for (const instance of this.instances) {
      try {
        instance.reset();
      } catch (error) {
        this.report(error);
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
  }

  private report(error: unknown): void {
    if (!this.onError) return;
    try {
      this.onError(error);
    } catch {
      // HUD/error sink itself must not break the game loop.
    }
  }
}
