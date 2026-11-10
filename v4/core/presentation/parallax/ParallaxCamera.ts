import type { Layer } from '../../world/types';
import type { TimelineProgress } from '../../timeline/types';
import type { BackgroundUV, ForegroundUV, MidgroundUV } from './ParallaxUV';

/** P · parallax：只读相机偏移与三层 UV。 */
export class ParallaxCamera {
  /**
   * offsetPx = positionMs * 0.08 * layer.parallaxFactor。
   * 0 = 不滚动；1 = 基准；2 = 两倍速度。
   */
  computeOffset(progress: TimelineProgress, layer: Layer): number {
    return progress.positionMs * 0.08 * layer.parallaxFactor;
  }

  computeForegroundUV(progress: TimelineProgress, layer: Layer): ForegroundUV {
    return this.computeUV(progress, layer, 0.35);
  }

  computeMidgroundUV(progress: TimelineProgress, layer: Layer): MidgroundUV {
    return this.computeUV(progress, layer, 0.55);
  }

  computeBackgroundUV(progress: TimelineProgress, layer: Layer): BackgroundUV {
    return this.computeUV(progress, layer, 0.8);
  }

  private computeUV(
    progress: TimelineProgress,
    layer: Layer,
    v: number,
  ): { u: number; v: number; offsetX: number; offsetY: number } {
    const offset = this.computeOffset(progress, layer);
    const rawU = (progress.positionMs * layer.parallaxFactor) / 4000;
    const u = ((rawU % 1) + 1) % 1;
    return {
      u,
      v,
      offsetX: offset,
      offsetY: offset * 0.25,
    };
  }
}
