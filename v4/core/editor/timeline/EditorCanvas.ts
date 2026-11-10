/**
 * E · editor / EditorCanvas
 * 预览区瞬态视图模型；stage 尺寸可持久化，selection/logoPosition 不持久化。
 */
export class EditorCanvas {
  stageWidth: number;
  stageHeight: number;
  selectedKeyframeId: string | null = null;
  logoPosition: { x: number; y: number } | null = null;

  constructor(stageWidth = 1280, stageHeight = 720) {
    if (!Number.isFinite(stageWidth) || stageWidth <= 0) {
      throw new RangeError('stageWidth must be a positive finite number');
    }
    if (!Number.isFinite(stageHeight) || stageHeight <= 0) {
      throw new RangeError('stageHeight must be a positive finite number');
    }
    this.stageWidth = stageWidth;
    this.stageHeight = stageHeight;
  }

  setStageSize(width: number, height: number): void {
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      throw new RangeError('stage size must be positive finite numbers');
    }
    this.stageWidth = width;
    this.stageHeight = height;
  }

  select(keyframeId: string | null): void {
    this.selectedKeyframeId = keyframeId;
    this.logoPosition = null;
  }

  setLogoPosition(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError('logo position must be finite');
    }
    this.logoPosition = {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
  }
}
