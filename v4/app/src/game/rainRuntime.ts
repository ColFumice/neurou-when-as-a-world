import {
  RainIntensity,
  RainModeState,
} from '../../../core/world/types';
import type {
  LocationResolver,
  WeatherResolver,
} from '../adapters/rainAdapters';

export interface RainRuntimeOptions {
  readonly locationResolver: LocationResolver;
  readonly weatherResolver: WeatherResolver;
  readonly now: () => number;
  readonly onStateChange?: (state: RainModeState) => void;
}

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const BACKOFF_MS = [30_000, 60_000, 120_000, 240_000] as const;

/**
 * X · RainRuntime
 * 纯状态机：不 import React / Pixi / DOM。
 * - 默认关闭，setEnabled(true) 才发请求；
 * - 失败只更新 RainModeState，不修改 PerceptionMode；
 * - advanceTo 可由游戏 rAF 调用，异常不会向外抛。
 */
export class RainRuntime {
  private readonly locationResolver: LocationResolver;
  private readonly weatherResolver: WeatherResolver;
  private readonly now: () => number;
  private readonly onStateChange?: (state: RainModeState) => void;

  private _enabled = false;
  private _state = new RainModeState();
  private _inFlight = false;
  private _generation = 0;
  private _backoffIndex = 0;
  private _nextAttemptAt: number | null = null;

  constructor(options: RainRuntimeOptions) {
    this.locationResolver = options.locationResolver;
    this.weatherResolver = options.weatherResolver;
    this.now = options.now;
    this.onStateChange = options.onStateChange;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get state(): RainModeState {
    return this._state;
  }

  /**
   * 用户显式开关。关闭时不发请求；重新开启时立即刷新并重置退避。
   * 返回值只用于测试/调用方等待，不影响 rAF。
   */
  async setEnabled(enabled: boolean): Promise<void> {
    if (enabled === this._enabled) return;
    this._enabled = enabled;
    this._generation += 1;
    if (!enabled) {
      this._nextAttemptAt = null;
      this._backoffIndex = 0;
      this.publish(RainModeState.updateRainModeState(this._state, {
        active: false,
        degradedReason: null,
      }));
      return;
    }
    this._backoffIndex = 0;
    this._nextAttemptAt = null;
    await this.refresh();
  }

  /** IP → 天气 → RainModeState；异常全部吞掉并降级。 */
  async refresh(): Promise<RainModeState> {
    if (!this._enabled || this._inFlight) return this._state;
    this._inFlight = true;
    this._generation += 1;
    const token = this._generation;
    this._nextAttemptAt = null;
    try {
      const location = await this.locationResolver.resolve();
      if (!this.stillCurrent(token)) return this._state;
      if (!location.ok) {
        this.fail(
          location.reason === 'ParseError' ? 'LocationUnavailable' : 'NetworkUnavailable',
        );
        return this._state;
      }

      const weather = await this.weatherResolver.resolve(
        location.latitude,
        location.longitude,
      );
      if (!this.stillCurrent(token)) return this._state;
      if (!weather.ok) {
        this.fail(
          weather.reason === 'ParseError' ? 'WeatherUnavailable' : 'NetworkUnavailable',
        );
        return this._state;
      }

      const intensity = RainModeState.mapRainIntensity(
        weather.weatherCode,
        weather.precipitationMm,
      );
      const now = this.now();
      this._backoffIndex = 0;
      this._nextAttemptAt = now + REFRESH_INTERVAL_MS;
      this.publish(RainModeState.updateRainModeState(this._state, {
        active: intensity !== null,
        intensity: intensity ?? RainIntensity.Light,
        degradedReason: null,
        lastResolvedAt: now,
        source: 'IpWeather',
      }));
      return this._state;
    } catch {
      if (this.stillCurrent(token)) this.fail('NetworkUnavailable');
      return this._state;
    } finally {
      this._inFlight = false;
    }
  }

  /** 每帧调用；到期才刷新。返回 Promise 仅供测试等待。 */
  async advanceTo(nowMs: number): Promise<void> {
    if (!this._enabled || this._nextAttemptAt === null) return;
    if (nowMs < this._nextAttemptAt) return;
    await this.refresh();
  }

  /** 浏览器 online 事件由 app 层转发到这里；立即重试一次。 */
  async notifyOnline(): Promise<void> {
    if (!this._enabled) return;
    this._backoffIndex = 0;
    this._nextAttemptAt = null;
    await this.refresh();
  }

  private stillCurrent(token: number): boolean {
    return this._enabled && token === this._generation;
  }

  private fail(reason: RainModeState['degradedReason']): void {
    const now = this.now();
    const delay = BACKOFF_MS[Math.min(this._backoffIndex, BACKOFF_MS.length - 1)];
    this._backoffIndex = Math.min(this._backoffIndex + 1, BACKOFF_MS.length - 1);
    this._nextAttemptAt = now + delay;
    this.publish(RainModeState.updateRainModeState(this._state, {
      active: false,
      degradedReason: reason,
      lastResolvedAt: now,
      source: 'IpWeather',
    }));
  }

  private publish(next: RainModeState): void {
    this._state = next;
    try {
      this.onStateChange?.(next);
    } catch {
      // UI/游戏回调异常不能中断 rAF 或状态机。
    }
  }
}
