import type { TimelineStateMachine } from '../timeline/types';

/**
 * W · world
 * 世界实例、2.5D 视差配置、时间轴状态与 Rain 运行态。
 * R2 只定义类型；不 import presentation / PixiJS。
 */

/** 世界种类：Primary / Secondary。Shore 为 C 类废止值，不进代码。 */
export enum WorldKind {
  Primary = 'Primary',
  Secondary = 'Secondary',
}

/** 2.5D 视差挂载点。R2 为空标记接口；R3 填入 Pixi Container。 */
export interface WorldMap {}

/** 视差层（只读）。 */
export interface Layer {
  readonly index: number;
  readonly parallaxFactor: number;
}

/** 世界主题色（0..255）。 */
export interface WorldThemeColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** 生成点：横轴坐标 + 时间轴锚点。 */
export interface SpawnPoint {
  readonly lateral: number;
  readonly timelineMs: number;
}

/** 生成区：横轴区间。 */
export interface SpawnZone {
  readonly startLateral: number;
  readonly endLateral: number;
}

/** 地图中点（横轴坐标）。 */
export interface MapCenter {
  readonly lateral: LateralAxis;
}

/** 中心距离（WorldMeter 值）。 */
export interface CenterDistance {
  readonly worldMeters: number;
}

/** 事件距离（WorldMeter 值）。 */
export interface EventDistance {
  readonly worldMeters: number;
}

/** 世界长度单位值。 */
export interface WorldMeter {
  readonly value: number;
}

/** 刻度参照：像素 / WorldMeter。 */
export interface ScaleRef {
  readonly pixelsPerWorldMeter: number;
}

/** 地图刻度校准。 */
export interface MapScaleCalibration {
  readonly scaleRef: ScaleRef;
  readonly calibrationFactor: number;
}

/** 横轴坐标（WorldMeter 值）。 */
export interface LateralAxis {
  readonly worldMeters: number;
}

/** 事件树节点指向的世界容器。 */
export interface WorldFolder {
  readonly folderId: string;
}

/** 初始世界入口模板。 */
export interface InitialWorld {
  readonly worldId: string;
}

/** 空世界模板。 */
export interface EmptyWorld {
  readonly templateId: string;
}

/** 感知模式：Normal / Triggered / Rain。 */
export enum PerceptionMode {
  Normal = 'Normal',
  Triggered = 'Triggered',
  Rain = 'Rain',
}

/** 雨强：Light / Moderate / Heavy。 */
export enum RainIntensity {
  Light = 'Light',
  Moderate = 'Moderate',
  Heavy = 'Heavy',
}

const SNOW_WEATHER_CODES = new Set([71, 73, 75, 77, 85, 86]);
const RAIN_WEATHER_CODES = new Set([
  51, 53, 55, 56, 57,
  61, 63, 65, 66, 67,
  80, 81, 82,
  95, 96, 99,
]);

/**
 * Rain 模式运行态。
 * active 表示“有效视觉”；PerceptionMode 的 Rain 由 GameScreen 负责，
 * 两者分离，避免天气失败时把感知模式一起改掉。
 */
export class RainModeState {
  readonly active: boolean;
  readonly intensity: RainIntensity;
  readonly degradedReason:
    | 'LocationUnavailable'
    | 'WeatherUnavailable'
    | 'NetworkUnavailable'
    | null;
  readonly lastResolvedAt: number | null;
  readonly source: 'IpWeather' | 'Manual';

  constructor(input: {
    readonly active?: boolean;
    readonly intensity?: RainIntensity;
    readonly degradedReason?: RainModeState['degradedReason'];
    readonly lastResolvedAt?: number | null;
    readonly source?: 'IpWeather' | 'Manual';
  } = {}) {
    this.active = input.active ?? false;
    this.intensity = input.intensity ?? RainIntensity.Light;
    this.degradedReason = input.degradedReason ?? null;
    this.lastResolvedAt = input.lastResolvedAt ?? null;
    this.source = input.source ?? 'IpWeather';
  }

  /** 纯状态更新；返回新对象，不修改 current。 */
  static updateRainModeState(
    current: RainModeState,
    input: {
      readonly active?: boolean;
      readonly intensity?: RainIntensity;
      readonly degradedReason?: RainModeState['degradedReason'];
      readonly lastResolvedAt?: number | null;
      readonly source?: 'IpWeather' | 'Manual';
    },
  ): RainModeState {
    return new RainModeState({
      active: input.active ?? current.active,
      intensity: input.intensity ?? current.intensity,
      degradedReason: 'degradedReason' in input
        ? input.degradedReason
        : current.degradedReason,
      lastResolvedAt: 'lastResolvedAt' in input
        ? input.lastResolvedAt
        : current.lastResolvedAt,
      source: input.source ?? current.source,
    });
  }

  /**
   * weatherCode + precipitation → RainIntensity | null。
   * 雪、晴、以及无降水且非雨码都返回 null；非雨雪但有降水量按雨处理。
   */
  static mapRainIntensity(
    weatherCode: number | null,
    precipitationMm: number,
  ): RainIntensity | null {
    if (!Number.isFinite(precipitationMm) || precipitationMm < 0) return null;
    if (weatherCode !== null && SNOW_WEATHER_CODES.has(weatherCode)) return null;
    const rainCode = weatherCode !== null && RAIN_WEATHER_CODES.has(weatherCode);
    if (!rainCode && precipitationMm <= 0) return null;
    if (precipitationMm < 1) return RainIntensity.Light;
    if (precipitationMm < 7.5) return RainIntensity.Moderate;
    return RainIntensity.Heavy;
  }
}


/** 世界实例：2.5D 视差配置 + 时间轴状态。 */
export interface WorldInstance {
  readonly worldId: string;
  readonly kind: WorldKind;
  readonly map: WorldMap;
  readonly layers: readonly Layer[];
  readonly timeline: TimelineStateMachine;
  readonly themeColor: WorldThemeColor;
  readonly scale: MapScaleCalibration;
  readonly spawnPoints: readonly SpawnPoint[];
  readonly spawnZones: readonly SpawnZone[];
  readonly folder: WorldFolder;
  /** 世界序言；进入世界时由 WorldEnterTransition 黑屏字幕显示。 */
  readonly prologue: string;
}