/**
 * C · chart / ChartPremiere
 * 一次首演的完整结果快照；只承载数据，不写账本、不 import ledger / trace / editor。
 *
 * R4d 的 20 维向量由 director 的 ChartPremiereDirector 推导，本类不依赖 ledger。
 */

interface ChartPremiereInput {
  readonly chartId: string;
  readonly source: 'editor' | 'v2' | 'fallback';
  readonly completed: boolean;
  readonly totalNotes: number;
  readonly perfect: number;
  readonly good: number;
  readonly miss: number;
  readonly maxCombo?: number;
  readonly tracesTotal?: number;
  readonly tracesRevealed?: number;
  readonly tracesTouched?: number;
  readonly deepRevealed?: number;
  readonly anomalousRevealed?: number;
  readonly rainRevealed?: number;
  readonly frameLost?: number;
  readonly neuAudioModules?: number;
  readonly neuEffectModules?: number;
  readonly neuLightModules?: number;
  readonly neuResourceModules?: number;
  readonly neuSubtitleModules?: number;
  readonly triggerEnter?: number;
  readonly triggerExit?: number;
  readonly triggerDwell?: number;
  readonly triggerOccupancy?: number;
  readonly triggerParallax?: number;
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function count(value: number, label: string, total: number): number {
  const parsed = nonNegativeInteger(value, label);
  if (parsed > total) {
    throw new RangeError(`${label} must not exceed ${total}`);
  }
  return parsed;
}

/**
 * 首演统计快照。
 *
 * `completed=false` 可表示中途退出/未收束；只有 completed=true 且所有 note
 * 已决出判定时才允许进入账本写入路径。
 */
export class ChartPremiere {
  readonly chartId: string;
  readonly source: 'editor' | 'v2' | 'fallback';
  readonly completed: boolean;
  readonly totalNotes: number;
  readonly perfect: number;
  readonly good: number;
  readonly miss: number;
  readonly maxCombo: number;
  readonly tracesTotal: number;
  readonly tracesRevealed: number;
  readonly tracesTouched: number;
  readonly deepRevealed: number;
  readonly anomalousRevealed: number;
  readonly rainRevealed: number;
  readonly frameLost: number;
  readonly neuAudioModules: number;
  readonly neuEffectModules: number;
  readonly neuLightModules: number;
  readonly neuResourceModules: number;
  readonly neuSubtitleModules: number;
  readonly triggerEnter: number;
  readonly triggerExit: number;
  readonly triggerDwell: number;
  readonly triggerOccupancy: number;
  readonly triggerParallax: number;

  constructor(input: ChartPremiereInput) {
    if (typeof input.chartId !== 'string' || input.chartId.length === 0) {
      throw new RangeError('ChartPremiere.chartId must be a non-empty string');
    }
    const source = input.source;
    if (source !== 'editor' && source !== 'v2' && source !== 'fallback') {
      throw new RangeError('ChartPremiere.source must be editor, v2 or fallback');
    }
    if (typeof input.completed !== 'boolean') {
      throw new RangeError('ChartPremiere.completed must be a boolean');
    }

    const totalNotes = nonNegativeInteger(input.totalNotes, 'ChartPremiere.totalNotes');
    const perfect = nonNegativeInteger(input.perfect, 'ChartPremiere.perfect');
    const good = nonNegativeInteger(input.good, 'ChartPremiere.good');
    const miss = nonNegativeInteger(input.miss, 'ChartPremiere.miss');
    const decided = perfect + good + miss;
    if (decided > totalNotes) {
      throw new RangeError('ChartPremiere judged notes must not exceed totalNotes');
    }
    if (input.completed && (totalNotes === 0 || decided !== totalNotes)) {
      throw new RangeError('completed ChartPremiere must have every note decided');
    }
    const maxCombo = nonNegativeInteger(input.maxCombo ?? 0, 'ChartPremiere.maxCombo');
    if (maxCombo > perfect + good) {
      throw new RangeError('ChartPremiere.maxCombo must not exceed hit notes');
    }

    const tracesTotal = nonNegativeInteger(input.tracesTotal ?? 0, 'ChartPremiere.tracesTotal');
    const tracesRevealed = count(
      input.tracesRevealed ?? 0,
      'ChartPremiere.tracesRevealed',
      tracesTotal,
    );
    const tracesTouched = count(
      input.tracesTouched ?? 0,
      'ChartPremiere.tracesTouched',
      tracesRevealed,
    );
    const deepRevealed = count(
      input.deepRevealed ?? 0,
      'ChartPremiere.deepRevealed',
      tracesTotal,
    );
    const anomalousRevealed = count(
      input.anomalousRevealed ?? 0,
      'ChartPremiere.anomalousRevealed',
      tracesTotal,
    );
    const rainRevealed = count(
      input.rainRevealed ?? 0,
      'ChartPremiere.rainRevealed',
      tracesTotal,
    );
    const frameLost = count(input.frameLost ?? 0, 'ChartPremiere.frameLost', tracesTotal);

    this.chartId = input.chartId;
    this.source = source;
    this.completed = input.completed;
    this.totalNotes = totalNotes;
    this.perfect = perfect;
    this.good = good;
    this.miss = miss;
    this.maxCombo = maxCombo;
    this.tracesTotal = tracesTotal;
    this.tracesRevealed = tracesRevealed;
    this.tracesTouched = tracesTouched;
    this.deepRevealed = deepRevealed;
    this.anomalousRevealed = anomalousRevealed;
    this.rainRevealed = rainRevealed;
    this.frameLost = frameLost;
    this.neuAudioModules = nonNegativeInteger(
      input.neuAudioModules ?? 0,
      'ChartPremiere.neuAudioModules',
    );
    this.neuEffectModules = nonNegativeInteger(
      input.neuEffectModules ?? 0,
      'ChartPremiere.neuEffectModules',
    );
    this.neuLightModules = nonNegativeInteger(
      input.neuLightModules ?? 0,
      'ChartPremiere.neuLightModules',
    );
    this.neuResourceModules = nonNegativeInteger(
      input.neuResourceModules ?? 0,
      'ChartPremiere.neuResourceModules',
    );
    this.neuSubtitleModules = nonNegativeInteger(
      input.neuSubtitleModules ?? 0,
      'ChartPremiere.neuSubtitleModules',
    );
    this.triggerEnter = nonNegativeInteger(input.triggerEnter ?? 0, 'ChartPremiere.triggerEnter');
    this.triggerExit = nonNegativeInteger(input.triggerExit ?? 0, 'ChartPremiere.triggerExit');
    this.triggerDwell = nonNegativeInteger(input.triggerDwell ?? 0, 'ChartPremiere.triggerDwell');
    this.triggerOccupancy = nonNegativeInteger(
      input.triggerOccupancy ?? 0,
      'ChartPremiere.triggerOccupancy',
    );
    this.triggerParallax = nonNegativeInteger(
      input.triggerParallax ?? 0,
      'ChartPremiere.triggerParallax',
    );
  }

  /** R4d 事件引用；R2 仍用 string 占位，这里固定为 chartId。 */
  get chartRef(): string {
    return this.chartId;
  }
}
