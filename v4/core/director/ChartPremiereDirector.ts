/**
 * R · director / ChartPremiereDirector
 *
 * R4d 的首演叙事入口：
 * - 从 ChartPremiere 纯推导 20 维向量；
 * - 在账本可写、尚未记录该 chartRef 时追加恰好一条 NarrativeEvent。
 *
 * 本文件是 director 唯一允许调用 appendNarrativeEvent 的位置。
 * 不 import presentation / React / Tauri / Node fs。
 */

import { ChartPremiere } from '../chart/ChartPremiere';
import { VectorSchemaVersion } from '../constants';
import {
  appendNarrativeEvent,
  LedgerReader,
  LedgerStore,
} from '../ledger/store';
import type { LedgerCheckpoint } from '../ledger/store';
import type { NarrativeDimension, NarrativeEvent } from '../ledger/types';
import { validateNarrativeVector } from '../ledger/vector';

/** 20 维位置；禁止在公式里散落数字索引。 */
const RED = 0;
const GREEN = 1;
const BLUE = 2;
const BLACK = 3;
const WHITE = 4;
const GREY = 5;
const INITIAL = 6;
const PROCESS = 7;
const TRACE = 8;
const HIGHLIGHT = 9;
const COMMENTED = 10;
const RESIDUE = 11;
const TRUST = 12;
const CLOSENESS = 13;
const UNDERSTANDING = 14;
const CONFLICT = 15;
const TRUTH_LEVEL = 16;
const NARRATIVE_TIME = 17;
const INFLUENCE_RADIUS = 18;
const PLAYER_EMPATHY = 19;
const DIMENSION_COUNT = 20;

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.min(1, Math.max(0, numerator / denominator));
}

/** NEU / Trigger 的 5 类饱和参考；不是硬上限。 */
function saturation(count: number): number {
  return Math.min(1, Math.max(0, count / 5));
}

function percent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value * 100)));
}

function completedFlag(premiere: ChartPremiere): number {
  return premiere.completed ? 1 : 0;
}

/**
 * 一次首演的 20 维向量。
 *
 * 规则版本：R4d v1（授权于 R4d.1）。所有维度为 0..100 的整数，
 * 不使用 score，避免与 Perfect/Good/Miss + combo 双重计数。
 */
export class ChartPremiereDirector {
  private readonly store: LedgerStore;
  private readonly reader: LedgerReader;
  private queue: Promise<void> = Promise.resolve();
  private lastDiagnosticValue: string | null = null;

  constructor(store: LedgerStore, reader: LedgerReader) {
    this.store = store;
    this.reader = reader;
  }

  /** 最近一次拒绝/失败的原因；成功时为 null。 */
  get lastDiagnostic(): string | null {
    return this.lastDiagnosticValue;
  }

  /** 纯函数：不读文件、不追加、不依赖时钟。 */
  static deriveVector(premiere: ChartPremiere): NarrativeDimension {
    const total = premiere.totalNotes;
    const perfectRate = ratio(premiere.perfect, total);
    const goodRate = ratio(premiere.good, total);
    const missRate = ratio(premiere.miss, total);
    const accuracy = perfectRate;
    const performance = perfectRate + 0.5 * goodRate;
    const combo = ratio(premiere.maxCombo, total);

    const traceRate = ratio(premiere.tracesRevealed, premiere.tracesTotal);
    const touchRate = ratio(premiere.tracesTouched, premiere.tracesRevealed);
    const deepRate = ratio(premiere.deepRevealed, premiere.tracesTotal);
    const anomalousRate = ratio(premiere.anomalousRevealed, premiere.tracesTotal);
    const rainRate = ratio(premiere.rainRevealed, premiere.tracesTotal);
    const frameLostRate = ratio(premiere.frameLost, premiere.tracesTotal);

    const audio = saturation(premiere.neuAudioModules);
    const effect = saturation(premiere.neuEffectModules);
    const light = saturation(premiere.neuLightModules);
    const resource = saturation(premiere.neuResourceModules);
    const subtitle = saturation(premiere.neuSubtitleModules);

    const triggerKinds = [
      premiere.triggerEnter,
      premiere.triggerExit,
      premiere.triggerDwell,
      premiere.triggerOccupancy,
      premiere.triggerParallax,
    ].filter((count) => count > 0).length;
    const trigger = saturation(triggerKinds);
    const complete = completedFlag(premiere);

    const values = new Array<number>(DIMENSION_COUNT).fill(0);
    values[RED] = percent(0.50 * anomalousRate + 0.30 * missRate + 0.20 * trigger);
    values[GREEN] = percent(0.45 * performance + 0.30 * goodRate + 0.25 * audio);
    values[BLUE] = percent(0.50 * subtitle + 0.30 * traceRate + 0.20 * touchRate);
    values[BLACK] = percent(0.50 * deepRate + 0.30 * anomalousRate + 0.20 * frameLostRate);
    values[WHITE] = percent(0.50 * accuracy + 0.30 * traceRate + 0.20 * performance);
    values[GREY] = percent(0.50 * missRate + 0.30 * frameLostRate + 0.20 * rainRate);
    values[INITIAL] = percent(0.50 * resource + 0.30 * trigger + 0.20 * complete);
    values[PROCESS] = percent(
      0.40 * performance
      + 0.25 * audio
      + 0.20 * touchRate
      + 0.15 * effect,
    );
    values[TRACE] = percent(0.60 * traceRate + 0.25 * touchRate + 0.15 * rainRate);
    values[HIGHLIGHT] = percent(
      0.25 * accuracy
      + 0.20 * combo
      + 0.20 * effect
      + 0.20 * light
      + 0.15 * performance,
    );
    values[COMMENTED] = percent(0.50 * effect + 0.30 * resource + 0.20 * trigger);
    values[RESIDUE] = percent(0.45 * missRate + 0.30 * rainRate + 0.25 * frameLostRate);
    values[TRUST] = percent(
      0.35 * accuracy
      + 0.25 * combo
      + 0.20 * performance
      + 0.10 * (1 - missRate)
      + 0.10 * subtitle,
    );
    values[CLOSENESS] = percent(
      0.40 * touchRate
      + 0.25 * traceRate
      + 0.20 * subtitle
      + 0.15 * audio,
    );
    values[UNDERSTANDING] = percent(
      0.45 * subtitle
      + 0.25 * performance
      + 0.20 * traceRate
      + 0.10 * effect,
    );
    values[CONFLICT] = percent(
      0.45 * missRate
      + 0.30 * anomalousRate
      + 0.25 * frameLostRate,
    );
    values[TRUTH_LEVEL] = percent(
      0.45 * deepRate
      + 0.30 * anomalousRate
      + 0.25 * traceRate,
    );
    values[NARRATIVE_TIME] = percent(
      0.60 * complete
      + 0.20 * subtitle
      + 0.20 * trigger,
    );
    values[INFLUENCE_RADIUS] = percent(
      0.40 * trigger
      + 0.25 * light
      + 0.20 * resource
      + 0.15 * effect,
    );
    values[PLAYER_EMPATHY] = percent(
      0.35 * performance
      + 0.20 * combo
      + 0.20 * touchRate
      + 0.15 * subtitle
      + 0.10 * traceRate,
    );

    for (let index = 0; index < DIMENSION_COUNT; index += 1) {
      const value = values[index];
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new RangeError(`narrative vector[${index}] must be within 0..100`);
      }
    }
    const vector = values as unknown as NarrativeDimension;
    validateNarrativeVector(vector);
    return vector;
  }

  /**
   * 追加首演事件。
   *
   * 返回 null 表示拒绝/跳过；调用可通过 lastDiagnostic 读取原因。
   * 账本损坏、已存在首演、fallback、未完成都不会抛异常。
   */
  recordPremiere(
    premiere: ChartPremiere,
    nowMs: number,
  ): Promise<LedgerCheckpoint | null> {
    const run = this.queue.then(
      () => this.recordNow(premiere, nowMs),
      () => this.recordNow(premiere, nowMs),
    );
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  private async recordNow(
    premiere: ChartPremiere,
    nowMs: number,
  ): Promise<LedgerCheckpoint | null> {
    this.lastDiagnosticValue = null;
    if (!(premiere instanceof ChartPremiere)) {
      this.lastDiagnosticValue = 'premiere must be a ChartPremiere';
      return null;
    }
    if (!Number.isFinite(nowMs)) {
      this.lastDiagnosticValue = 'appendedAt.epochMs must be finite';
      return null;
    }
    if (!premiere.completed) {
      this.lastDiagnosticValue = 'premiere is not complete';
      return null;
    }
    if (premiere.source === 'fallback') {
      this.lastDiagnosticValue = 'fallback chart must not write a premiere';
      return null;
    }
    if (premiere.totalNotes <= 0
      || premiere.perfect + premiere.good + premiere.miss !== premiere.totalNotes) {
      this.lastDiagnosticValue = 'premiere has undecided notes';
      return null;
    }

    let read: Awaited<ReturnType<LedgerReader['readAll']>>;
    try {
      read = await this.reader.readAll();
    } catch (error) {
      this.lastDiagnosticValue = `ledger read failed: ${errorText(error)}`;
      return null;
    }
    if (!read.ok) {
      this.lastDiagnosticValue = `ledger is read-only: ${read.diagnostic}`;
      return null;
    }

    const eventId = `premiere:${premiere.chartId}`;
    const alreadyRecorded = read.events.some((event) => (
      event.chartRef === premiere.chartId || event.eventId === eventId
    ));
    if (alreadyRecorded) {
      this.lastDiagnosticValue = 'chart premiere already recorded';
      return null;
    }

    const event: NarrativeEvent = {
      eventId,
      vector: ChartPremiereDirector.deriveVector(premiere),
      vectorSchemaVersion: VectorSchemaVersion,
      appendedAt: { epochMs: nowMs },
      chartRef: premiere.chartId,
    };

    try {
      const checkpoint = await appendNarrativeEvent(this.store, event);
      this.lastDiagnosticValue = null;
      return checkpoint;
    } catch (error) {
      this.lastDiagnosticValue = `ledger append failed: ${errorText(error)}`;
      return null;
    }
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
