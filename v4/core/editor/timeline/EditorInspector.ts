import type { ChartKeyframe } from '../keyframe';

/**
 * E · editor / EditorInspector
 * 右栏属性视图模型；未选中 keyframe 时 visible=false。
 */
export class EditorInspector {
  readonly visible: boolean;
  readonly keyframeId: string | null;
  readonly timeMs: number | null;
  readonly durationMs: number | null;
  readonly chartLayerIndex: number | null;
  readonly gridCellId: number | null;
  readonly chartKeyId: string | null;
  readonly chartPadKind: ChartKeyframe['chartPadKind'] | null;
  readonly parallaxFactor: number | null;
  readonly position: { x: number; y: number } | null;
  readonly size: number | null;
  readonly stretch: number | null;
  readonly appearEffect: NonNullable<ChartKeyframe['logo']>['appearEffect'] | null;
  readonly disappearEffect: NonNullable<ChartKeyframe['logo']>['disappearEffect'] | null;
  readonly easing: NonNullable<ChartKeyframe['logo']>['easing'] | null;

  private constructor(keyframe: ChartKeyframe | null) {
    this.visible = keyframe !== null;
    this.keyframeId = keyframe?.keyframeId ?? null;
    this.timeMs = keyframe?.timeMs ?? null;
    this.durationMs = keyframe?.durationMs ?? null;
    this.chartLayerIndex = keyframe?.chartLayerIndex ?? null;
    this.gridCellId = keyframe?.gridCellId ?? null;
    this.chartKeyId = keyframe?.chartKeyId ?? null;
    this.chartPadKind = keyframe?.chartPadKind ?? null;
    this.parallaxFactor = keyframe?.parallaxFactor ?? null;
    this.position = keyframe?.logo ? { x: keyframe.logo.x, y: keyframe.logo.y } : null;
    this.size = keyframe?.logo?.size ?? null;
    this.stretch = keyframe?.logo?.stretch ?? null;
    this.appearEffect = keyframe?.logo?.appearEffect ?? null;
    this.disappearEffect = keyframe?.logo?.disappearEffect ?? null;
    this.easing = keyframe?.logo?.easing ?? null;
  }

  static fromKeyframe(keyframe: ChartKeyframe | null): EditorInspector {
    return new EditorInspector(keyframe);
  }
}
