/**
 * E · editor / EditorSelection
 * 当前选中的 keyframe / track；瞬态，不写 editor.json。
 */
export class EditorSelection {
  selectedKeyframeId: string | null = null;
  selectedTrackId: string | null = null;

  select(keyframeId: string, trackId: string): void {
    if (typeof keyframeId !== 'string' || keyframeId.length === 0) {
      throw new RangeError('keyframeId must be non-empty');
    }
    if (typeof trackId !== 'string' || trackId.length === 0) {
      throw new RangeError('trackId must be non-empty');
    }
    this.selectedKeyframeId = keyframeId;
    this.selectedTrackId = trackId;
  }

  clear(): void {
    this.selectedKeyframeId = null;
    this.selectedTrackId = null;
  }

  get hasSelection(): boolean {
    return this.selectedKeyframeId !== null && this.selectedTrackId !== null;
  }
}
