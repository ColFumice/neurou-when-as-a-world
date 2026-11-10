/**
 * E · editor / EditorClip
 * 媒体剪辑段的纯数据描述；R3.5b 只定义，不持久化、不接媒体。
 */
export class EditorClip {
  readonly clipId: string;
  readonly assetId: string;
  readonly trackId: string;
  readonly startMs: number;
  readonly durationMs: number;
  readonly inMs: number;
  readonly outMs: number;
  readonly kind: 'Video' | 'Audio';

  constructor(input: {
    clipId: string;
    assetId: string;
    trackId: string;
    startMs: number;
    durationMs: number;
    inMs: number;
    outMs: number;
    kind: 'Video' | 'Audio';
  }) {
    for (const [label, value] of [
      ['clipId', input.clipId],
      ['assetId', input.assetId],
      ['trackId', input.trackId],
    ] as const) {
      if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
        throw new RangeError(`${label} must be a non-empty string (max 128)`);
      }
    }
    if (!Number.isSafeInteger(input.startMs) || input.startMs < 0) {
      throw new RangeError('startMs must be a non-negative integer');
    }
    if (!Number.isSafeInteger(input.durationMs) || input.durationMs < 0) {
      throw new RangeError('durationMs must be a non-negative integer');
    }
    if (!Number.isSafeInteger(input.inMs) || input.inMs < 0) {
      throw new RangeError('inMs must be a non-negative integer');
    }
    if (!Number.isSafeInteger(input.outMs) || input.outMs < input.inMs) {
      throw new RangeError('outMs must be an integer >= inMs');
    }
    if (input.kind !== 'Video' && input.kind !== 'Audio') {
      throw new RangeError('clip kind must be Video / Audio');
    }
    this.clipId = input.clipId;
    this.assetId = input.assetId;
    this.trackId = input.trackId;
    this.startMs = input.startMs;
    this.durationMs = input.durationMs;
    this.inMs = input.inMs;
    this.outMs = input.outMs;
    this.kind = input.kind;
  }

  get endMs(): number {
    return this.startMs + this.durationMs;
  }
}
