/**
 * G · eventgraph / random
 * NEU 随机模式、种子与循环告警的值对象；不依赖 React / DOM。
 */

/** NEU 预览随机模式：编辑器 Seeded，游戏 Live。 */
export enum RandomPreviewMode {
  Seeded = 'Seeded',
  Live = 'Live',
}

/** 0..2^32-1 的随机种子；不持久化运行时 mode。 */
export class RandomSeed {
  readonly value: number;

  constructor(value: number) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) {
      throw new RangeError('RandomSeed must be a safe integer in 0..4294967295');
    }
    this.value = value;
  }
}

/** 循环/环告警；limit 固定 100。 */
export interface CycleWarning {
  readonly moduleId: string;
  readonly atMs: number;
  readonly limit: number;
  readonly reason: 'LoopLimit' | 'GraphCycle';
}
