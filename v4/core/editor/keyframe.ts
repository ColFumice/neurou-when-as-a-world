/**
 * E · editor / keyframe
 * ChartKeyframe、关键帧属性与起/中/末插值。
 * 不 import React / Tauri / fs；不依赖 DOM。
 */

type PadKind = 'Light' | 'Heavy' | 'TopMost';
type LogoEffect =
  | 'None'
  | 'FlashWhite'
  | 'FlashBlack'
  | 'Truncate'
  | 'FadeDown'
  | 'FadeUp'
  | 'Strobe'
  | 'Glitch';
type Easing = 'Linear' | 'EaseIn' | 'EaseOut' | 'EaseInOut';
type KeyframeRole = 'Start' | 'Middle' | 'End';

interface LogoGuide {
  readonly logoId: string;
  readonly assetId: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly stretch: number;
  readonly appearEffect: LogoEffect;
  readonly disappearEffect: LogoEffect;
  readonly easing: Easing;
}

interface KeyframeInput {
  readonly keyframeId: string;
  readonly timeMs: number;
  readonly durationMs: number;
  readonly chartLayerIndex: number;
  readonly gridCellId?: number | null;
  readonly chartKeyId?: string | null;
  readonly chartPadKind: PadKind;
  /** 视差因子：-5..+5；仅影响预览，不进入 v2 判定数据。 */
  readonly parallaxFactor?: number;
  /** editor.json v2：挂到该 keyframe 的动效接口 ID。 */
  readonly effectInterfaceIds?: readonly string[];
  readonly logo?: LogoGuide | null;
}

interface KeyframeSample {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly stretch: number;
  readonly appearEffect: LogoEffect;
  readonly disappearEffect: LogoEffect;
  readonly easing: Easing;
}

const LOGO_EFFECTS: readonly LogoEffect[] = [
  'None',
  'FlashWhite',
  'FlashBlack',
  'Truncate',
  'FadeDown',
  'FadeUp',
  'Strobe',
  'Glitch',
];
const EASINGS: readonly Easing[] = ['Linear', 'EaseIn', 'EaseOut', 'EaseInOut'];

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function integer(value: number, min: number, max: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be an integer in ${min}..${max}`);
  }
  return value;
}

function id(value: string, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    throw new RangeError(`${label} must be a non-empty string (max 128)`);
  }
  if ([...value].some((character) => character.charCodeAt(0) < 0x20)) {
    throw new RangeError(`${label} must not contain control characters`);
  }
  return value;
}

function validateLogo(raw: unknown): LogoGuide | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new RangeError('logo must be an object');
  }
  const value = raw as Record<string, unknown>;
  const logoId = id(value.logoId as string, 'logo.logoId');
  const assetId = id(value.assetId as string, 'logo.assetId');
  const x = finite(value.x as number, 'logo.x');
  const y = finite(value.y as number, 'logo.y');
  const size = finite(value.size as number, 'logo.size');
  const stretch = finite(value.stretch as number, 'logo.stretch');
  if (x < 0 || x > 1) throw new RangeError('logo.x must be in 0..1');
  if (y < 0 || y > 1) throw new RangeError('logo.y must be in 0..1');
  if (size < 0.02 || size > 1) throw new RangeError('logo.size must be in 0.02..1');
  if (stretch < 0.25 || stretch > 4) throw new RangeError('logo.stretch must be in 0.25..4');
  if (!LOGO_EFFECTS.includes(value.appearEffect as LogoEffect)) {
    throw new RangeError('logo.appearEffect is invalid');
  }
  if (!LOGO_EFFECTS.includes(value.disappearEffect as LogoEffect)) {
    throw new RangeError('logo.disappearEffect is invalid');
  }
  if (!EASINGS.includes(value.easing as Easing)) {
    throw new RangeError('logo.easing is invalid');
  }
  return Object.freeze({
    logoId,
    assetId,
    x,
    y,
    size,
    stretch,
    appearEffect: value.appearEffect as LogoEffect,
    disappearEffect: value.disappearEffect as LogoEffect,
    easing: value.easing as Easing,
  });
}

function defaultLayerShape(layerIndex: number): { gridCellId: number | null; padKind: PadKind } {
  if (layerIndex === 1) return { gridCellId: null, padKind: 'TopMost' };
  if (layerIndex === 2) return { gridCellId: 1, padKind: 'Light' };
  return { gridCellId: null, padKind: 'Light' };
}

/** 谱面关键帧：节奏点 + 可选引导 Logo。不可变。 */
export class ChartKeyframe {
  readonly keyframeId: string;
  readonly timeMs: number;
  readonly durationMs: number;
  readonly chartLayerIndex: number;
  readonly gridCellId: number | null;
  readonly chartKeyId: string | null;
  readonly chartPadKind: PadKind;
  readonly parallaxFactor: number;
  readonly effectInterfaceIds: readonly string[];
  readonly logo: LogoGuide | null;

  constructor(input: KeyframeInput) {
    const keyframeId = id(input.keyframeId, 'keyframeId');
    const timeMs = integer(input.timeMs, 0, Number.MAX_SAFE_INTEGER, 'timeMs');
    const durationMs = integer(input.durationMs, 0, Number.MAX_SAFE_INTEGER, 'durationMs');
    const chartLayerIndex = integer(input.chartLayerIndex, 1, 32, 'chartLayerIndex');
    const gridCellId = input.gridCellId === null || input.gridCellId === undefined
      ? null
      : integer(input.gridCellId, 1, 8, 'gridCellId');
    const chartKeyId = input.chartKeyId === null || input.chartKeyId === undefined
      ? null
      : id(input.chartKeyId, 'chartKeyId');
    const chartPadKind = input.chartPadKind;
    if (chartPadKind !== 'Light' && chartPadKind !== 'Heavy' && chartPadKind !== 'TopMost') {
      throw new RangeError('chartPadKind must be Light / Heavy / TopMost');
    }

    if (chartLayerIndex === 1) {
      if (chartPadKind !== 'TopMost') throw new RangeError('layer 1 pad must be TopMost');
      if (gridCellId !== null) throw new RangeError('layer 1 must not have gridCellId');
    } else if (chartLayerIndex === 2) {
      if (chartPadKind !== 'Light' && chartPadKind !== 'Heavy') {
        throw new RangeError('layer 2 pad must be Light / Heavy');
      }
      if (gridCellId === null) throw new RangeError('layer 2 requires gridCellId');
    } else {
      if (chartPadKind !== 'Light') throw new RangeError('layer 3+ pad must be Light');
      if (gridCellId !== null) throw new RangeError('layer 3+ must not have gridCellId');
    }

    this.keyframeId = keyframeId;
    this.timeMs = timeMs;
    this.durationMs = durationMs;
    this.chartLayerIndex = chartLayerIndex;
    this.gridCellId = gridCellId;
    this.chartKeyId = chartKeyId;
    this.chartPadKind = chartPadKind;
    const parallaxFactor = input.parallaxFactor ?? 1;
    if (!Number.isFinite(parallaxFactor) || parallaxFactor < -5 || parallaxFactor > 5) {
      throw new RangeError('parallaxFactor must be finite and within -5..5');
    }
    this.parallaxFactor = parallaxFactor;
    const effectInterfaceIds = input.effectInterfaceIds ?? [];
    if (!Array.isArray(effectInterfaceIds)) {
      throw new RangeError('effectInterfaceIds must be an array');
    }
    const uniqueEffectIds = [...new Set(effectInterfaceIds.map((value) => id(value, 'effectInterfaceId')))];
    this.effectInterfaceIds = Object.freeze(uniqueEffectIds);
    this.logo = validateLogo(input.logo);
  }

  withTime(timeMs: number): ChartKeyframe {
    return new ChartKeyframe({
      keyframeId: this.keyframeId,
      timeMs,
      durationMs: this.durationMs,
      chartLayerIndex: this.chartLayerIndex,
      gridCellId: this.gridCellId,
      chartKeyId: this.chartKeyId,
      chartPadKind: this.chartPadKind,
      parallaxFactor: this.parallaxFactor,
      effectInterfaceIds: this.effectInterfaceIds,
      logo: this.logo,
    });
  }

  withEffectInterfaces(effectInterfaceIds: readonly string[]): ChartKeyframe {
    return new ChartKeyframe({
      keyframeId: this.keyframeId,
      timeMs: this.timeMs,
      durationMs: this.durationMs,
      chartLayerIndex: this.chartLayerIndex,
      gridCellId: this.gridCellId,
      chartKeyId: this.chartKeyId,
      chartPadKind: this.chartPadKind,
      parallaxFactor: this.parallaxFactor,
      effectInterfaceIds,
      logo: this.logo,
    });
  }

  withLayer(
    layerIndex: number,
    gridCellId?: number | null,
    padKind?: PadKind,
  ): ChartKeyframe {
    const defaults = defaultLayerShape(layerIndex);
    return new ChartKeyframe({
      keyframeId: this.keyframeId,
      timeMs: this.timeMs,
      durationMs: this.durationMs,
      chartLayerIndex: layerIndex,
      gridCellId: gridCellId === undefined ? defaults.gridCellId : gridCellId,
      chartKeyId: this.chartKeyId,
      chartPadKind: padKind ?? defaults.padKind,
      parallaxFactor: this.parallaxFactor,
      effectInterfaceIds: this.effectInterfaceIds,
      logo: this.logo,
    });
  }

  withParallaxFactor(parallaxFactor: number): ChartKeyframe {
    return new ChartKeyframe({
      keyframeId: this.keyframeId,
      timeMs: this.timeMs,
      durationMs: this.durationMs,
      chartLayerIndex: this.chartLayerIndex,
      gridCellId: this.gridCellId,
      chartKeyId: this.chartKeyId,
      chartPadKind: this.chartPadKind,
      parallaxFactor,
      effectInterfaceIds: this.effectInterfaceIds,
      logo: this.logo,
    });
  }

  withLogo(logo: LogoGuide | null): ChartKeyframe {
    return new ChartKeyframe({
      keyframeId: this.keyframeId,
      timeMs: this.timeMs,
      durationMs: this.durationMs,
      chartLayerIndex: this.chartLayerIndex,
      gridCellId: this.gridCellId,
      chartKeyId: this.chartKeyId,
      chartPadKind: this.chartPadKind,
      parallaxFactor: this.parallaxFactor,
      effectInterfaceIds: this.effectInterfaceIds,
      logo,
    });
  }

  static compare(left: ChartKeyframe, right: ChartKeyframe): number {
    return left.timeMs - right.timeMs
      || left.chartLayerIndex - right.chartLayerIndex
      || left.keyframeId.localeCompare(right.keyframeId, 'en');
  }

  static roleOf(
    keyframes: readonly ChartKeyframe[],
    keyframeId: string,
  ): KeyframeRole | null {
    return ChartKeyframe.rolesOf(keyframes, keyframeId)[0] ?? null;
  }

  /** 同层首/末由 time 顺序派生；单 keyframe 同时是 Start 与 End。 */
  static rolesOf(
    keyframes: readonly ChartKeyframe[],
    keyframeId: string,
  ): readonly KeyframeRole[] {
    if (keyframes.length === 0) return [];
    const sorted = [...keyframes].sort(ChartKeyframe.compare);
    const index = sorted.findIndex((keyframe) => keyframe.keyframeId === keyframeId);
    if (index < 0) return [];
    if (sorted.length === 1) return ['Start', 'End'];
    if (index === 0) return ['Start'];
    if (index === sorted.length - 1) return ['End'];
    return ['Middle'];
  }
}

/**
 * 关键帧可编辑属性。
 * - Time / Duration：节奏点时间与 Hold 长度；
 * - Layer / GridCell / PadKind / ChartKeyId：判定归属；
 * - Position / Size / Stretch：Logo 几何；
 * - AppearEffect / DisappearEffect / Easing：首末动效与插值曲线。
 */
export enum ChartKeyframeProperty {
  /** timeMs：关键帧绝对时间（毫秒）。 */
  Time = 'Time',
  /** durationMs：Hold 长度；0 为 Tap。 */
  Duration = 'Duration',
  /** chartLayerIndex：1 基判定层。 */
  Layer = 'Layer',
  /** gridCellId：第 2 层的 1..8 格。 */
  GridCell = 'GridCell',
  /** chartPadKind：Light / Heavy / TopMost。 */
  PadKind = 'PadKind',
  /** chartKeyId：可选逻辑键。 */
  ChartKeyId = 'ChartKeyId',
  /** parallaxFactor：该关键帧的预览视差因子（-5..+5）。 */
  ParallaxFactor = 'ParallaxFactor',
  /** x/y：Logo 归一化位置（相对 stage 内容框）。 */
  Position = 'Position',
  /** size：Logo 归一化高度。 */
  Size = 'Size',
  /** stretch：Logo 横向拉伸倍率。 */
  Stretch = 'Stretch',
  /** appearEffect：首关键帧出现动效。 */
  AppearEffect = 'AppearEffect',
  /** disappearEffect：末关键帧消失动效。 */
  DisappearEffect = 'DisappearEffect',
  /** easing：相邻 Logo 关键帧的插值曲线。 */
  Easing = 'Easing',
}

/** 起始/中间/结束关键帧之间的 Logo 插值。 */
export class ChartKeyframeAnimation {
  static roleOf(
    keyframes: readonly ChartKeyframe[],
    keyframeId: string,
  ): KeyframeRole | null {
    return ChartKeyframe.roleOf(keyframes, keyframeId);
  }

  static sample(
    keyframes: readonly ChartKeyframe[],
    timeMs: number,
  ): KeyframeSample | null {
    const withLogo = keyframes
      .filter((keyframe) => keyframe.logo !== null)
      .sort(ChartKeyframe.compare);
    if (withLogo.length === 0) return null;

    const first = withLogo[0];
    const last = withLogo[withLogo.length - 1];
    if (timeMs < first.timeMs || timeMs > last.timeMs) return null;

    let left = first;
    let right = first;
    for (const keyframe of withLogo) {
      if (keyframe.timeMs <= timeMs) left = keyframe;
      if (keyframe.timeMs >= timeMs) {
        right = keyframe;
        break;
      }
    }

    const leftLogo = left.logo as LogoGuide;
    if (left === right || right.timeMs === left.timeMs) {
      return sampleFrom(leftLogo, leftLogo);
    }

    const rightLogo = right.logo as LogoGuide;
    const span = right.timeMs - left.timeMs;
    const ratio = span <= 0 ? 0 : (timeMs - left.timeMs) / span;
    const eased = ease(leftLogo.easing, Math.min(1, Math.max(0, ratio)));
    return {
      x: leftLogo.x + (rightLogo.x - leftLogo.x) * eased,
      y: leftLogo.y + (rightLogo.y - leftLogo.y) * eased,
      size: leftLogo.size + (rightLogo.size - leftLogo.size) * eased,
      stretch: leftLogo.stretch + (rightLogo.stretch - leftLogo.stretch) * eased,
      appearEffect: leftLogo.appearEffect,
      disappearEffect: rightLogo.disappearEffect,
      easing: leftLogo.easing,
    };
  }
}

function sampleFrom(left: LogoGuide, right: LogoGuide): KeyframeSample {
  return {
    x: left.x,
    y: left.y,
    size: left.size,
    stretch: left.stretch,
    appearEffect: left.appearEffect,
    disappearEffect: right.disappearEffect,
    easing: left.easing,
  };
}

function ease(easing: Easing, t: number): number {
  switch (easing) {
    case 'EaseIn':
      return t * t;
    case 'EaseOut':
      return 1 - (1 - t) * (1 - t);
    case 'EaseInOut':
      return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
    case 'Linear':
    default:
      return t;
  }
}
