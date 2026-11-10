// B2.2d-1 partial state: stable puzzle boundaries only, never a ChartSnapshot.
import { InputSource } from '../ledger/NarrativeEvent';
import type { NarrativeEvent } from '../ledger/NarrativeEvent';
import { validateNarrativeVector } from '../ledger/deriveLedgerPosition';
import type { PuzzleChainPrivateState } from '../trace/PuzzleChain';
import { validatePuzzleChainPrivateState } from '../trace/PuzzleChain';
import type { PerceptionMode } from './PlayerIntent';
import { classifyChartReference } from './ChartReference';

export interface PuzzleControlState {
  readonly currentPerceptionMode: PerceptionMode;
  readonly beatClockOffsetMs: number;
  readonly endpointSettled: boolean;
  readonly deepTraceTriggered: boolean;
  readonly chartCompletionRecorded: boolean;
  readonly revealPhase: 'Idle' | 'Finished';
  readonly chartEntryScheduled: false;
  readonly worldMotionGated: false;
}

export interface PuzzleProgressSnapshot {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly worldId: string;
  readonly chainId: string;
  readonly deepTraceId: string;
  readonly ruleVersion: 1;
  readonly chartId: string;
  readonly chain: PuzzleChainPrivateState;
  readonly control: PuzzleControlState;
}

function fields(raw: unknown, names: readonly string[], label: string): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      (Object.getPrototypeOf(raw) !== Object.prototype && Object.getPrototypeOf(raw) !== null)) {
    throw new Error(`${label}须为普通对象`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  if (Reflect.ownKeys(descriptors).length !== names.length) { throw new Error(`${label}字段无效`); }
  const value: Record<string, unknown> = {};
  for (const name of names) {
    const descriptor = descriptors[name];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new Error(`${label}字段不可安全读取`);
    }
    value[name] = descriptor.value;
  }
  return value;
}

function id(raw: unknown, label: string, maximum = 128): string {
  if (typeof raw !== 'string' || !raw || raw !== raw.trim() || raw.length > maximum) {
    throw new Error(`${label}标识无效`);
  }
  try { encodeURIComponent(raw); } catch { throw new Error(`${label}标识编码无效`); }
  return raw;
}

/** Local shape validation; the full snapshot validator additionally checks the authoritative ledger. */
export function validatePuzzleControlState(raw: unknown): PuzzleControlState {
  const value = fields(raw, ['currentPerceptionMode', 'beatClockOffsetMs', 'endpointSettled',
    'deepTraceTriggered', 'chartCompletionRecorded', 'revealPhase', 'chartEntryScheduled', 'worldMotionGated'], '解谜控制快照');
  if (value.currentPerceptionMode !== 'Normal' && value.currentPerceptionMode !== 'Triggered' && value.currentPerceptionMode !== 'Rain') {
    throw new Error('解谜感知模式无效');
  }
  if (typeof value.beatClockOffsetMs !== 'number' || !Number.isFinite(value.beatClockOffsetMs)) {
    throw new Error('解谜拍点校准偏移须为有限数');
  }
  for (const key of ['endpointSettled', 'deepTraceTriggered', 'chartCompletionRecorded']) {
    if (typeof value[key] !== 'boolean') { throw new Error('解谜事实须为布尔值'); }
  }
  if (value.chartEntryScheduled !== false || value.worldMotionGated !== false ||
      (value.revealPhase !== 'Idle' && value.revealPhase !== 'Finished')) {
    throw new Error('UnsupportedBoundary: 活动谱面或揭示不支持部分保存或恢复');
  }
  return Object.freeze({ currentPerceptionMode: value.currentPerceptionMode,
    beatClockOffsetMs: value.beatClockOffsetMs, endpointSettled: value.endpointSettled as boolean,
    deepTraceTriggered: value.deepTraceTriggered as boolean, chartCompletionRecorded: value.chartCompletionRecorded as boolean,
    revealPhase: value.revealPhase, chartEntryScheduled: false, worldMotionGated: false });
}

/** Validates identity, complete private state, terminal lifecycle and exact T6/T7 facts before hydration. */
export function validatePuzzleProgressSnapshot(
  raw: unknown, accountId: string, worldId: string, chainId: string, deepTraceId: string,
  chartId: string, ledgerEvents: readonly NarrativeEvent[],
): PuzzleProgressSnapshot {
  id(accountId, '账号', 64); id(worldId, '世界'); id(chainId, '解谜链'); id(deepTraceId, '深痕'); id(chartId, '常规谱面');
  if (chartId === 'CHART_NOT_BOUND') { throw new Error('解谜快照要求已验证的常规谱面'); }
  const value = fields(raw, ['schemaVersion', 'accountId', 'worldId', 'chainId', 'deepTraceId', 'ruleVersion',
    'chartId', 'chain', 'control'], '解谜进度快照');
  if (value.schemaVersion !== 1 || value.ruleVersion !== 1 || value.accountId !== accountId || value.worldId !== worldId ||
      value.chainId !== chainId || value.deepTraceId !== deepTraceId || value.chartId !== chartId) {
    throw new Error('解谜快照身份、规则或谱面引用不匹配');
  }
  // Production rule version 1 is the shipped 60 BPM, seven-second puzzle.
  const chain = validatePuzzleChainPrivateState(value.chain, 1000);
  const control = validatePuzzleControlState(value.control);
  let endpointCount = 0, completionCount = 0;
  const eventIds = new Set<string>();
  for (const narrativeEvent of ledgerEvents) {
    const classification = classifyChartReference(narrativeEvent, chartId);
    const event = fields(narrativeEvent, ['eventId', 'vector', 'VectorSchemaVersion', 'AppendedAt',
      'InputSource', 'ChapterTag', 'ChartRef'], '解谜关联账本事件');
    const eventId = id(event.eventId, '账本事件');
    if (eventIds.has(eventId)) { throw new Error('解谜关联账本有重复事件标识'); }
    eventIds.add(eventId);
    if (eventId !== 'T6_ENDPOINT_PLACEHOLDER' && eventId !== 'T7_COMPLETION_PLACEHOLDER') { continue; }
    const vector = validateNarrativeVector(event.vector);
    const reference = fields(event.ChartRef,
      Object.prototype.hasOwnProperty.call(event.ChartRef, 'state') ? ['chartId', 'state'] : ['chartId'], '解谜关联谱面引用');
    if (event.InputSource !== InputSource.Player || !vector.every(component => component === 0) || reference.chartId !== chartId) {
      throw new Error('旧解谜终点或完成事件与生产者/绑定谱面不一致');
    }
    if (eventId === 'T6_ENDPOINT_PLACEHOLDER') {
      if (classification !== 'Entry') { throw new Error('解谜终点必须是合法 Entry 引用'); }
      endpointCount++;
    } else {
      if (classification !== 'PremiereCompleted') { throw new Error('常规谱面完成必须是合法首演完成引用'); }
      completionCount++;
    }
  }
  if (endpointCount > 1 || completionCount > 1 || control.endpointSettled !== (endpointCount === 1) ||
      control.chartCompletionRecorded !== (completionCount === 1) || control.deepTraceTriggered !== control.endpointSettled) {
    throw new Error('解谜终点、深痕或完成防重标志与权威账本不一致');
  }
  const completed = chain.stage === 'Completed';
  if (control.endpointSettled !== completed || (control.chartCompletionRecorded && !completed) ||
      control.revealPhase !== (completed ? 'Finished' : 'Idle')) {
    throw new Error('解谜阶段、终点与揭示生命周期不一致');
  }
  return Object.freeze({ schemaVersion: 1, accountId, worldId, chainId, deepTraceId, ruleVersion: 1,
    chartId, chain, control });
}
