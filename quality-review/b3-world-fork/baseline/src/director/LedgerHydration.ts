// B2.2d-1: a validated Ledger section and its necessary append guards.
// This is not a Complete WorldState producer and never replays gameplay effects.
import { NarrativeDimension, VectorSchemaVersion } from '../../constants';
import type { ChartRef } from '../../constants';
import type { ChartEntry } from '../chart/ChartEntry';
import { InputSource } from '../ledger/NarrativeEvent';
import type { NarrativeEvent } from '../ledger/NarrativeEvent';
import { deriveLedgerPosition, validateNarrativeVector } from '../ledger/deriveLedgerPosition';
import type { WorldGameplayContext } from './WorldClearSession';
import { parseWorldNarrativeContent } from './WorldNarrativeContent';
import type { WorldNarrativeContent } from './WorldNarrativeContent';
import { SphereCrossing } from './SphereCrossing';

const dimensions = Object.values(NarrativeDimension)
  .filter((value): value is NarrativeDimension => typeof value === 'number');

export interface LedgerSnapshot {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly worldId: string;
  readonly protagonistCharacterId: string;
  readonly contentId: string;
  readonly contentRevision: string;
  readonly characters: readonly {
    readonly characterId: string;
    readonly events: readonly NarrativeEvent[];
  }[];
  readonly control: {
    readonly selectedChoiceId: string | null;
    readonly sphereCrossed: boolean;
    readonly entry: ChartEntry | null;
    readonly eventSequence: number;
    readonly completionEventId: string | null;
  };
}

export type LedgerHydrateResult =
  | { readonly kind: 'Hydrated'; readonly snapshot: LedgerSnapshot }
  | { readonly kind: 'Rejected'; readonly issues: readonly string[] };

function ownFields(raw: unknown, names: readonly string[], label: string): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) { throw new Error(`${label}格式无效`); }
  const prototype: unknown = Object.getPrototypeOf(raw);
  if (prototype !== Object.prototype && prototype !== null) { throw new Error(`${label}原型无效`); }
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  if (Reflect.ownKeys(descriptors).length !== names.length) { throw new Error(`${label}字段无效`); }
  const values: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const name of names) {
    const descriptor = descriptors[name];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new Error(`${label}字段不可安全读取`);
    }
    values[name] = descriptor.value;
  }
  return values;
}

function ownArray(raw: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype) { throw new Error(`${label}数组格式无效`); }
  const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(raw as object);
  const length: unknown = descriptors.length?.value;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 ||
      Reflect.ownKeys(descriptors).length !== length + 1) { throw new Error(`${label}数组结构无效`); }
  const values: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new Error(`${label}数组不可安全读取`);
    }
    values.push(descriptor.value);
  }
  return values;
}

function validId(raw: unknown, label: string, maximum = 128): asserts raw is string {
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > maximum || raw !== raw.trim()) {
    throw new Error(`${label}标识无效`);
  }
  try { encodeURIComponent(raw); } catch { throw new Error(`${label}标识编码无效`); }
}

/** Complete event cloning is shared by live append and silent initial seeding. */
export function validateLedgerNarrativeEvent(raw: unknown): NarrativeEvent {
  const value = ownFields(raw, ['eventId', 'vector', 'VectorSchemaVersion', 'AppendedAt',
    'InputSource', 'ChapterTag', 'ChartRef'], '账本事件');
  validId(value.eventId, '账本事件');
  const time = ownFields(value.AppendedAt, ['epochMs'], '追加时刻');
  if (value.VectorSchemaVersion !== VectorSchemaVersion ||
      (value.InputSource !== InputSource.Player && value.InputSource !== InputSource.Autopilot) ||
      typeof time.epochMs !== 'number' || !Number.isSafeInteger(time.epochMs) || time.epochMs < 0) {
    throw new Error('账本事件版本、来源或追加时刻无效');
  }
  ownFields(value.ChapterTag, [], '本批章节标记');
  const hasState = !!value.ChartRef && Object.prototype.hasOwnProperty.call(value.ChartRef, 'state');
  const chart = ownFields(value.ChartRef, hasState ? ['chartId', 'state'] : ['chartId'], '谱面引用');
  validId(chart.chartId, '谱面');
  if (hasState && chart.state !== 'Entry' && chart.state !== 'PremiereCompleted') { throw new Error('谱面引用状态无效'); }
  if (chart.state === 'PremiereCompleted' && chart.chartId === 'CHART_NOT_BOUND') { throw new Error('未绑定谱面不能完成首演'); }
  const ChartRef: ChartRef = hasState ? Object.freeze({ chartId: chart.chartId,
    state: chart.state as 'Entry' | 'PremiereCompleted' }) : Object.freeze({ chartId: chart.chartId });
  return Object.freeze({ eventId: value.eventId, vector: validateNarrativeVector(value.vector), VectorSchemaVersion,
    AppendedAt: Object.freeze({ epochMs: time.epochMs }), InputSource: value.InputSource,
    ChapterTag: Object.freeze({}), ChartRef });
}

function producerSequence(narrativeEvent: NarrativeEvent, prefix: string): number | null {
  if (!narrativeEvent.eventId.startsWith(prefix)) { return null; }
  const match = new RegExp('^' + prefix + '(0|[1-9][0-9]*):([1-9][0-9]*)$').exec(narrativeEvent.eventId);
  if (!match) { throw new Error('制作内容账本事件标识无效'); }
  const timestamp = Number(match[1]);
  const sequence = Number(match[2]);
  if (!Number.isSafeInteger(timestamp) || timestamp !== narrativeEvent.AppendedAt.epochMs ||
      !Number.isSafeInteger(sequence)) { throw new Error('制作内容账本事件来源时间或序号不匹配'); }
  return sequence;
}

/** All operations validate/clone only: no append sink, clock, storage or callbacks. */
export class LedgerHydration {
  private readonly context: WorldGameplayContext;
  private readonly content: WorldNarrativeContent;

  constructor(context: WorldGameplayContext, content: WorldNarrativeContent) {
    validId(context.accountId, '账号', 64); validId(context.worldId, '世界');
    validId(context.protagonistCharacterId, '主角');
    if (context.worldKind !== 'Primary') { throw new Error('本批 Ledger 来源只接受已发布 Primary 内容'); }
    this.context = Object.freeze({ ...context });
    this.content = parseWorldNarrativeContent(content);
    if (this.content.protagonistCharacterId !== context.protagonistCharacterId) { throw new Error('Ledger 制作内容主角不匹配'); }
  }

  hydrate(raw: unknown): LedgerHydrateResult {
    try { return Object.freeze({ kind: 'Hydrated', snapshot: this.validate(raw) }); }
    catch (error: unknown) { return Object.freeze({ kind: 'Rejected', issues: Object.freeze([
      error instanceof Error ? error.message : 'Ledger 无法安全校验',
    ]) }); }
  }

  validate(raw: unknown): LedgerSnapshot {
    const value = ownFields(raw, ['schemaVersion', 'accountId', 'worldId', 'protagonistCharacterId',
      'contentId', 'contentRevision', 'characters', 'control'], 'Ledger 快照');
    if (value.schemaVersion !== 1 || value.accountId !== this.context.accountId || value.worldId !== this.context.worldId ||
        value.protagonistCharacterId !== this.context.protagonistCharacterId || value.contentId !== this.content.contentId ||
        value.contentRevision !== this.content.contentRevision) { throw new Error('Ledger 版本、身份或制作内容来源不匹配'); }
    const control = ownFields(value.control, ['selectedChoiceId', 'sphereCrossed', 'entry', 'eventSequence', 'completionEventId'], 'Ledger 追加控制');
    if (typeof control.sphereCrossed !== 'boolean' || typeof control.eventSequence !== 'number' ||
        !Number.isSafeInteger(control.eventSequence) || control.eventSequence < 0) { throw new Error('Ledger 追加控制值无效'); }
    if (control.selectedChoiceId !== null) { validId(control.selectedChoiceId, '叙事选择'); }
    if (control.completionEventId !== null) { validId(control.completionEventId, '完成事件'); }
    const characters: { readonly characterId: string; readonly events: readonly NarrativeEvent[] }[] = [];
    const characterIds = new Set<string>();
    for (const item of ownArray(value.characters, '角色账本')) {
      const character = ownFields(item, ['characterId', 'events'], '角色账本');
      validId(character.characterId, '账本角色');
      if (characterIds.has(character.characterId)) { throw new Error('Ledger 角色索引重复'); }
      characterIds.add(character.characterId);
      const eventIds = new Set<string>();
      const events = ownArray(character.events, '叙事事件').map(itemValue => validateLedgerNarrativeEvent(itemValue));
      for (const narrativeEvent of events) {
        if (eventIds.has(narrativeEvent.eventId)) { throw new Error('Ledger 同一角色事件标识重复'); }
        eventIds.add(narrativeEvent.eventId);
        if (character.characterId !== this.context.protagonistCharacterId &&
            (narrativeEvent.eventId.startsWith('WORLD_NARRATIVE_CHOICE:') || narrativeEvent.eventId.startsWith('WORLD_PREMIERE_COMPLETED:'))) {
          throw new Error('制作内容事件不能跨角色归属');
        }
      }
      deriveLedgerPosition(events); // also rejects full-order accumulation overflow
      characters.push(Object.freeze({ characterId: character.characterId, events: Object.freeze(events) }));
    }
    const protagonist = characters.find(character => character.characterId === this.context.protagonistCharacterId);
    if (!protagonist) { throw new Error('Ledger 缺少正式主角载体，不能用空账本替代'); }
    const geometry = new SphereCrossing(this.content.EventSpaceCenter, this.content.EventDistance);
    let crossed = false;
    let maximumSequence = 0;
    let choiceEvent: NarrativeEvent | null = null;
    let completionEvent: NarrativeEvent | null = null;
    const prefix: NarrativeEvent[] = [];
    for (const narrativeEvent of protagonist.events) {
      const choiceSequence = producerSequence(narrativeEvent, 'WORLD_NARRATIVE_CHOICE:');
      const completionSequence = producerSequence(narrativeEvent, 'WORLD_PREMIERE_COMPLETED:');
      if (choiceSequence !== null || completionSequence !== null) {
        const sequence = choiceSequence ?? completionSequence!;
        if (sequence <= maximumSequence || narrativeEvent.InputSource !== InputSource.Player ||
            narrativeEvent.ChartRef.chartId !== this.content.worldBossChartSource.chartId) {
          throw new Error('制作内容事件的来源、谱面或序号不合法');
        }
        maximumSequence = sequence;
      }
      if (choiceSequence !== null) {
        if (choiceEvent || completionEvent || narrativeEvent.ChartRef.state !== 'Entry') { throw new Error('叙事选择事实重复或引用状态无效'); }
        choiceEvent = narrativeEvent;
      }
      if (completionSequence !== null) {
        if (completionEvent || !crossed || narrativeEvent.ChartRef.state !== 'PremiereCompleted' ||
            narrativeEvent.vector.some(component => component !== 0)) { throw new Error('World 完成事实重复、无穿越来源或向量不合法'); }
        completionEvent = narrativeEvent;
      }
      if (narrativeEvent.ChartRef.chartId === this.content.worldBossChartSource.chartId &&
          narrativeEvent.ChartRef.state === 'PremiereCompleted' && completionSequence === null) {
        throw new Error('World 完成引用缺少已知合法生产者来源');
      }
      prefix.push(narrativeEvent);
      if (narrativeEvent.InputSource === InputSource.Player && geometry.getDistance(deriveLedgerPosition(prefix)) >= this.content.EventDistance) {
        crossed = true; // infer the persisted witness; never call the crossing trigger
      }
    }
    if (control.eventSequence !== maximumSequence) { throw new Error('Ledger 制作事件序号与控制不匹配'); }
    if (control.sphereCrossed !== crossed) { throw new Error('Ledger 穿越控制与 Player 历史前缀不匹配'); }
    if ((completionEvent?.eventId ?? null) !== control.completionEventId) { throw new Error('Ledger 完成控制与唯一完成事实不匹配'); }
    if (choiceEvent === null) {
      if (control.selectedChoiceId !== null) { throw new Error('Ledger 叙事选择控制缺少真实选择事件'); }
    } else {
      const matches = this.content.interaction.choices.filter(choice =>
        dimensions.every(dimension => choice.vector[dimension] === choiceEvent!.vector[dimension]));
      if (matches.length !== 1 || matches[0].choiceId !== control.selectedChoiceId) {
        throw new Error('Ledger 选择标识、内容向量不匹配或来源存在歧义');
      }
    }
    let entry: ChartEntry | null = null;
    if (control.entry !== null) {
      const valueEntry = ownFields(control.entry, ['entryId', 'worldId', 'characterId', 'ChartRef', 'tier', 'source'], 'World 入口');
      const ref = ownFields(valueEntry.ChartRef, ['chartId', 'state'], 'World 入口引用');
      const entryId = JSON.stringify([this.context.accountId, this.context.worldId, this.context.protagonistCharacterId, 'SphereCrossing']);
      if (!crossed || valueEntry.entryId !== entryId || valueEntry.worldId !== this.context.worldId ||
          valueEntry.characterId !== this.context.protagonistCharacterId || valueEntry.tier !== 'World' ||
          valueEntry.source !== 'SphereCrossing' || ref.chartId !== this.content.worldBossChartSource.chartId || ref.state !== 'Entry') {
        throw new Error('Ledger World 入口身份、来源或唯一键不匹配');
      }
      entry = Object.freeze({ entryId, worldId: this.context.worldId, characterId: this.context.protagonistCharacterId,
        ChartRef: Object.freeze({ chartId: this.content.worldBossChartSource.chartId, state: 'Entry' }), tier: 'World', source: 'SphereCrossing' });
    } else if (crossed) { throw new Error('Ledger 已穿越却缺少原入口事实'); }
    return Object.freeze({ schemaVersion: 1, accountId: this.context.accountId, worldId: this.context.worldId,
      protagonistCharacterId: this.context.protagonistCharacterId, contentId: this.content.contentId,
      contentRevision: this.content.contentRevision, characters: Object.freeze(characters),
      control: Object.freeze({ selectedChoiceId: control.selectedChoiceId as string | null, sphereCrossed: crossed,
        entry, eventSequence: maximumSequence, completionEventId: completionEvent?.eventId ?? null }) });
  }
}
