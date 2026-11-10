import type { ChartKeyframe } from './keyframe';

interface KeyframeLocation {
  readonly trackId: string;
  readonly index: number;
  readonly keyframe: ChartKeyframe;
}

interface KeyframePatch {
  readonly label: string;
  readonly before: KeyframeLocation | null;
  readonly after: KeyframeLocation | null;
}

interface KeyframeBatchPatch {
  readonly kind: 'batch';
  readonly label: string;
  readonly before: readonly KeyframeLocation[];
  readonly after: readonly KeyframeLocation[];
}

type HistoryPatch = KeyframePatch | KeyframeBatchPatch;

/**
 * E · editor / ChartEditUndo
 * 有界命令栈：存 before/after 定位快照，不直接持有 EditorTrack。
 * 支持单 keyframe 与 AI 批量 keyframe 两种 patch。
 */
export class ChartEditUndo {
  private readonly limit: number;
  private entries: HistoryPatch[] = [];
  private cursor = 0;

  constructor(limit = 100) {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new RangeError('history limit must be a positive integer');
    }
    this.limit = limit;
  }

  get size(): number {
    return this.entries.length;
  }

  get canUndo(): boolean {
    return this.cursor > 0;
  }

  get canRedo(): boolean {
    return this.cursor < this.entries.length;
  }

  /** 语义别名；等价于 push。 */
  commit(patch: KeyframePatch): void {
    this.push(patch);
  }

  /** AI 批量插入/删除作为一条历史记录。 */
  pushBatch(patch: KeyframeBatchPatch): void {
    if (patch.before.length === 0 && patch.after.length === 0) return;
    this.entries = this.entries.slice(0, this.cursor);
    this.entries.push(patch);
    if (this.entries.length > this.limit) {
      this.entries.splice(0, this.entries.length - this.limit);
    }
    this.cursor = this.entries.length;
  }

  /** 新编辑截断 redo；before/after 都为空视为空操作，不记录。 */
  push(patch: KeyframePatch): void {
    if (patch.before === null && patch.after === null) return;
    this.entries = this.entries.slice(0, this.cursor);
    this.entries.push(patch);
    if (this.entries.length > this.limit) {
      this.entries.splice(0, this.entries.length - this.limit);
    }
    this.cursor = this.entries.length;
  }

  undo(): HistoryPatch | null {
    if (!this.canUndo) return null;
    this.cursor -= 1;
    return this.entries[this.cursor];
  }

  redo(): HistoryPatch | null {
    if (!this.canRedo) return null;
    const patch = this.entries[this.cursor];
    this.cursor += 1;
    return patch;
  }

  clear(): void {
    this.entries = [];
    this.cursor = 0;
  }
}
