/**
 * W · world：视差框纯逻辑。
 * 只提供屏幕空间矩形、目标判定、跟踪状态与只读饱和度数值；
 * 不 import Pixi / React / WebAudio，不读取渲染颜色。
 */

export interface VisualFrameRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface VisualFrameParallaxFactor {
  readonly layerIndex: number;
  readonly factor: number;
}

export type VisualFrameSaturation = number;
export type GlobalSaturation = number;

export interface FrameTarget {
  readonly kind: 'Trace' | 'Anchor' | 'None';
  readonly targetId?: string;
  readonly screenRect: VisualFrameRect;
}

export enum FrameTracking {
  Idle = 'Idle',
  Tracking = 'Tracking',
  Lost = 'Lost',
  Locked = 'Locked',
}

export enum VisualFrameTargetLock {
  Locked = 'Locked',
  Unlocked = 'Unlocked',
}

export interface VisualFrame {
  readonly rect: VisualFrameRect;
  readonly parallaxFactors: readonly VisualFrameParallaxFactor[];
  readonly target: FrameTarget;
  readonly tracking: FrameTracking;
  readonly lock: VisualFrameTargetLock;
  readonly frameSaturation: VisualFrameSaturation;
  readonly globalSaturation: GlobalSaturation;
}

function isTargetInsideFrame(rect: VisualFrameRect, target: FrameTarget): boolean {
  if (target.kind === 'None') return false;
  const centerX = target.screenRect.x + target.screenRect.width / 2;
  const centerY = target.screenRect.y + target.screenRect.height / 2;
  return (
    centerX >= rect.x
    && centerX <= rect.x + rect.width
    && centerY >= rect.y
    && centerY <= rect.y + rect.height
  );
}

function computeFrameTracking(
  rect: VisualFrameRect,
  target: FrameTarget,
  prevTracking: FrameTracking,
): FrameTracking {
  if (target.kind === 'None') return FrameTracking.Idle;

  const inside = isTargetInsideFrame(rect, target);
  if (inside) {
    return prevTracking === FrameTracking.Locked
      ? FrameTracking.Locked
      : FrameTracking.Tracking;
  }
  return prevTracking === FrameTracking.Idle
    ? FrameTracking.Idle
    : FrameTracking.Lost;
}

function computeTargetLock(
  rect: VisualFrameRect,
  target: FrameTarget,
  windowMs: number,
  hitAtMs: number,
): VisualFrameTargetLock {
  if (target.kind === 'None' || !isTargetInsideFrame(rect, target)) {
    return VisualFrameTargetLock.Unlocked;
  }
  if (!Number.isFinite(windowMs) || !Number.isFinite(hitAtMs)) {
    return VisualFrameTargetLock.Unlocked;
  }
  return hitAtMs >= 0 && hitAtMs <= windowMs
    ? VisualFrameTargetLock.Locked
    : VisualFrameTargetLock.Unlocked;
}

export const VisualFrame = {
  isTargetInsideFrame,
  computeFrameTracking,
  computeTargetLock,
};
