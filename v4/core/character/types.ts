import type { LateralAxis } from '../world/types';

/**
 * H · character
 * 主角纯逻辑（去 Cocos）；不 import presentation / cc。
 */

/** 移动速度（WorldMeter / 秒）。 */
export interface MoveSpeed {
  readonly worldMetersPerSecond: number;
}

/** 拖尾长度（WorldMeter）。 */
export interface TrailLength {
  readonly worldMeters: number;
}

/** 发色（0..255）。 */
export interface HairColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** 装饰调色板。 */
export type DecorationPalette = Readonly<Record<string, string>>;

/** 主角纯逻辑结构。 */
export interface Protagonist {
  readonly characterId: string;
  readonly position: LateralAxis;
  readonly speed: MoveSpeed;
  readonly trailLength: TrailLength;
  readonly hairColor: HairColor;
  readonly palette: DecorationPalette;
}
