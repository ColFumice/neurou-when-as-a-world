import type { VisualFrameRect } from '../../../core/world/frame';

export const FRAME_MOVE_SPEED = 0.55;
export const FRAME_DT_CAP_MS = 50;

/** R3.4 的初始视差框；归一化屏幕坐标。 */
export const INITIAL_FRAME_RECT: VisualFrameRect = Object.freeze({
  x: 0.16,
  y: 0.18,
  width: 0.68,
  height: 0.58,
});

export type FrameMoveDirection = 'left' | 'right' | 'up' | 'down';

export interface FrameHeldKeys {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
}

export const EMPTY_FRAME_HELD: FrameHeldKeys = Object.freeze({
  left: false,
  right: false,
  up: false,
  down: false,
});

export type FrameInputPhase =
  | 'loading'
  | 'ready'
  | 'countdown'
  | 'playing'
  | 'paused'
  | 'completed'
  | 'error';

export type FrameInputRoute =
  | { readonly kind: 'frame-move'; readonly direction: FrameMoveDirection }
  | { readonly kind: 'frame-strike' }
  | { readonly kind: 'r4a' }
  | { readonly kind: 'ignore' };

export interface FrameInputContext {
  readonly code: string;
  readonly shiftKey: boolean;
  readonly phase: FrameInputPhase;
  readonly commandOpen: boolean;
  readonly hasTraces: boolean;
}

const MODIFIER_CODES = new Set([
  'ShiftLeft', 'ShiftRight',
  'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight',
  'MetaLeft', 'MetaRight',
]);

const ARROW_DIRECTIONS: Readonly<Record<string, FrameMoveDirection>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

export function frameDirectionForCode(code: string): FrameMoveDirection | null {
  return ARROW_DIRECTIONS[code] ?? null;
}

/**
 * R4c 的键位路由；只影响 Shift+Arrow* / Shift+Enter。
 * 其他情况返回 r4a，让 GameScreen 继续原 strikeFromKey 路径。
 */
export function routeFrameInput(input: FrameInputContext): FrameInputRoute {
  if (MODIFIER_CODES.has(input.code)) return { kind: 'ignore' };
  if (!input.hasTraces || input.phase !== 'playing' || input.commandOpen) {
    return { kind: 'r4a' };
  }
  if (!input.shiftKey) return { kind: 'r4a' };
  const direction = frameDirectionForCode(input.code);
  if (direction !== null) return { kind: 'frame-move', direction };
  if (input.code === 'Enter') return { kind: 'frame-strike' };
  return { kind: 'r4a' };
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function cloneRect(rect: VisualFrameRect): VisualFrameRect {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

function validRect(rect: VisualFrameRect): void {
  finite(rect.x, 'frame.x');
  finite(rect.y, 'frame.y');
  finite(rect.width, 'frame.width');
  finite(rect.height, 'frame.height');
  if (rect.x < 0 || rect.y < 0
    || rect.width <= 0 || rect.height <= 0
    || rect.x + rect.width > 1
    || rect.y + rect.height > 1) {
    throw new RangeError('frame rect must stay within 0..1');
  }
}

/**
 * 纯键盘框控制器：不读 DOM / 不建时钟。
 * GameScreen 只在 playing 且命令输入关闭时调用；暂停时 setActive(false)。
 */
export class FrameController {
  readonly speed: number;
  private _rect: VisualFrameRect;
  private _active = true;
  private _deltaX = 0;

  constructor(options: {
    readonly rect?: VisualFrameRect;
    readonly speed?: number;
  } = {}) {
    const initial = cloneRect(options.rect ?? INITIAL_FRAME_RECT);
    validRect(initial);
    this._rect = initial;
    const speed = options.speed ?? FRAME_MOVE_SPEED;
    if (!Number.isFinite(speed) || speed < 0) {
      throw new RangeError('FrameController.speed must be a non-negative finite number');
    }
    this.speed = speed;
  }

  get rect(): VisualFrameRect {
    return this._rect;
  }

  get active(): boolean {
    return this._active;
  }

  /** 本帧水平位移；TriggerParallax 使用。 */
  get deltaX(): number {
    return this._deltaX;
  }

  setActive(active: boolean): void {
    this._active = active;
    if (!active) this._deltaX = 0;
  }

  reset(): void {
    this._rect = cloneRect(INITIAL_FRAME_RECT);
    this._deltaX = 0;
  }

  update(dtMs: number, held: FrameHeldKeys): void {
    if (!this._active) {
      this._deltaX = 0;
      return;
    }
    if (!Number.isFinite(dtMs) || dtMs <= 0) {
      this._deltaX = 0;
      return;
    }

    const dt = Math.min(FRAME_DT_CAP_MS, dtMs);
    let dx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    let dy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    if (dx !== 0 && dy !== 0) {
      const inverse = 1 / Math.SQRT2;
      dx *= inverse;
      dy *= inverse;
    }
    if (dx === 0 && dy === 0) {
      this._deltaX = 0;
      return;
    }

    const distance = this.speed * (dt / 1000);
    const previousX = this._rect.x;
    const maxX = Math.max(0, 1 - this._rect.width);
    const maxY = Math.max(0, 1 - this._rect.height);
    const nextX = Math.min(maxX, Math.max(0, previousX + dx * distance));
    const nextY = Math.min(maxY, Math.max(0, this._rect.y + dy * distance));
    this._rect = {
      x: nextX,
      y: nextY,
      width: this._rect.width,
      height: this._rect.height,
    };
    this._deltaX = nextX - previousX;
  }
}
