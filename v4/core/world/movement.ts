import type { CenterDistance, LateralAxis, MapCenter } from './types';

/**
 * 单轴移动输入。
 * deltaMs 为帧时长；R2 保留，速度换算留 R3/R4。
 */
export interface MoveInput {
  readonly currentLateral: number;
  readonly lateralDelta: number;
  readonly deltaMs: number;
}

/** 单轴移动结果。 */
export interface MovementResult {
  readonly nextLateral: number;
  readonly appliedDelta: number;
}

/** 单轴推进；不涉及 DepthAxis / VerticalAxis。 */
export function moveAlongAxes(input: MoveInput): MovementResult {
  return {
    nextLateral: input.currentLateral + input.lateralDelta,
    appliedDelta: input.lateralDelta,
  };
}

/** 计算 |position - center|，单位 WorldMeter；纯函数。 */
export function calculateCenterDistance(position: LateralAxis, center: MapCenter): CenterDistance {
  return {
    worldMeters: Math.abs(position.worldMeters - center.lateral.worldMeters),
  };
}