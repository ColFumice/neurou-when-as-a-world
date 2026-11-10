/**
 * R5c-B · Explore 轻量时钟。
 *
 * Explore 不启动谱面 AudioOutputClock / BGM；视差、Trace、Frame、Trigger 与
 * NEU 控制流只需要一个单调的 performance.now() 时间源。
 */
export class ExploreClock {
  private startedAtMs = 0;
  private offsetMs = 0;
  private running = false;

  start(offsetMs = 0): void {
    this.offsetMs = Math.max(0, offsetMs);
    this.startedAtMs = performance.now();
    this.running = true;
  }

  nowMs(): number {
    if (!this.running) return this.offsetMs;
    return this.offsetMs + Math.max(0, performance.now() - this.startedAtMs);
  }

  pause(): void {
    if (!this.running) return;
    this.offsetMs = this.nowMs();
    this.running = false;
  }

  resume(): void {
    if (this.running) return;
    this.startedAtMs = performance.now();
    this.running = true;
  }

  get isRunning(): boolean {
    return this.running;
  }

  reset(): void {
    this.offsetMs = 0;
    this.running = false;
  }
}
