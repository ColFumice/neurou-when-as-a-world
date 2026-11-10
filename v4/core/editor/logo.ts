/**
 * E · editor / logo
 * 选位状态机 + 确定性随机放置；不依赖 DOM / React / Tauri。
 */

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** 右栏“选位”状态机；点击 stage 后归一化到 0..1。 */
export class LogoPositionPicker {
  private _active = false;

  get active(): boolean {
    return this._active;
  }

  /** 兼容语义名；与 active 同值。 */
  get isActive(): boolean {
    return this._active;
  }

  begin(): void {
    this._active = true;
  }

  cancel(): void {
    this._active = false;
  }

  commit(
    stageX: number,
    stageY: number,
    stageRect: { x: number; y: number; width: number; height: number },
  ): { x: number; y: number } | null {
    if (!this._active) return null;
    if (!Number.isFinite(stageX) || !Number.isFinite(stageY)) {
      throw new RangeError('stage point must be finite');
    }
    if (!Number.isFinite(stageRect.x) || !Number.isFinite(stageRect.y)
      || !Number.isFinite(stageRect.width) || !Number.isFinite(stageRect.height)
      || stageRect.width <= 0 || stageRect.height <= 0) {
      return null;
    }
    this._active = false;
    return {
      x: Math.min(1, Math.max(0, (stageX - stageRect.x) / stageRect.width)),
      y: Math.min(1, Math.max(0, (stageY - stageRect.y) / stageRect.height)),
    };
  }
}

/** 基于 seed + keyframeId 的确定性随机位置。 */
export class LogoRandomPlacement {
  static place(
    seed: number,
    keyframeId: string,
    bounds?: { minX?: number; maxX?: number; minY?: number; maxY?: number },
  ): { x: number; y: number } {
    if (!Number.isFinite(seed)) throw new RangeError('seed must be finite');
    if (typeof keyframeId !== 'string' || keyframeId.length === 0) {
      throw new RangeError('keyframeId must be non-empty');
    }
    const minX = bounds?.minX ?? 0.15;
    const maxX = bounds?.maxX ?? 0.85;
    const minY = bounds?.minY ?? 0.15;
    const maxY = bounds?.maxY ?? 0.85;
    for (const value of [minX, maxX, minY, maxY]) {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError('random placement bounds must be finite and within 0..1');
      }
    }
    if (minX >= maxX || minY >= maxY) {
      throw new RangeError('random placement bounds must have min < max');
    }

    const random = mulberry32(fnv1a(`${Math.trunc(seed)}|${keyframeId}`));
    const x = minX + random() * (maxX - minX);
    const y = minY + random() * (maxY - minY);
    return { x, y };
  }
}
