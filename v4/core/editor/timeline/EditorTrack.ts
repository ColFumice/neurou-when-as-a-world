import { ChartKeyframe } from '../keyframe';

/**
 * E · editor / EditorTrack
 * 单层轨道：layerIndex + 排好序的 keyframes。
 */
export class EditorTrack {
  readonly trackId: string;
  readonly layerIndex: number;
  private readonly _keyframes: ChartKeyframe[] = [];

  constructor(trackId: string, layerIndex: number, keyframes: readonly ChartKeyframe[] = []) {
    if (typeof trackId !== 'string' || trackId.length === 0 || trackId.length > 128) {
      throw new RangeError('trackId must be a non-empty string (max 128)');
    }
    if (!Number.isSafeInteger(layerIndex) || layerIndex < 1 || layerIndex > 32) {
      throw new RangeError('layerIndex must be an integer in 1..32');
    }
    this.trackId = trackId;
    this.layerIndex = layerIndex;
    for (const keyframe of keyframes) this.add(keyframe);
  }

  get keyframes(): readonly ChartKeyframe[] {
    return this._keyframes;
  }

  find(keyframeId: string): ChartKeyframe | null {
    return this._keyframes.find((keyframe) => keyframe.keyframeId === keyframeId) ?? null;
  }

  add(keyframe: ChartKeyframe): void {
    this.assertLayer(keyframe);
    if (this.find(keyframe.keyframeId)) {
      throw new Error(`duplicate keyframeId: ${keyframe.keyframeId}`);
    }
    const index = this._keyframes.findIndex(
      (current) => ChartKeyframe.compare(keyframe, current) < 0,
    );
    if (index < 0) this._keyframes.push(keyframe);
    else this._keyframes.splice(index, 0, keyframe);
  }

  /** 历史 patch 用精确索引恢复；普通编辑请用 add（自动排序）。 */
  insert(index: number, keyframe: ChartKeyframe): void {
    this.assertLayer(keyframe);
    if (!Number.isSafeInteger(index) || index < 0 || index > this._keyframes.length) {
      throw new RangeError('insert index is out of range');
    }
    if (this.find(keyframe.keyframeId)) {
      throw new Error(`duplicate keyframeId: ${keyframe.keyframeId}`);
    }
    this._keyframes.splice(index, 0, keyframe);
  }

  remove(keyframeId: string): ChartKeyframe | null {
    const index = this._keyframes.findIndex((keyframe) => keyframe.keyframeId === keyframeId);
    if (index < 0) return null;
    return this._keyframes.splice(index, 1)[0];
  }

  replace(keyframe: ChartKeyframe): void {
    this.assertLayer(keyframe);
    const index = this._keyframes.findIndex((current) => current.keyframeId === keyframe.keyframeId);
    if (index < 0) throw new Error(`keyframe not found: ${keyframe.keyframeId}`);
    this._keyframes[index] = keyframe;
    this._keyframes.sort(ChartKeyframe.compare);
  }

  sorted(): readonly ChartKeyframe[] {
    return [...this._keyframes].sort(ChartKeyframe.compare);
  }

  private assertLayer(keyframe: ChartKeyframe): void {
    if (keyframe.chartLayerIndex !== this.layerIndex) {
      throw new Error(
        `keyframe layer ${keyframe.chartLayerIndex} does not match track ${this.layerIndex}`,
      );
    }
  }
}
