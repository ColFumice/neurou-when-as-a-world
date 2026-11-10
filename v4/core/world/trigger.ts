/**
 * W · world / trigger
 * 触发器运行实例与五类信号；不 import chart / trace / eventgraph / director。
 *
 * 坐标约定：TriggerRegion 与 update 的 frameRect 使用同一坐标空间。R4c app
 * 使用归一化屏幕坐标 0..1；核心只校验有限值与正面积，不强制单位。
 */

export type TriggerId = string;
export type EventSignalId = string;

/** 触发区域；x/y 为左上角，width/height 必须为正。 */
export interface TriggerRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 视差层定义（前景/中景/背景）。 */
export enum ParallaxLayer {
  Foreground = 'Foreground',
  Midground = 'Midground',
  Background = 'Background',
}

export interface TriggerEnter {
  readonly kind: 'TriggerEnter';
  readonly triggerId: TriggerId;
  readonly eventSignalId: EventSignalId;
  readonly atMs: number;
  readonly occupancy: number;
}

export interface TriggerExit {
  readonly kind: 'TriggerExit';
  readonly triggerId: TriggerId;
  readonly eventSignalId: EventSignalId;
  readonly atMs: number;
  readonly occupancy: number;
}

export interface TriggerDwell {
  readonly kind: 'TriggerDwell';
  readonly triggerId: TriggerId;
  readonly eventSignalId: EventSignalId;
  readonly atMs: number;
  readonly dwellMs: number;
  readonly occupancy: number;
}

export interface TriggerOccupancy {
  readonly kind: 'TriggerOccupancy';
  readonly triggerId: TriggerId;
  readonly eventSignalId: EventSignalId;
  readonly atMs: number;
  readonly occupancy: number;
  readonly threshold: number;
}

export interface TriggerParallax {
  readonly kind: 'TriggerParallax';
  readonly triggerId: TriggerId;
  readonly eventSignalId: EventSignalId;
  readonly atMs: number;
  readonly layer: ParallaxLayer;
  readonly factor: number;
  readonly deltaX: number;
  readonly direction: 'Left' | 'Right';
}

interface TriggerInstanceInput {
  readonly triggerId: TriggerId;
  readonly eventSignalId: EventSignalId;
  readonly region: TriggerRegion;
  readonly dwellMs?: number;
  readonly occupancyThreshold?: number;
  readonly occupancyIntervalMs?: number;
  readonly parallaxLayer?: ParallaxLayer;
  readonly parallaxFactor?: number;
  readonly parallaxStep?: number;
}

interface TriggerUpdateInput {
  readonly nowMs: number;
  readonly frameRect: TriggerRegion;
  readonly frameDeltaX?: number;
}

interface TriggerUpdateResult {
  enter: TriggerEnter | null;
  exit: TriggerExit | null;
  dwell: TriggerDwell | null;
  occupancy: TriggerOccupancy | null;
  parallax: TriggerParallax | null;
}

const DEFAULT_OCCUPANCY_INTERVAL_MS = 250;
const DEFAULT_PARALLAX_FACTOR = 1;
const DEFAULT_PARALLAX_STEP = 0.01;

function fail(message: string): never {
  throw new TypeError(`TriggerInstance: ${message}`);
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    fail(`${label} must be a non-empty string (max 128)`);
  }
  if ([...value].some((character) => character.charCodeAt(0) < 0x20)) {
    fail(`${label} must not contain control characters`);
  }
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${label} must be finite`);
  }
  return value;
}

function region(value: unknown, label: string): TriggerRegion {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  const raw = value as Record<string, unknown>;
  const x = finite(raw.x, `${label}.x`);
  const y = finite(raw.y, `${label}.y`);
  const width = finite(raw.width, `${label}.width`);
  const height = finite(raw.height, `${label}.height`);
  if (width <= 0 || height <= 0) fail(`${label} width/height must be positive`);
  return Object.freeze({ x, y, width, height });
}

function optionalNumber(value: unknown, label: string, fallback: number): number {
  if (value === undefined) return fallback;
  return finite(value, label);
}

function optionalLayer(value: unknown, label: string): ParallaxLayer | null {
  if (value === undefined || value === null) return null;
  if (value !== ParallaxLayer.Foreground
    && value !== ParallaxLayer.Midground
    && value !== ParallaxLayer.Background) {
    fail(`${label} must be Foreground / Midground / Background`);
  }
  return value;
}

function overlapArea(frame: TriggerRegion, target: TriggerRegion): number {
  const left = Math.max(frame.x, target.x);
  const right = Math.min(frame.x + frame.width, target.x + target.width);
  const top = Math.max(frame.y, target.y);
  const bottom = Math.min(frame.y + frame.height, target.y + target.height);
  if (right <= left || bottom <= top) return 0;
  return (right - left) * (bottom - top);
}

/**
 * 单个触发器运行实例。
 * 每次 update 最多返回一条 Enter / Exit / Dwell / Occupancy / Parallax；
 * 同一次 update 可以同时返回 Enter + Occupancy，但不重复发 Enter。
 */
export class TriggerInstance {
  readonly triggerId: TriggerId;
  readonly eventSignalId: EventSignalId;
  readonly region: TriggerRegion;
  readonly dwellMs: number;
  readonly occupancyThreshold: number | null;
  readonly occupancyIntervalMs: number;
  readonly parallaxLayer: ParallaxLayer | null;
  readonly parallaxFactor: number;
  readonly parallaxStep: number;

  private _inside = false;
  private _enteredAtMs: number | null = null;
  private _dwellEmitted = false;
  private _occupancyAbove = false;
  private _lastOccupancyAtMs: number | null = null;
  private _parallaxAccum = 0;

  constructor(input: TriggerInstanceInput) {
    this.triggerId = text(input.triggerId, 'triggerId');
    this.eventSignalId = text(input.eventSignalId, 'eventSignalId');
    this.region = region(input.region, 'region');

    const dwellMs = optionalNumber(input.dwellMs, 'dwellMs', 0);
    if (dwellMs < 0) fail('dwellMs must be >= 0');
    this.dwellMs = dwellMs;

    if (input.occupancyThreshold === undefined) {
      this.occupancyThreshold = null;
    } else {
      const threshold = finite(input.occupancyThreshold, 'occupancyThreshold');
      if (threshold < 0 || threshold > 1) fail('occupancyThreshold must be within 0..1');
      this.occupancyThreshold = threshold;
    }

    const interval = optionalNumber(
      input.occupancyIntervalMs,
      'occupancyIntervalMs',
      DEFAULT_OCCUPANCY_INTERVAL_MS,
    );
    if (interval < 0) fail('occupancyIntervalMs must be >= 0');
    this.occupancyIntervalMs = interval;

    this.parallaxLayer = optionalLayer(input.parallaxLayer, 'parallaxLayer');
    this.parallaxFactor = optionalNumber(
      input.parallaxFactor,
      'parallaxFactor',
      DEFAULT_PARALLAX_FACTOR,
    );
    const step = optionalNumber(input.parallaxStep, 'parallaxStep', DEFAULT_PARALLAX_STEP);
    if (step <= 0) fail('parallaxStep must be > 0');
    this.parallaxStep = step;
  }

  get inside(): boolean {
    return this._inside;
  }

  get enteredAtMs(): number | null {
    return this._enteredAtMs;
  }

  reset(): void {
    this._inside = false;
    this._enteredAtMs = null;
    this._dwellEmitted = false;
    this._occupancyAbove = false;
    this._lastOccupancyAtMs = null;
    this._parallaxAccum = 0;
  }

  update(input: TriggerUpdateInput): TriggerUpdateResult {
    const nowMs = finite(input.nowMs, 'update.nowMs');
    const frameRect = region(input.frameRect, 'update.frameRect');
    const frameDeltaX = optionalNumber(input.frameDeltaX, 'update.frameDeltaX', 0);
    const occupancy = Math.min(
      1,
      Math.max(0, overlapArea(frameRect, this.region) / (this.region.width * this.region.height)),
    );
    const inside = occupancy > 0;
    const wasInside = this._inside;
    const result: TriggerUpdateResult = {
      enter: null,
      exit: null,
      dwell: null,
      occupancy: null,
      parallax: null,
    };

    if (inside && !wasInside) {
      result.enter = {
        kind: 'TriggerEnter',
        triggerId: this.triggerId,
        eventSignalId: this.eventSignalId,
        atMs: nowMs,
        occupancy,
      };
      this._inside = true;
      this._enteredAtMs = nowMs;
      this._dwellEmitted = false;
      this._occupancyAbove = false;
      this._lastOccupancyAtMs = null;
      this._parallaxAccum = 0;
    } else if (!inside && wasInside) {
      result.exit = {
        kind: 'TriggerExit',
        triggerId: this.triggerId,
        eventSignalId: this.eventSignalId,
        atMs: nowMs,
        occupancy: 0,
      };
      this._inside = false;
      this._enteredAtMs = null;
      this._dwellEmitted = false;
      this._occupancyAbove = false;
      this._lastOccupancyAtMs = null;
      this._parallaxAccum = 0;
      return result;
    } else {
      this._inside = inside;
    }

    if (!inside) {
      this._parallaxAccum = 0;
      return result;
    }

    if (this.dwellMs > 0
      && !this._dwellEmitted
      && this._enteredAtMs !== null
      && nowMs - this._enteredAtMs >= this.dwellMs) {
      result.dwell = {
        kind: 'TriggerDwell',
        triggerId: this.triggerId,
        eventSignalId: this.eventSignalId,
        atMs: nowMs,
        dwellMs: this.dwellMs,
        occupancy,
      };
      this._dwellEmitted = true;
    }

    if (this.occupancyThreshold !== null) {
      if (occupancy >= this.occupancyThreshold) {
        const due = !this._occupancyAbove
          || this._lastOccupancyAtMs === null
          || nowMs - this._lastOccupancyAtMs >= this.occupancyIntervalMs;
        if (due) {
          result.occupancy = {
            kind: 'TriggerOccupancy',
            triggerId: this.triggerId,
            eventSignalId: this.eventSignalId,
            atMs: nowMs,
            occupancy,
            threshold: this.occupancyThreshold,
          };
          this._lastOccupancyAtMs = nowMs;
        }
        this._occupancyAbove = true;
      } else {
        this._occupancyAbove = false;
        this._lastOccupancyAtMs = null;
      }
    }

    if (this.parallaxLayer !== null) {
      this._parallaxAccum += frameDeltaX * this.parallaxFactor;
      if (Math.abs(this._parallaxAccum) >= this.parallaxStep) {
        const deltaX = this._parallaxAccum;
        result.parallax = {
          kind: 'TriggerParallax',
          triggerId: this.triggerId,
          eventSignalId: this.eventSignalId,
          atMs: nowMs,
          layer: this.parallaxLayer,
          factor: this.parallaxFactor,
          deltaX,
          direction: deltaX < 0 ? 'Left' : 'Right',
        };
        this._parallaxAccum = 0;
      }
    }

    return result;
  }
}
